// Pure, dependency-free helpers extracted from dev-watcher so they can be
// unit-tested without spawning PowerShell or Electron.

// Parses the JSON emitted by:
//   Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json
// CommandLine is null for system/protected processes; the -InputObject @(...)
// wrapper used by the caller guarantees an array, but a bare object is
// tolerated for robustness.
// Returns null when the payload is not valid JSON (so the caller can log a
// parse failure instead of conflating it with "no processes").
function parseWinProcessJson(stdout) {
  if (typeof stdout !== 'string' || !stdout.trim()) return [];
  let data;
  try {
    data = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (!Array.isArray(data)) data = data ? [data] : [];
  const out = [];
  for (const p of data) {
    if (!p || p.ProcessId == null || !p.Name) continue;
    out.push({
      pid: String(p.ProcessId),
      name: String(p.Name),
      command: p.CommandLine == null ? '' : String(p.CommandLine),
    });
  }
  return out;
}

// Parses `ps -A -o pid,comm,args` output (first line is the header).
function parsePosixPs(stdout) {
  if (typeof stdout !== 'string' || !stdout.trim()) return [];
  const out = [];
  const lines = stdout.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const [pid, name, ...rest] = parts;
    if (!/^[0-9]+$/.test(pid)) continue;
    out.push({ pid, name, command: rest.join(' ') });
  }
  return out;
}

// Heuristic dev-process score over a lowercased name + command line.
// Weights are unchanged from the original implementation.
function scoreDevProcess(pName, cmdLine) {
  let score = 0;
  if (pName.includes('node') || cmdLine.includes('node_modules')) score += 0.4;
  if (pName.includes('python') || cmdLine.includes('venv') || cmdLine.includes('.py')) score += 0.4;
  if (cmdLine.includes('--inspect') || cmdLine.includes('-dev')) score += 0.3;
  if (pName.includes('docker') || pName.includes('containerd')) score += 0.35;
  if (cmdLine.includes('build') || cmdLine.includes('start') || cmdLine.includes('run')) score += 0.2;
  if (cmdLine.includes('vite') || cmdLine.includes('webpack') || cmdLine.includes('esbuild')) score += 0.45;
  if (pName.includes('code') || pName.includes('cursor')) score += 0.45;
  if (pName.includes('ollama') || pName.includes('llama') || cmdLine.includes('model')) score += 0.5;
  if (pName.includes('rustc') || pName.includes('cargo')) score += 0.45;
  // Separator-agnostic so Windows back-slash paths score too.
  if (cmdLine.match(/[\\/][a-z0-9_-]+[\\/]src[\\/]/i)) score += 0.15;
  if (cmdLine.includes('localhost') || cmdLine.includes('127.0.0.1')) score += 0.25;
  return score;
}

// Maps raw {pid, name, command} entries to the IPC return shape, keeping only
// likely dev processes and deduplicating by pid.
function extractDevProcesses(list) {
  const procs = [];
  const seen = new Set();
  for (const { pid, name, command } of list) {
    if (!pid || !name || seen.has(pid)) continue;
    const pName = name.toLowerCase();
    const cmdLine = (command || '').toLowerCase();
    const confidence = scoreDevProcess(pName, cmdLine);
    if (confidence < 0.35) continue;
    seen.add(pid);
    procs.push({
      pid,
      name: pName,
      type: pName.replace('.exe', ''),
      confidence: Math.min(99, Math.round(confidence * 100)) + '%',
    });
  }
  return procs;
}

module.exports = { parseWinProcessJson, parsePosixPs, scoreDevProcess, extractDevProcesses };
