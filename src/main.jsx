import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App.jsx'
import './shared/styles/index.css'
import { Analytics } from "@vercel/analytics/react"
import ErrorBoundary from './shared/components/ErrorBoundary.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
    <Analytics />
  </React.StrictMode>,
)
