import { Network, GitBranch, MousePointer2, ShieldAlert, Activity, TerminalSquare, Rocket, BrainCircuit, Zap, ClipboardList } from 'lucide-react';
import type { ComponentType } from 'react';

// Single source of truth for the user-toggleable tools (issue #28 MVP: the user
// picks which tools they want — the rest are hidden from the sidebar + command
// palette). Settings is intentionally NOT here: it can never be disabled.
// `requiresAI` tools also depend on the AI master switch (enableAIFeatures).
export type ToolDef = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  requiresAI?: boolean;
};

export const TOOLS: ToolDef[] = [
  { id: 'watcher', label: 'Session Guard', icon: ShieldAlert, description: 'Keep the machine awake while a task runs.' },
  { id: 'aiauditor', label: 'Inspector', icon: BrainCircuit, description: 'AI briefing, insights and log triage.', requiresAI: true },
  { id: 'cursor', label: 'Focus Mode', icon: MousePointer2, description: 'Auto-hide the cursor and reduce distractions.' },
  { id: 'ports', label: 'Port Mapper', icon: Network, description: 'See and free busy local ports.' },
  { id: 'git', label: 'Git Pulse', icon: GitBranch, description: 'Track local + GitHub repository activity.' },
  { id: 'cleaner', label: 'Dev Cleanser', icon: Activity, description: 'Reclaim space from build artifacts.' },
  { id: 'launchers', label: 'Launchers', icon: Rocket, description: 'One-click multi-command project starters.' },
  { id: 'snippets', label: 'Snippets', icon: TerminalSquare, description: 'Your reusable shell one-liners.' },
  { id: 'clipboard', label: 'Clipboard', icon: ClipboardList, description: 'Recent copies (text + images) you can re-copy.' },
  { id: 'power', label: 'OS Power Manager', icon: Zap, description: 'Windows power modes + battery health.' },
];

// A tool is active when not in the user's disabled list AND (if it needs AI) the
// AI master switch is on. config.disabledTools defaults to [] (everything on).
export function isToolEnabled(id: string, config: any): boolean {
  const disabled: string[] = Array.isArray(config?.disabledTools) ? config.disabledTools : [];
  if (disabled.includes(id)) return false;
  const def = TOOLS.find((t) => t.id === id);
  if (def?.requiresAI && (config?.enableAIFeatures ?? true) === false) return false;
  return true;
}
