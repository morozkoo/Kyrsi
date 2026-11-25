import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './AppApi.jsx'
import CurrencyChat from './CurrencyChat.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <CurrencyChat />
  </StrictMode>,
)
