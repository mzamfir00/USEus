import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { hydrate, retryPendingDeletions } from './lib/database';
import { installNativeShell } from './lib/platform';
import './index.css';
import './styles/theme.css';

// Restore accounts from IndexedDB / LocalStorage before the first render, then finish any
// account deletion that couldn't reach the cloud last time.
hydrate().finally(() => {
  createRoot(document.getElementById('root')).render(<App />);
  retryPendingDeletions();
  installNativeShell();
});
