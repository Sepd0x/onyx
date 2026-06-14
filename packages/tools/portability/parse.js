// Pure helpers for settings backup export/import, isolated so the build/validate
// logic is unit-testable without Electron dialogs or the filesystem.
//
// A backup bundles only portable, non-secret preferences: app config, snippets and
// launcher profiles. It deliberately never includes API keys or the GitHub token
// (those live in their own encrypted, machine-bound stores and must not travel).

const MARKER = 'onyx-settings-backup';

function buildBackup(bundle, exportedAt) {
  const b = bundle || {};
  return {
    onyx: MARKER,
    version: 1,
    exportedAt: exportedAt || null,
    config: b.config && typeof b.config === 'object' && !Array.isArray(b.config) ? b.config : {},
    snippets: Array.isArray(b.snippets) ? b.snippets : [],
    launchers: Array.isArray(b.launchers) ? b.launchers : [],
  };
}

// Parse + validate a backup file's raw text. Returns { data } on success or
// { error } with a friendly message — never throws.
function parseBackup(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { error: 'Not a valid JSON file.' };
  }
  if (!data || typeof data !== 'object' || data.onyx !== MARKER) {
    return { error: 'Not an Onyx settings backup.' };
  }
  return {
    data: {
      config: data.config && typeof data.config === 'object' && !Array.isArray(data.config) ? data.config : {},
      snippets: Array.isArray(data.snippets) ? data.snippets : [],
      launchers: Array.isArray(data.launchers) ? data.launchers : [],
    },
  };
}

module.exports = { MARKER, buildBackup, parseBackup };
