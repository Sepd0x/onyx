// Single main-process entry point for every AI feature. Callers pass a fully
// formed system + user prompt (prompts are built in MAIN so the renderer can
// never inject one or see the key). Returns { text, usage, cached } on success
// or { error } on no-key / API failure. The decrypted key never leaves this module.
//
// Provider-agnostic: branches on the active provider (Anthropic / OpenAI / Google)
// so the same feature prompts work whichever key the user configured.
const crypto = require('crypto');
const store = require('./store');
const { shouldDisableThinking } = require('./models');

// In-memory result cache keyed by feature + input hash, so repeat clicks on
// unchanged data are free. Not persisted; bounded to avoid unbounded growth.
const cache = new Map();
const MAX_CACHE = 50;

function hashInput(feature, input) {
  return feature + ':' + crypto.createHash('sha1').update(String(input)).digest('hex');
}

// Map an HTTP status to a friendly, key-safe error code.
function statusToError(status) {
  if (status === 401 || status === 403) return 'invalid-key';
  if (status === 429 || status === 529 || status === 503) return 'rate-limited';
  return 'failed';
}

// Pull the provider's human-readable error message out of a failed response, so
// the renderer can show the REAL reason (quota, bad model, key issue) instead of
// a generic line. Both OpenAI and Google nest it under `error.message`.
async function errorDetail(res) {
  try {
    const j = await res.json();
    return (j && j.error && (j.error.message || j.error.status)) || `HTTP ${res.status}`;
  } catch { return `HTTP ${res.status}`; }
}

const FETCH_TIMEOUT_MS = 30000;

// fetch with a hard timeout — the raw fetch in the OpenAI/Google callers has none,
// so a hung request would leave the panel spinning forever. Mirrors the Anthropic
// SDK's own 30s timeout.
async function fetchWithTimeout(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function callAnthropic({ key, model, system, user, maxTokens }) {
  let Anthropic;
  try { Anthropic = require('@anthropic-ai/sdk'); } catch { return { error: 'sdk-missing' }; }
  try {
    const client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 30000 });
    const res = await client.messages.create({
      model, max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: user }],
    });
    const text = Array.isArray(res.content)
      ? res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
      : '';
    const usage = res.usage ? { input: res.usage.input_tokens, output: res.usage.output_tokens } : null;
    return { text, usage };
  } catch (e) {
    const detail = (e && (e?.error?.error?.message || e.message)) || '';
    return { error: statusToError(e && e.status), detail };
  }
}

async function callOpenAI({ key, model, system, user, maxTokens }) {
  try {
    const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) return { error: statusToError(res.status), detail: await errorDetail(res) };
    const data = await res.json();
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
    const usage = data.usage ? { input: data.usage.prompt_tokens, output: data.usage.completion_tokens } : null;
    return { text, usage };
  } catch (e) {
    if (e && e.name === 'AbortError') return { error: 'failed', detail: 'Request timed out after 30s.' };
    return { error: 'failed' };
  }
}

async function callGoogle({ key, model, system, user, maxTokens }) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const generationConfig = { maxOutputTokens: maxTokens };
    // These short structured tasks don't need chain-of-thought; disabling it on the
    // flash thinking-models stops the output budget being eaten (range 0–24576).
    if (shouldDisableThinking(model)) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig,
      }),
    });
    if (!res.ok) return { error: statusToError(res.status), detail: await errorDetail(res) };
    const data = await res.json();
    const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const text = (Array.isArray(parts) ? parts.map((p) => p.text || '').join('') : '').trim();
    const u = data.usageMetadata;
    const usage = u ? { input: u.promptTokenCount, output: u.candidatesTokenCount } : null;
    return { text, usage };
  } catch (e) {
    if (e && e.name === 'AbortError') return { error: 'failed', detail: 'Request timed out after 30s.' };
    return { error: 'failed' };
  }
}

// ---- Streaming variants (emit text via onDelta as it arrives) ----------------

// Yield each SSE `data:` payload from a fetch Response body (web ReadableStream).
async function* sseLines(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line.startsWith('data:')) yield line.slice(5).trim();
    }
  }
}

