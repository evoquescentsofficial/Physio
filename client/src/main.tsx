import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { IS_DEMO } from './api/client';
import './index.css';

// The demo is a single file opened from disk or served under a sub-path, where real
// URL paths don't resolve — hash routing keeps navigation working in both cases.
const Router = IS_DEMO ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <AuthProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </AuthProvider>
    </Router>
  </React.StrictMode>
);
