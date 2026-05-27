import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Missing #root element.');
}

function loadRuntimeConfig(): Promise<void> {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = new URL('config.js', window.location.href).toString();
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

void loadRuntimeConfig().then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
