// Pure model-capability helpers (no electron / no key) so they're unit-testable
// in isolation from the SDK + keychain code in complete.js / store.js.

// Gemini 2.5 and 3.x "flash" models think by default, which silently eats the
// output-token budget and truncates short structured answers. These accept
// `thinkingConfig.thinkingBudget = 0` to turn it off; 2.0/1.5 and *-pro do not,
// so we only send the flag when it's both safe and useful.
function shouldDisableThinking(model) {
  return /(?:2\.5|3[.-]).*flash/i.test(String(model || ''));
}

module.exports = { shouldDisableThinking };
