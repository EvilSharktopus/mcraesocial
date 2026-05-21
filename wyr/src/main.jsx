import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import WouldYouRatherBracket from './WouldYouRatherBracket.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WouldYouRatherBracket />
  </StrictMode>
);
