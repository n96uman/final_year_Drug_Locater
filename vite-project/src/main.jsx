import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Root from './Root'
import faviconUrl from './assets/drug_pic.png'

function setFavicon(href) {
  const links = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')
  links.forEach((el) => el.remove())
  const icon = document.createElement('link')
  icon.rel = 'icon'
  icon.type = 'image/png'
  icon.href = href
  document.head.appendChild(icon)
  const shortcut = document.createElement('link')
  shortcut.rel = 'shortcut icon'
  shortcut.type = 'image/png'
  shortcut.href = href
  document.head.appendChild(shortcut)
}

setFavicon(faviconUrl)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
