// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { applyDisplayOptions, displayOption, setDisplayOption } from './displayOptions'

describe('display options', () => {
  afterEach(() => {
    setDisplayOption('tabLabels', true)
    setDisplayOption('speedLimitButton', true)
  })

  it('starts from the defaults and marks nothing', () => {
    expect(displayOption('tabLabels')).toBe(true)
    expect(displayOption('speedLimitButton')).toBe(true)
    applyDisplayOptions()
    expect(document.documentElement.hasAttribute('data-tab-labels')).toBe(false)
    expect(document.documentElement.hasAttribute('data-speed-limit-button')).toBe(false)
  })

  it('remembers a change and marks the page', () => {
    setDisplayOption('tabLabels', false)
    setDisplayOption('speedLimitButton', false)
    expect(displayOption('tabLabels')).toBe(false)
    expect(document.documentElement.getAttribute('data-tab-labels')).toBe('off')
    expect(document.documentElement.getAttribute('data-speed-limit-button')).toBe('off')
  })

  it('forgets a choice set back to its default', () => {
    setDisplayOption('headerSpeeds', false)
    setDisplayOption('headerSpeeds', true)
    expect(localStorage.getItem('qbminimal.headerSpeeds')).toBeNull()
    expect(document.documentElement.hasAttribute('data-header-speeds')).toBe(false)
  })
})
