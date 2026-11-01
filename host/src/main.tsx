import React from 'react';
import ReactDOM from 'react-dom/client';
import { HostAppShell } from './components/HostAppShell';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HostAppShell />
  </React.StrictMode>
);

