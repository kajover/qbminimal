import { readStored, writeStored } from './storage'

const TEXT_SIZE_KEY = 'qbminimal.textSize'

// Sizes are relative to the browser's own text size, so a larger default set there still counts.
// The whole layout is measured in rem, so spacing and icons grow along with the text.
export const TEXT_SIZES = [
  { value: 'small', scale: 0.875 },
  { value: 'default', scale: 1 },
  { value: 'large', scale: 1.125 },
  { value: 'larger', scale: 1.25 },
] as const

export type TextSize = (typeof TEXT_SIZES)[number]['value']

export function chosenTextSize(): TextSize {
  const stored = readStored(TEXT_SIZE_KEY)
  return TEXT_SIZES.find(size => size.value === stored)?.value ?? 'default'
}

// How much the chosen size enlarges the layout, for widths kept in pixels.
export function textScale() {
  return TEXT_SIZES.find(s => s.value === chosenTextSize())?.scale ?? 1
}

export function applyTextSize(size: TextSize = chosenTextSize()) {
  const scale = TEXT_SIZES.find(s => s.value === size)?.scale ?? 1
  document.documentElement.style.fontSize = scale === 1 ? '' : `${scale * 100}%`
  // index.css shrinks the title on narrow phones when the text around it is larger.
  if (size === 'default') delete document.documentElement.dataset.textSize
  else document.documentElement.dataset.textSize = size
}

export function setTextSize(size: TextSize) {
  writeStored(TEXT_SIZE_KEY, size === 'default' ? null : size)
  applyTextSize(size)
}
