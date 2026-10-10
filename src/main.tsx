import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import { initApp } from './state/init';
import './ui/styles.css';

const root = createRoot(document.getElementById('root')!);
root.render(<p className="boot">Loading…</p>);

initApp().then(
  () => root.render(<StrictMode><App /></StrictMode>),
  (e: unknown) => root.render(
    <p className="boot boot-error">Could not open storage: {e instanceof Error ? e.message : String(e)}</p>,
  ),
);
