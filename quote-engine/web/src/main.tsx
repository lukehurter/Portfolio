import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { applyTheme, readTheme } from './components/Theme';
import { AXIM_MARK } from './assets/logo';
import { AppProvider } from './state/app';
import './index.css';

/* The tab icon, set here rather than written into index.html.
   One source for the artwork — the generated logo.ts — instead of a second copy of a
   6 KB data URI pasted into the HTML, where it would go stale the next time the
   guidelines PDF is re-read and nothing would say so. */
/* Before React renders. A stored dark preference applied on mount means a white
   page for one frame, which is the thing dark mode exists to avoid. */
applyTheme(readTheme());

const icon = document.createElement('link');
icon.rel = 'icon';
icon.type = 'image/svg+xml';
icon.href = AXIM_MARK;
document.head.appendChild(icon);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outside the provider, so a crash in the provider itself is caught too. A
        white page is the one failure a rep cannot work around. */}
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
);