async function streamAnthropic({ key, model, system, user, maxTokens, onDelta }) {
  let Anthropic;
  try { Anthropic = require('@anthropic-ai/sdk'); } catch { return { error: 'sdk-missing' }; }
  try {
    const client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 30000 });
    const stream = await client.messages.create({
      model, max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: user }], stream: true,
    });
    let text = '';
    let usage = null;
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
        text += ev.delta.text; onDelta(ev.delta.text);
      } else if (ev.type === 'message_start' && ev.message && ev.message.usage) {
        usage = { input: ev.message.usage.input_tokens, output: 0 };
      } else if (ev.type === 'message_delta' && ev.usage) {
        usage = { input: (usage && usage.input) || 0, output: ev.usage.output_tokens };
      }
    }
    return { text, usage };
  } catch (e) {
    const detail = (e && (e?.error?.error?.message || e.message)) || '';
    return { error: statusToError(e && e.status), detail };
  }
}

async function streamOpenAI({ key, model, system, user, maxTokens, onDelta }) {
  try {
    const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: maxTokens, stream: true,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) return { error: statusToError(res.status), detail: await errorDetail(res) };
    let text = '';
    for await (const data of sseLines(res)) {
      if (data === '[DONE]') break;
      try {
        const d = JSON.parse(data).choices?.[0]?.delta?.content;
        if (d) { text += d; onDelta(d); }
      } catch {}
    }
    return { text, usage: null };
  } catch (e) {
    if (e && e.name === 'AbortError') return { error: 'failed', detail: 'Request timed out after 30s.' };
    return { error: 'failed' };
  }
}

async function streamGoogle({ key, model, system, user, maxTokens, onDelta }) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
    const generationConfig = { maxOutputTokens: maxTokens };
    if (shouldDisableThinking(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig,
      }),
    });
    if (!res.ok) return { error: statusToError(res.status), detail: await errorDetail(res) };
    let text = '';
    for await (const data of sseLines(res)) {
      try {
        const parts = JSON.parse(data).candidates?.[0]?.content?.parts;
        const d = Array.isArray(parts) ? parts.map((p) => p.text || '').join('') : '';
        if (d) { text += d; onDelta(d); }
      } catch {}
    }
    return { text, usage: null };
  } catch (e) {
    if (e && e.name === 'AbortError') return { error: 'failed', detail: 'Request timed out after 30s.' };
    return { error: 'failed' };
  }
}

const CALLERS = { anthropic: callAnthropic, openai: callOpenAI, google: callGoogle };
const STREAMERS = { anthropic: streamAnthropic, openai: streamOpenAI, google: streamGoogle };

async function complete({ feature, system, user, maxTokens = 500, cacheKey }) {
  const key = store.getKey();
  if (!key) return { error: 'no-key' };

  // Cache by provider+model too: switching provider must not serve another's answer.
  const provider = store.getProvider();
  const model = store.getModel();
  const ck = cacheKey ? hashInput(`${feature}:${provider}:${model}`, cacheKey) : null;
  if (ck && cache.has(ck)) return { ...cache.get(ck), cached: true };

  const caller = CALLERS[provider] || callAnthropic;
  const out = await caller({ key, model, system, user, maxTokens });
  if (out.error) return { error: out.error, detail: out.detail || '' };
  if (!out.text) return { error: 'empty' };

  const result = { text: out.text, usage: out.usage || null };
  if (ck) {
    cache.set(ck, result);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  }
  return result;
}

// Streaming completion: same contract as complete() but invokes onDelta with each
// text chunk as it arrives. Falls through the same cache (serving a cached answer
// in one delta). Caller decides what to do on { error }.
async function completeStream({ feature, system, user, maxTokens = 500, cacheKey, onDelta }) {
  const key = store.getKey();
  if (!key) return { error: 'no-key' };

  const provider = store.getProvider();
  const model = store.getModel();
  const ck = cacheKey ? hashInput(`${feature}:${provider}:${model}`, cacheKey) : null;
  if (ck && cache.has(ck)) {
    const cached = cache.get(ck);
    if (onDelta && cached.text) onDelta(cached.text);
    return { ...cached, cached: true };
  }

  const streamer = STREAMERS[provider] || streamAnthropic;
  const cb = typeof onDelta === 'function' ? onDelta : () => {};
  const out = await streamer({ key, model, system, user, maxTokens, onDelta: cb });
  if (out.error) return { error: out.error, detail: out.detail || '' };
  if (!out.text) return { error: 'empty' };

  const result = { text: out.text, usage: out.usage || null };
  if (ck) {
    cache.set(ck, result);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  }
  return result;
}

// Convenience for callers that just want the string or a clean null fallback
// (e.g. commit-message generation degrading to its heuristic).
async function completeText(opts) {
  const r = await complete(opts);
  return r && r.text ? r.text : null;
}

module.exports = { complete, completeStream, completeText };
