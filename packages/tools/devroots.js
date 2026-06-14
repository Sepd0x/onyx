const os = require('os');
const path = require('path');

// Common locations developers keep code in, under the user's home folder. Both
// Git Pulse (repo discovery) and Dev Cleanser (node_modules sweep) scan these by
// default so they find work spread across the machine — not just the one folder
// the app happens to sit in. Callers filter to existing dirs; per-tool depth caps
// and skip-lists keep the scans bounded and fast.
function defaultDevRoots() {
  const home = os.homedir();
  const names = [
    'Desktop', 'Documents', 'Projects', 'projects', 'Code', 'code',
    'dev', 'Dev', 'Developer', 'source', 'src', 'repos', 'Repos',
    'git', 'GitHub', 'workspace', 'work',
    path.join('Documents', 'GitHub'),
    path.join('source', 'repos'),
    // OneDrive-redirected known folders (very common on Windows 11).
    path.join('OneDrive', 'Desktop'),
    path.join('OneDrive', 'Documents'),
  ];
  // De-dupe while preserving order.
  return [...new Set(names.map((n) => path.join(home, n)))];
}

module.exports = { defaultDevRoots };
