import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { BranchProvider } from './BranchContext';
import './index.css';
import './App.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <BranchProvider>
        <App />
      </BranchProvider>
    </BrowserRouter>
  </StrictMode>
);