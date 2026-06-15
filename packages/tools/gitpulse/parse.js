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

// Normalise a `git remote get-url origin` value (https or ssh) to an `owner/repo`
// slug, dropping any `.git` suffix and trailing slash. Returns null when it isn't
// a GitHub remote. Case is preserved for display; callers compare case-insensitively.
//   https://github.com/Owner/Repo.git  → Owner/Repo
//   git@github.com:Owner/Repo.git       → Owner/Repo
function parseRemoteSlug(remoteUrl) {
  if (typeof remoteUrl !== 'string') return null;
  const m = remoteUrl.trim().match(/github\.com[:/]+([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (!m) return null;
  const owner = m[1];
  const repo = m[2];
  if (!owner || !repo) return null;
  return `${owner}/${repo}`;
}

// Merge local + remote repo cards that are the same project into one "unified"
// card (local state kept primary, remote state attached under `remote`).
//
// A local card pairs with a remote when either the user forced it (directive.link
// === remote url) or the local's origin slug matches the remote's slug AND the
// pair isn't suppressed (directive.unlinked includes the remote url). Pure +
// deterministic so it can be unit-tested without git or the network.
function pairRepoCards(localCards, remoteCards, directives = {}) {
  const lc = (s) => (typeof s === 'string' ? s.toLowerCase() : '');
  const remotes = remoteCards.map((card) => ({ card, used: false }));
  const out = [];

  for (const local of localCards) {
    const d = directives[local.path] || {};
    const suppressed = new Set((d.unlinked || []).map(lc));
    let match = null;

    if (d.link) {
      match = remotes.find((r) => !r.used && lc(r.card.path) === lc(d.link));
    }
    if (!match && local.remoteSlug) {
      match = remotes.find(
        (r) => !r.used && lc(r.card.name) === lc(local.remoteSlug) && !suppressed.has(lc(r.card.path))
      );
    }

    if (match) {
      match.used = true;
      const remote = match.card;
      out.push({
        ...local,
        type: 'unified',
        remote: {
          slug: remote.name,
          url: remote.path,
          branch: remote.branch,
          // `issuesReal` excludes PRs (GitHub's open_issues_count conflates them);
          // fall back to the raw count for older payloads that lack the split.
          openIssues: remote.issuesReal != null ? remote.issuesReal : remote.dirty,
          openPRs: remote.prs || 0,
          lastCommit: remote.lastCommit,
          lastCommitAuthor: remote.lastCommitAuthor || null,
          lastCommitDate: remote.lastCommitDate || null,
        },
      });
    } else {
      out.push(local);
    }
  }

  for (const r of remotes) if (!r.used) out.push(r.card);
  return out;
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

// Bound a `git diff` for sending to a model: truncate each file's hunk to
// maxPerFileBytes, then stop once the running total would exceed maxTotalBytes.
// Splits on the `diff --git` boundary so truncation lands between files, not
// mid-token. Pure + deterministic so it can be unit-tested.
function capDiff(diff, maxTotalBytes = 30000, maxPerFileBytes = 8000) {
  if (typeof diff !== 'string' || !diff) return '';
  const parts = diff.split(/(?=^diff --git )/m);
  let out = '';
  for (let part of parts) {
    if (part.length > maxPerFileBytes) {
      part = part.slice(0, maxPerFileBytes) + '\n… [file diff truncated]\n';
    }
    if (out.length + part.length > maxTotalBytes) {
      out += '\n… [diff truncated to fit context]\n';
      break;
    }
    out += part;
  }
  return out;
}

// Parse `git status --short` (porcelain v1) into a capped list of changed files.
// Each line is `XY path` (XY = 2-char status, e.g. " M", "??", "A "). Returns the
// first `cap` entries plus the true total so the UI can say "+N more".
// Pure + deterministic so it can be unit-tested without git.
function parseDirtyFiles(statusShort, cap = 20) {
  if (typeof statusShort !== 'string' || !statusShort.trim()) return { files: [], total: 0 };
  const lines = statusShort.split('\n').filter((l) => l.length > 0);
  const files = lines.slice(0, Math.max(0, cap)).map((l) => ({
    status: l.slice(0, 2).trim() || '?',
    // For renames git emits "old -> new"; show the destination path.
    file: l.slice(3).trim().split(' -> ').pop(),
  }));
  return { files, total: lines.length };
}

// Parse `git branch --format=%(refname:short)` (one branch per line) into a
// capped, trimmed list. Pure + deterministic.
function parseBranchList(out, cap = 50) {
  if (typeof out !== 'string' || !out.trim()) return [];
  return out.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, Math.max(0, cap));
}

// Parse a single `git log -1` line formatted with a unit-separator (\x1f) between
// %h, %an, %cr and %B. The message field keeps its first line only (the subject).
// Returns null when there is nothing usable. Pure + deterministic.
function parseCommitLine(raw, sep = '\x1f') {
  if (typeof raw !== 'string' || !raw) return null;
  const parts = raw.split(sep);
  const hash = (parts[0] || '').trim();
  const author = (parts[1] || '').trim();
  const relative = (parts[2] || '').trim();
  const subject = (parts.slice(3).join(sep) || '').split('\n')[0].trim();
  if (!hash && !subject) return null;
  return { hash, author, relative, subject };
}

module.exports = { parseGithubUrl, parseRemoteSlug, pairRepoCards, classifyCommitMessage, bucketCommitDates, capDiff, parseDirtyFiles, parseBranchList, parseCommitLine };
