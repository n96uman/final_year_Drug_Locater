import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Root from './Root'

// Ensure tab icon uses drug_pic (bypasses stale favicon.svg cache)
{
  const href = '/favicon.png?v=2'
  let link = document.querySelector('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.type = 'image/png'
  link.href = href
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
