import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AdminApp from './AdminApp.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <BrowserRouter>
                <AdminApp />
            </BrowserRouter>
        </ErrorBoundary>
    </React.StrictMode>,
)
