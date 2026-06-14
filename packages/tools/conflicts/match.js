// Pure conflict-matching helpers (no electron / no child_process) so they're
// unit-testable apart from the IPC + tasklist plumbing in index.js.

// Known tools that also manage power profiles / system tuning on Windows. Matched
// case-insensitively against running process image names. Keep this conservative —
// a false "conflict" warning is worse than missing an obscure tool.
const KNOWN_POWER_TOOLS = [
  { match: /lenovo.*vantage|lenovovantage|imcontroller/i, name: 'Lenovo Vantage' },
  { match: /dellpower|dell.*power/i, name: 'Dell Power Manager' },
  { match: /armourycrate|armoury|asussystem/i, name: 'Armoury Crate' },
  { match: /myasus/i, name: 'MyASUS' },
  { match: /hppower|hp.*power/i, name: 'HP Power Manager' },
  { match: /msi.*center|dragon.*center/i, name: 'MSI Center' },
  { match: /throttlestop/i, name: 'ThrottleStop' },
  { match: /razer.*synapse/i, name: 'Razer Synapse' },
];

// Extract image names from `tasklist /fo csv /nh` output (first quoted CSV field
// per line). Tolerant of blank lines and CRLF.
function parseTasklistImages(stdout) {
  return String(stdout || '').split('\n').map((line) => {
    const m = line.match(/^"([^"]+)"/);
    return m ? m[1] : '';
  }).filter(Boolean);
}

// Given running image names, return the de-duped friendly names of any known
// power tools present.
function matchPowerTools(imageNames, tools = KNOWN_POWER_TOOLS) {
  const found = [];
  for (const tool of tools) {
    if (imageNames.some((img) => tool.match.test(img)) && !found.includes(tool.name)) {
      found.push(tool.name);
    }
  }
  return found;
}

module.exports = { KNOWN_POWER_TOOLS, parseTasklistImages, matchPowerTools };
