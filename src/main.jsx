import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/shell.css';
import './styles/auth.css';
import './styles/track.css';
import './styles/table.css';
import './styles/drawer.css';
import './styles/calendar.css';
import './styles/admin.css';
import './styles/banner.css';
import './styles/dashboard.css';
import App from './App.jsx';

const root = createRoot(document.getElementById('root'));

if (import.meta.env.MODE === 'mock') {
  // `npm run mock`: dev-only preview with fake data. This branch is removed from production builds.
  import('./dev/mock/MockApp.jsx').then(({ MockApp }) =>
    root.render(
      <StrictMode>
        <MockApp />
      </StrictMode>,
    ),
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
