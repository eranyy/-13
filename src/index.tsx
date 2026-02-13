import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // השורה הזו מחברת את העיצוב לאתר

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
