// Single main-process entry point for every AI feature. Callers pass a fully
// formed system + user prompt (prompts are built in MAIN so the renderer can
// never inject one or see the key). Returns { text, usage, cached } on success
// or { error } on no-key / SDK-missing / API failure. The decrypted key never
// leaves this module.
const crypto = require('crypto');
const store = require('./store');

// In-memory result cache keyed by feature + input hash, so repeat clicks on
// unchanged data are free. Not persisted; bounded to avoid unbounded growth.
const cache = new Map();
const MAX_CACHE = 50;

function hashInput(feature, input) {
  return feature + ':' + crypto.createHash('sha1').update(String(input)).digest('hex');
}

async function complete({ feature, system, user, maxTokens = 500, cacheKey }) {
  const key = store.getKey();
  if (!key) return { error: 'no-key' };

  const ck = cacheKey ? hashInput(feature, cacheKey) : null;
  if (ck && cache.has(ck)) return { ...cache.get(ck), cached: true };

  let Anthropic;
  try { Anthropic = require('@anthropic-ai/sdk'); } catch { return { error: 'sdk-missing' }; }

  try {
    const client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 30000 });
    const res = await client.messages.create({
      model: store.getModel(),
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const text = Array.isArray(res.content)
      ? res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
      : '';
    if (!text) return { error: 'empty' };
    const result = { text, usage: res.usage ? { input: res.usage.input_tokens, output: res.usage.output_tokens } : null };
    if (ck) {
      cache.set(ck, result);
      if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    }
    return result;
  } catch (e) {
    // Map typed SDK errors to friendly codes; never leak the key or a stack.
    const status = e && e.status;
    if (status === 401) return { error: 'invalid-key' };
    if (status === 429 || status === 529) return { error: 'rate-limited' };
    return { error: 'failed' };
  }
}

// Convenience for callers that just want the string or a clean null fallback
// (e.g. commit-message generation degrading to its heuristic).
async function completeText(opts) {
  const r = await complete(opts);
  return r && r.text ? r.text : null;
}

module.exports = { complete, completeText };
