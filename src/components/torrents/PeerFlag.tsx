import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill'
import fontUrl from 'country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2?url'
import { countryFlag, FLAG_FONT_FAMILY } from '@/lib/flags'

// Only browsers without flag emoji, like Chrome on Windows, load the bundled font, and only once.
let polyfilled = false
function ensureFlagFont() {
  if (polyfilled || typeof document === 'undefined') return
  polyfilled = true
  try {
    polyfillCountryFlagEmojis('Twemoji Country Flags', fontUrl)
  } catch {
    // Without the font, Windows shows the two letters instead, which still says where the peer is.
  }
}

export function PeerFlag({ code, country }: { code?: string; country?: string }) {
  ensureFlagFont()
  const flag = countryFlag(code)
  if (!flag) return null
  // Its own layer: without one, iPhone Safari paints the text beside a flag in the flag's colors.
  return (
    <span role="img" aria-label={country || code?.toUpperCase()} title={country || code?.toUpperCase()} className="inline-block w-5 flex-shrink-0 text-center text-base leading-none [transform:translateZ(0)]" style={{ fontFamily: FLAG_FONT_FAMILY }}>
      {flag}
    </span>
  )
}
