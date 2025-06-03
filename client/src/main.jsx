// /home/christian/gpt-quiz-app/client/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx'; // Ensure NAMED import
import './index.css'; // Or your main CSS file

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider> {/* AuthProvider MUST wrap App */}
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
