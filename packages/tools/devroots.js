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
  const homeRoots = names.map((n) => path.join(home, n));

  // Drive-root dev folders are very common on Windows (e.g. C:\dev, C:\src) and
  // live OUTSIDE the home folder, so the home-only list used to miss them
  // entirely. We add specific subfolders of the system drive — never the drive
  // root itself, which would drag the scan through Windows\ and Program Files\.
  let driveRoots = [];
  if (process.platform === 'win32') {
    const sysDrive = process.env.SystemDrive || 'C:';
    const driveNames = ['dev', 'Dev', 'code', 'Code', 'src', 'source', 'projects', 'Projects', 'repos', 'Repos', 'git', 'workspace', 'work'];
    driveRoots = driveNames.map((n) => path.join(sysDrive + path.sep, n));
  }

  // De-dupe while preserving order.
  return [...new Set([...homeRoots, ...driveRoots])];
}

module.exports = { defaultDevRoots };
