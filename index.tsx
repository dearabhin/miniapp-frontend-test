
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { Buffer } from 'buffer';

// Fix: Augment the Window interface to include the 'Buffer' property.
declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}

// Polyfill Buffer for TON SDK
window.Buffer = Buffer;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Use a public manifest from the reactjs-template as a placeholder
const manifestUrl = 'https://raw.githubusercontent.com/Telegram-Mini-Apps/reactjs-template/main/public/tonconnect-manifest.json';

root.render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <App />
    </TonConnectUIProvider>
  </React.StrictMode>
);