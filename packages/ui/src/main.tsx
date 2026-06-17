import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import './index.css'
import { injectMockApi } from './mockApi'
import { applyAccent } from './lib/accents'

injectMockApi();

// Catch what the React ErrorBoundary can't: async / event-handler errors and
// unhandled promise rejections (e.g. the onboarding's async IPC handlers). Persist
// them to the main log so a crash report leaves a trace. Best-effort, never throws.
const logClient = (message: string, meta: Record<string, unknown>) => {
  try { (window as any).api?.invoke('app:log', { level: 'error', message, meta }); } catch {}
};
window.addEventListener('error', (e) => {
  logClient('window error: ' + String(e?.message || e), { stack: String((e?.error as any)?.stack || '').slice(0, 1000) });
});
window.addEventListener('unhandledrejection', (e) => {
  const r: any = (e as PromiseRejectionEvent)?.reason;
  logClient('unhandled rejection: ' + String(r?.message || r), { stack: String(r?.stack || '').slice(0, 1000) });
});

// Apply the saved theme + accent before first paint (#30): the config arrives
// async over IPC, so a synchronous localStorage mirror avoids the Midnight
// flash. Covers both windows (main + tray) — they share this entry point.
document.documentElement.setAttribute('data-theme', localStorage.getItem('onyx-theme') || 'midnight');
applyAccent(localStorage.getItem('onyx-accent') || undefined);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
