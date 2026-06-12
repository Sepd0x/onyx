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

// Bucket a list of commit dates (ISO `YYYY-MM-DD`, e.g. from `git log --date=short`)
// into a fixed-length per-day activity array. Index 0 is `days-1` days ago and the
// last index is `todayISO`. Dates outside the window or unparsable are ignored.
// Pure + deterministic (today is passed in) so it can be unit-tested without a clock.
function bucketCommitDates(dates, days, todayISO) {
  const buckets = new Array(Math.max(0, days)).fill(0);
  if (!Array.isArray(dates) || buckets.length === 0) return buckets;
  const toUTC = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const today = toUTC(todayISO);
  if (today === null) return buckets;
  const DAY = 86400000;
  for (const d of dates) {
    const t = toUTC(d);
    if (t === null) continue;
    const offset = Math.round((today - t) / DAY);
    if (offset >= 0 && offset < buckets.length) buckets[buckets.length - 1 - offset]++;
  }
  return buckets;
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

module.exports = { parseGithubUrl, classifyCommitMessage, bucketCommitDates };
