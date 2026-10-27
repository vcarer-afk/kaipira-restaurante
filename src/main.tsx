import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator && (process.env.NODE_ENV === 'production' || import.meta.env.PROD)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('Service Worker falhou:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
