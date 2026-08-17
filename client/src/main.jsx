import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { DriverProvider } from './context/DriverContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <DriverProvider>
        <App />
      </DriverProvider>
    </AuthProvider>
  </React.StrictMode>,
)
