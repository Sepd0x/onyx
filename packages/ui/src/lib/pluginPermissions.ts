// Display mirror of the closed capability catalog in packages/core/src/plugins/permissions.js.
// The main process is the source of truth (it gates what a plugin can actually do); this
// renderer copy only supplies human labels + risk tiers for the Extensions consent UI.
// Keep the keys in sync with the core catalog — a stray key here just renders as itself.

export type PermRisk = 'low' | 'medium' | 'high';

export const PLUGIN_PERMISSIONS: Record<string, { label: string; risk: PermRisk }> = {
  'config:read': { label: 'Read your Onyx settings (theme, toggles)', risk: 'low' },
  'notify': { label: 'Show desktop notifications', risk: 'low' },
  'clipboard:read': { label: 'Read your clipboard history', risk: 'medium' },
  'shell:open': { label: 'Open links and files in your default apps', risk: 'medium' },
  'net:fetch': { label: 'Make outbound network requests', risk: 'high' },
  'fs:read': { label: 'Read files and folders you pick', risk: 'high' },
};

export function describePermission(key: string): { label: string; risk: PermRisk } {
  return PLUGIN_PERMISSIONS[key] || { label: key, risk: 'low' };
}

export const RISK_CLASS: Record<PermRisk, string> = {
  low: 'text-muted bg-surface3/60 border-border',
  medium: 'text-warning bg-warning/10 border-warning/25',
  high: 'text-danger bg-danger/10 border-danger/25',
};
