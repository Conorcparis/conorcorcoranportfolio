import React from 'react';
import ReactDOM from 'react-dom/client';
import CVSearchAgent from './components/CVSearchAgent';

const root = ReactDOM.createRoot(document.getElementById('cv-search-root'));
root.render(
  <React.StrictMode>
    <CVSearchAgent />
  </React.StrictMode>
);