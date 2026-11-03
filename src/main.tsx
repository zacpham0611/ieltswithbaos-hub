import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProvider } from './context/AppContext';
import { SeasonalThemeProvider } from './theme/SeasonalThemeContext';
import { AppContent } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <SeasonalThemeProvider>
        <AppContent />
      </SeasonalThemeProvider>
    </AppProvider>
  </React.StrictMode>
);
