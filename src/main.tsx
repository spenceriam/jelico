import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { initArtifactListeners } from './stores/artifacts'

// Initialize global listeners for sub-agent artifacts
initArtifactListeners()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
