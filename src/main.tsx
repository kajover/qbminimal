import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { startTheme } from './lib/theme'
import { loadLanguage } from './i18n'
import { readMagnetFromAddress, sendToAdd } from './lib/incoming'
import { applyTextSize } from './lib/textSize'
import { applyDisplayOptions } from './lib/displayOptions'
import './index.css'

// Opened by the browser for a magnet link: it goes to the Add page, and off the address.
const magnet = readMagnetFromAddress(window.location)
if (magnet) {
  sendToAdd({ links: [magnet] })
  window.history.replaceState(null, '', window.location.pathname)
}

// Safari 17.4 and newer have a native iOS switch; elsewhere index.css draws one.
if ('switch' in HTMLInputElement.prototype) document.documentElement.classList.add('native-switch')

// iPhone and iPad: Safari zooms the page in when a field under 16px gets focus, and the zoom stays
// afterwards. A maximum scale stops that, so fields keep the app's 14px; iOS still lets people
// pinch to zoom. Other systems would block pinch zoom with it, so it is set on iOS only.
if (CSS.supports('-webkit-touch-callout', 'none')) {
  const viewport = document.querySelector('meta[name="viewport"]')
  viewport?.setAttribute('content', `${viewport.getAttribute('content')}, maximum-scale=1`)
}

// The theme, text size and other looks chosen in Settings apply before anything is drawn.
startTheme()
applyTextSize()
applyDisplayOptions()

const root = document.getElementById('root')
if (!root) throw new Error('index.html needs a #root element')

// The language loads before the app's own modules, so all their text comes out translated.
void loadLanguage()
  .then(() => import('./App'))
  .then(({ default: App }) => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
