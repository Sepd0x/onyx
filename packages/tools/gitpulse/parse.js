// Pure, dependency-free helpers extracted from gitpulse so they can be unit-tested
// without spawning git or Electron.

function parseGithubUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('https://github.com/')) return null;
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!m) return null;
  const owner = m[1];
  const repo = m[2].replace(/\.git$/, '');
  if (!owner || !repo) return null;
  return { owner, repo, slug: `${owner}/${repo}`, url: `https://github.com/${owner}/${repo}` };
}

const LOW_EFFORT = ['update', 'fix', 'stuff', 'test'];

function classifyCommitMessage(msg) {
  const out = { warning: null };
  if (typeof msg !== 'string') return out;
  const lc = msg.toLowerCase().trim();
  if (LOW_EFFORT.includes(lc) || lc.length < 5) {
    out.warning = `Bad commit message detected: "${msg.replace(/\n/g, '')}"`;
  }
  return out;
}

module.exports = { parseGithubUrl, classifyCommitMessage };
