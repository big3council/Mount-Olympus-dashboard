import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import OlympusDashboard from './OlympusDashboard.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <OlympusDashboard />
  </StrictMode>
);
