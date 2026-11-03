import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth';
import { Shell } from './Shell';
import './styles.css';
import './app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Shell />
    </AuthProvider>
  </StrictMode>,
);
