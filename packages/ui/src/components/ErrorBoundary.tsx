import { Component, type ReactNode } from 'react';

// Last-resort UI guard: if any view throws during render, show a recovery screen
// instead of a blank/vanished window (the "app crashed" symptom). Render errors
// in React aren't caught by the main-process crash guards, so this is the
// renderer-side net. Event-handler / async errors still won't land here.
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface it so it's not silent; best-effort, never throws.
    try { (window as any).api?.invoke('app:notify', { title: 'Onyx hit a UI error', body: String(error?.message || error).slice(0, 200) }); } catch {}
    try { console.error('[Onyx] render error:', error); } catch {}
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-5 bg-background text-center p-8 select-none">
          <div className="text-text2 text-lg font-semibold">Something went wrong</div>
          <p className="text-muted text-sm max-w-sm leading-relaxed">
            A view failed to load. Reloading usually fixes it. If it keeps happening, skip the step you were on and let us know what you were doing.
          </p>
          <pre className="text-[10px] font-mono text-muted/60 max-w-md max-h-24 overflow-auto whitespace-pre-wrap">{String(this.state.error?.message || this.state.error)}</pre>
          <button
            onClick={() => { this.setState({ error: null }); try { window.location.reload(); } catch {} }}
            className="px-4 py-2 rounded-lg bg-primary/15 text-accent border border-primary/25 hover:bg-primary/25 text-xs font-medium transition-colors"
          >
            Reload Onyx
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
