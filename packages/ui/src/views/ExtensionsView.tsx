import { useState } from 'react';
import { Blocks, BadgeCheck, ShieldCheck, Trash2, ExternalLink, AlertTriangle, Users, FolderOpen, ShieldAlert } from 'lucide-react';
import ViewHeader from '../components/ViewHeader';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import Switch from '../components/Switch';
import PluginConsentModal, { type PluginPreview } from '../components/PluginConsentModal';
import PluginRegistryModal, { type RegistryPlugin } from '../components/PluginRegistryModal';
import { CH } from '../ipc';
import { useIpc, invalidate } from '../lib/ipcCache';
import { describePermission, RISK_CLASS } from '../lib/pluginPermissions';

// Extensions — the catalog for the Fase 2 plugin system. Every plugin shown here has
// already passed signature verification in the main process (an unsigned/tampered bundle
// never reaches this list), so the story we tell the user is "installed = verified". Each
// card credits its author, declares exactly which capabilities it was granted, and can be
// toggled or removed. The renderer never reaches plugin code except through plugin:invoke.

interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: { handle: string; url: string };
  official: boolean;
  permissions: string[];
  channels: string[];
  granted: string[];
  enabled: boolean;
  error: string | null;
  revoked?: boolean;
}

export default function ExtensionsView() {
  const { data, ts } = useIpc<Plugin[]>(CH.pluginList, [], { pollMs: 0 });
  const plugins = data ?? [];
  const loading = ts === 0;
  const [confirming, setConfirming] = useState<string | null>(null);
  const [preview, setPreview] = useState<PluginPreview | null>(null);
  const [installing, setInstalling] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  // In-app registry browser.
  const [registryOpen, setRegistryOpen] = useState(false);
  const [registry, setRegistry] = useState<RegistryPlugin[] | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registryBusy, setRegistryBusy] = useState<string | null>(null);

  const setEnabled = async (id: string, enabled: boolean) => {
    await window.api?.invoke(CH.pluginSetEnabled, { id, enabled });
    invalidate('plugin:');
  };

  // Step 1 — pick a folder; the main process verifies the signature before returning a
  // preview. A cancel is silent; a verification failure surfaces as an inline error.
  const pickBundle = async () => {
    setPickError(null);
    const res = await window.api?.invoke<{ ok: boolean; canceled?: boolean; error?: string; preview?: PluginPreview }>(
      CH.pluginPickBundle,
    );
    if (!res || res.canceled) return;
    if (!res.ok || !res.preview) { setPickError(res?.error || 'That folder is not a valid signed plugin.'); return; }
    setPreview(res.preview);
  };

  // Step 2 — the user consented in the modal; commit the install with the granted set.
  const confirmInstall = async (granted: string[]) => {
    if (!preview) return;
    setInstalling(true);
    const res = await window.api?.invoke<{ ok: boolean; error?: string }>(CH.pluginInstall, { id: preview.id, granted });
    setInstalling(false);
    if (!res?.ok) { setPickError(res?.error || 'Install failed.'); setPreview(null); return; }
    const name = preview.name;
    setPreview(null);
    invalidate('plugin:');
    await window.api?.invoke(CH.appNotify, { title: 'Extension installed', body: `${name} is ready.` });
  };

  const uninstall = async (id: string) => {
    await window.api?.invoke(CH.pluginUninstall, { id });
    setConfirming(null);
    invalidate('plugin:');
  };

  // Open the in-app registry browser and (re)load the available plugins.
  const fetchRegistry = async () => {
    setRegistry(null);
    setRegistryError(null);
    const res = await window.api?.invoke<{ ok: boolean; error?: string; plugins?: RegistryPlugin[] }>(CH.pluginRegistryList);
    if (!res?.ok) { setRegistryError(res?.error || "Couldn't reach the registry."); setRegistry([]); return; }
    setRegistry(res.plugins ?? []);
  };
  const openRegistryBrowser = () => { setRegistryOpen(true); fetchRegistry(); };

  // Add from the registry → download + verify in main → open the consent modal.
  const addFromRegistry = async (id: string) => {
    setRegistryBusy(id);
    const res = await window.api?.invoke<{ ok: boolean; error?: string; preview?: PluginPreview }>(CH.pluginRegistryPreview, { id });
    setRegistryBusy(null);
    if (!res?.ok || !res.preview) { setRegistryError(res?.error || "Couldn't download that plugin."); return; }
    setRegistryOpen(false);
    setPreview(res.preview); // consent modal; confirmInstall commits via plugin:install
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <ViewHeader
        icon={Blocks}
        title="Extensions"
        subtitle="Signed · curated · capability-scoped"
        badge={
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold tracking-wide text-success bg-success/10 border border-success/25 rounded px-1.5 py-0.5">
            <ShieldCheck className="w-3 h-3" /> VERIFIED
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={pickBundle}
              className="flex items-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-border2 bg-surface2/40 text-text hover:bg-surface2 transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" /> Install from file
            </button>
            <button
              onClick={openRegistryBrowser}
              className="flex items-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/20 text-accent hover:bg-primary/30 transition-colors"
            >
              <Blocks className="w-3.5 h-3.5" /> Browse registry
            </button>
          </div>
        }
      />

      {pickError && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-danger/30 bg-danger/10 text-[12px] text-danger animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{pickError}</span>
          <button onClick={() => setPickError(null)} className="ml-auto text-[11px] font-mono text-danger/70 hover:text-danger shrink-0">DISMISS</button>
        </div>
      )}

      {/* Trust note — the brand promise, stated plainly. */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface/40">
        <ShieldCheck className="w-4 h-4 text-success shrink-0 mt-0.5" />
        <p className="text-[12px] text-muted leading-relaxed">
          Onyx only runs plugins <span className="text-text">reviewed and signed by the Onyx key</span> — an
          unsigned or tampered one is rejected before any of its code runs. That review is the real
          guarantee; the capabilities on each card are what the plugin <span className="text-text">declares
          it uses</span>, shown up front so there are no surprises.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : plugins.length === 0 ? (
        <EmptyState
          icon={Blocks}
          title="No extensions installed"
          description="Browse the curated registry to add signed plugins. Every one is reviewed and credited to its author."
        >
          <div className="flex items-center gap-2">
            <button onClick={pickBundle} className="flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-lg border border-border2 bg-surface2/40 text-text hover:bg-surface2 transition-colors">
              <FolderOpen className="w-4 h-4" /> Install from file
            </button>
            <button onClick={openRegistryBrowser} className="flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-lg bg-primary/20 text-accent border border-primary/30 hover:bg-primary/30 transition-colors">
              <Blocks className="w-4 h-4" /> Browse registry
            </button>
          </div>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {plugins.map((p, idx) => (
            <div
              key={p.id}
              style={{ animationDelay: `${idx * 40}ms` }}
              className="rounded-xl border border-border bg-surface/40 p-4 card-lift animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards"
            >
              <div className="flex items-start gap-4">
                <span className="p-2 rounded-lg border border-primary/20 bg-primary/10 text-accent shrink-0">
                  <Blocks className="w-5 h-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-semibold text-text">{p.name}</h3>
                    <span className="text-[10px] font-mono text-muted2">v{p.version}</span>
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

                  <p className="text-[12px] text-muted mt-1 leading-relaxed">{p.description}</p>

                  {/* Author credit — real recognition, links out to the author. */}
                  <button
                    onClick={() => window.api?.invoke(CH.windowOpenExternal, p.author.url)}
                    className="inline-flex items-center gap-1 text-[10px] font-mono text-muted/70 hover:text-accent transition-colors mt-1.5"
                  >
                    by {p.author.handle} <ExternalLink className="w-2.5 h-2.5" />
                  </button>

                  {p.revoked ? (
                    <div className="flex items-start gap-1.5 text-[11px] text-danger mt-2 bg-danger/10 border border-danger/25 rounded-md px-2 py-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
                      <span><span className="font-semibold">Revoked</span> — Onyx disabled this plugin for your safety. Remove it below.</span>
                    </div>
                  ) : p.error && (
                    <div className="flex items-center gap-1.5 text-[11px] text-danger mt-2">
                      <AlertTriangle className="w-3 h-3" /> Failed to activate — disabled.
                    </div>
                  )}

                  {/* Granted capabilities — exactly what this plugin can touch. */}
                  {p.granted.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      <span className="micro-label !text-[9px] mr-0.5">Can</span>
                      {p.granted.map((perm) => {
                        const { label, risk } = describePermission(perm);
                        return (
                          <span key={perm} className={`text-[10px] rounded-md border px-1.5 py-0.5 ${RISK_CLASS[risk]}`} title={`Risk: ${risk}`}>
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="flex flex-col items-end gap-3 shrink-0">
                  {p.revoked ? (
                    <span className="text-[9px] font-mono font-bold tracking-wide text-danger bg-danger/10 border border-danger/25 rounded px-1.5 py-1">REVOKED</span>
                  ) : (
                    <Switch active={p.enabled} onClick={() => setEnabled(p.id, !p.enabled)} label={`Toggle ${p.name}`} />
                  )}
                  {confirming === p.id ? (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => uninstall(p.id)} className="text-[10px] font-medium px-2 py-1 rounded-md bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-colors">
                        Confirm
                      </button>
                      <button onClick={() => setConfirming(null)} className="text-[10px] font-medium px-2 py-1 rounded-md border border-border text-muted hover:text-text transition-colors">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirming(p.id)}
                      aria-label={`Uninstall ${p.name}`}
                      className="flex items-center gap-1 text-[11px] text-muted hover:text-danger transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {registryOpen && (
        <PluginRegistryModal
          plugins={registry}
          error={registryError}
          busyId={registryBusy}
          onAdd={addFromRegistry}
          onClose={() => setRegistryOpen(false)}
          onRetry={fetchRegistry}
        />
      )}

      {preview && (
        <PluginConsentModal
          preview={preview}
          busy={installing}
          onCancel={() => setPreview(null)}
          onConfirm={confirmInstall}
        />
      )}
    </div>
  );
}
