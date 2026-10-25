import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { hydrate } from './lib/database';
import './index.css';
import './styles/theme.css';

// Restore accounts from IndexedDB / LocalStorage before the first render.
hydrate().finally(() => createRoot(document.getElementById('root')).render(<App />));
