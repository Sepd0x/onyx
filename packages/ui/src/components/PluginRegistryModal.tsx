import { Blocks, BadgeCheck, Users, ShieldCheck, ExternalLink, AlertTriangle, Loader2, Check, Download } from 'lucide-react';
import { CH } from '../ipc';
import Skeleton from './Skeleton';
import { describePermission, RISK_CLASS } from '../lib/pluginPermissions';

// In-app registry browser — the available plugins from the curated registry, so you can
// install without leaving the app. "Add" downloads + signature-verifies the bundle in the
// main process, then the normal consent modal opens. Nothing here runs plugin code.

export interface RegistryPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: { handle: string; url: string };
  official: boolean;
  permissions: string[];
  installed?: boolean;
}

export default function PluginRegistryModal({
  plugins,
  error,
  busyId,
  onAdd,
  onClose,
  onRetry,
}: {
  plugins: RegistryPlugin[] | null; // null = loading
  error: string | null;
  busyId: string | null;
  onAdd: (id: string) => void;
  onClose: () => void;
  onRetry: () => void;
}) {
  const openExternal = () => window.api?.invoke(CH.windowOpenExternal, 'https://github.com/Sepd0x/onyx-plugins');

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={busyId ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Browse the plugin registry"
    >
      <div
        className="bg-surface border border-border2 rounded-2xl shadow-2xl w-[560px] max-w-[94vw] max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-border">
          <span className="p-2 rounded-xl border border-primary/20 bg-primary/10 text-accent shrink-0">
            <Blocks className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-text">Plugin registry</h3>
            <p className="text-[11px] text-muted mt-0.5 leading-relaxed flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-success shrink-0" /> Every plugin is reviewed and signed by Onyx before it's listed.
            </p>
          </div>
          <button onClick={openExternal} className="flex items-center gap-1.5 text-[11px] font-medium text-muted2 hover:text-text transition-colors shrink-0">
            <ExternalLink className="w-3 h-3" /> GitHub
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto custom-scrollbar">
          {error ? (
            <div className="flex flex-col items-center text-center gap-3 py-8">
              <AlertTriangle className="w-6 h-6 text-danger" />
              <p className="text-[12px] text-muted">{error}</p>
              <button onClick={onRetry} className="text-[12px] font-medium px-3 py-1.5 rounded-lg border border-border2 bg-surface2/40 text-text hover:bg-surface2 transition-colors">
                Try again
              </button>
            </div>
          ) : plugins === null ? (
            <div className="space-y-2.5">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : plugins.length === 0 ? (
            <p className="text-[12px] text-muted text-center py-8">No plugins in the registry yet.</p>
          ) : (
            <div className="space-y-2.5">
              {plugins.map((p) => (
                <div key={p.id} className="rounded-xl border border-border bg-surface/40 p-3.5">
                  <div className="flex items-start gap-3">
                    <span className="p-2 rounded-lg border border-primary/20 bg-primary/10 text-accent shrink-0">
                      <Blocks className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-[13px] font-semibold text-text truncate">{p.name}</h4>
                        <span className="text-[9px] font-mono text-muted2">v{p.version}</span>
                        {p.official ? (
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-mono font-bold tracking-wide text-accent bg-primary/10 border border-primary/20 rounded px-1 py-0.5">
                            <BadgeCheck className="w-2.5 h-2.5" /> OFFICIAL
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-mono font-bold tracking-wide text-muted2 bg-surface3/60 border border-border rounded px-1 py-0.5">
                            <Users className="w-2.5 h-2.5" /> COMMUNITY
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted mt-1 leading-relaxed">{p.description}</p>
                      {p.permissions.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-2">
                          {p.permissions.map((perm) => {
                            const { label, risk } = describePermission(perm);
                            return <span key={perm} className={`text-[9px] rounded border px-1 py-0.5 ${RISK_CLASS[risk]}`} title={label}>{label}</span>;
                          })}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {p.installed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-success bg-success/10 border border-success/25 rounded-lg px-2.5 py-1.5">
                          <Check className="w-3.5 h-3.5" /> Installed
                        </span>
                      ) : (
                        <button
                          onClick={() => onAdd(p.id)}
                          disabled={!!busyId}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-primary/20 text-accent border border-primary/30 hover:bg-primary/30 transition-colors disabled:opacity-50"
                        >
                          {busyId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          {busyId === p.id ? 'Verifying…' : 'Add'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end p-4 border-t border-border">
          <button onClick={onClose} disabled={!!busyId} className="px-4 py-2 text-[11px] font-mono font-bold tracking-widest text-muted2 hover:text-text bg-surface2 border border-border rounded-lg transition-colors disabled:opacity-50">
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
