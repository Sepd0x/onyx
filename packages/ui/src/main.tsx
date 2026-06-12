import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import './index.css'
import { injectMockApi } from './mockApi'

injectMockApi();

// Apply the saved theme before first paint (#30): the config arrives async
// over IPC, so a synchronous localStorage mirror avoids the Midnight flash.
// Covers both windows (main + tray) — they share this entry point.
document.documentElement.setAttribute('data-theme', localStorage.getItem('onyx-theme') || 'midnight');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
