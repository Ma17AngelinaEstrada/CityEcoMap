import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registers the service worker so the app becomes installable (PWA).
// This is what makes "Add to Home Screen" / "Install" available in
// supported browsers, and lets the app work offline for cached assets.
serviceWorkerRegistration.register();

reportWebVitals();