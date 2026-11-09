// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { applyTextSize, chosenTextSize, setTextSize } from './textSize'

describe('text size', () => {
  afterEach(() => setTextSize('default'))

  it('defaults to the browser size', () => {
    expect(chosenTextSize()).toBe('default')
    applyTextSize()
    expect(document.documentElement.style.fontSize).toBe('')
  })

  it('remembers and applies a choice', () => {
    setTextSize('large')
    expect(chosenTextSize()).toBe('large')
    expect(document.documentElement.style.fontSize).toBe('112.5%')
  })

  it('ignores an unknown stored value', () => {
    localStorage.setItem('qbminimal.textSize', 'huge')
    expect(chosenTextSize()).toBe('default')
  })
})
