import { Blocks, BadgeCheck, Users, ShieldCheck, ExternalLink, AlertTriangle } from 'lucide-react';
import { CH } from '../ipc';
import { describePermission, RISK_CLASS, type PermRisk } from '../lib/pluginPermissions';

// Install-time permission consent — the gate between a verified bundle and it running. By
// the time this opens, the main process has already signature-checked the bundle (an
// unsigned/tampered one never gets here), so the trust story is "verified · and here is
// exactly what it can touch". The user approves the full declared capability set or cancels;
// the backend never grants more than what's listed below.

export interface PluginPreview {
  id: string;
  name: string;
  version: string;
  description: string;
  author: { handle: string; url: string };
  official: boolean;
  permissions: string[];
  channels: string[];
  alreadyInstalled?: boolean;
}

const RISK_ORDER: Record<PermRisk, number> = { low: 0, medium: 1, high: 2 };

export default function PluginConsentModal({
  preview,
  busy,
  onCancel,
  onConfirm,
}: {
  preview: PluginPreview;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (granted: string[]) => void;
}) {
  // Show the scariest capabilities first so the riskiest asks are never buried.
  const perms = [...preview.permissions].sort(
    (a, b) => RISK_ORDER[describePermission(b).risk] - RISK_ORDER[describePermission(a).risk],
  );

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={busy ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={`Install ${preview.name}`}
    >
      <div
        className="bg-surface border border-border2 rounded-2xl shadow-2xl w-[440px] max-w-[92vw] p-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Identity */}
        <div className="flex items-start gap-3">
          <span className="p-2.5 rounded-xl border border-primary/20 bg-primary/10 text-accent shrink-0">
            <Blocks className="w-6 h-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[16px] font-semibold text-text truncate">{preview.name}</h3>
              <span className="text-[10px] font-mono text-muted2">v{preview.version}</span>
              {preview.official ? (
                <span className="inline-flex items-center gap-0.5 text-[8px] font-mono font-bold tracking-wide text-accent bg-primary/10 border border-primary/20 rounded px-1 py-0.5">
                  <BadgeCheck className="w-2.5 h-2.5" /> OFFICIAL
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[8px] font-mono font-bold tracking-wide text-muted2 bg-surface3/60 border border-border rounded px-1 py-0.5">
                  <Users className="w-2.5 h-2.5" /> COMMUNITY
                </span>
              )}
            </div>
            {preview.description && (
              <p className="text-[12px] text-muted mt-1 leading-relaxed">{preview.description}</p>
            )}
            <button
              onClick={() => window.api?.invoke(CH.windowOpenExternal, preview.author.url)}
              className="inline-flex items-center gap-1 text-[10px] font-mono text-muted/70 hover:text-accent transition-colors mt-1.5"
            >
              by {preview.author.handle} <ExternalLink className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {/* Verified trust line */}
        <div className="flex items-center gap-2 mt-4 text-[11px] text-success">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>Signature verified — signed by the Onyx key.</span>
        </div>

        {/* The consent itself */}
        <div className="mt-4 rounded-xl border border-border bg-surface/40 p-4">
          <span className="micro-label">{perms.length > 0 ? 'This extension will be able to' : 'Capabilities'}</span>
          {perms.length === 0 ? (
            <p className="text-[12px] text-muted mt-2 leading-relaxed">
              Runs with <span className="text-text">no special capabilities</span> — it can't read your data,
              network, or files.
            </p>
          ) : (
            <ul className="mt-2.5 space-y-1.5">
              {perms.map((perm) => {
                const { label, risk } = describePermission(perm);
                return (
                  <li key={perm} className="flex items-center gap-2.5">
                    <span className={`text-[9px] font-mono font-bold tracking-wide rounded px-1 py-0.5 border uppercase shrink-0 ${RISK_CLASS[risk]}`}>
                      {risk}
                    </span>
                    <span className="text-[12px] text-text leading-snug">{label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {preview.alreadyInstalled && (
          <div className="flex items-center gap-1.5 text-[11px] text-warning mt-3">
            <AlertTriangle className="w-3 h-3 shrink-0" /> Already installed — this replaces the current version.
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-[11px] font-mono font-bold tracking-widest text-muted2 hover:text-text bg-surface2 border border-border rounded-lg transition-colors disabled:opacity-50"
          >
            CANCEL
          </button>
          <button
            onClick={() => onConfirm(preview.permissions)}
            disabled={busy}
            className="px-4 py-2 text-[11px] font-mono font-bold tracking-widest text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
          >
            {busy ? 'INSTALLING…' : 'TRUST & INSTALL'}
          </button>
        </div>
      </div>
    </div>
  );
}
