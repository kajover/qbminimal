// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { applyDisplayOptions, displayOption, setDisplayOption } from './displayOptions'

describe('display options', () => {
  afterEach(() => {
    setDisplayOption('tabLabels', true)
    setDisplayOption('headerSpeeds', false)
    setDisplayOption('menuBar', false)
  })

  it('starts from the defaults and marks nothing', () => {
    expect(displayOption('tabLabels')).toBe(true)
    expect(displayOption('headerSpeeds')).toBe(false)
    expect(displayOption('menuBar')).toBe(false)
    applyDisplayOptions()
    expect(document.documentElement.hasAttribute('data-tab-labels')).toBe(false)
    expect(document.documentElement.hasAttribute('data-header-speeds')).toBe(false)
    expect(document.documentElement.hasAttribute('data-menu-bar')).toBe(false)
  })

  it('remembers a change and marks the page', () => {
    setDisplayOption('tabLabels', false)
    setDisplayOption('headerSpeeds', true)
    expect(displayOption('tabLabels')).toBe(false)
    expect(displayOption('headerSpeeds')).toBe(true)
    expect(document.documentElement.getAttribute('data-tab-labels')).toBe('off')
    expect(document.documentElement.getAttribute('data-header-speeds')).toBe('on')
  })

  it('forgets a choice set back to its default', () => {
    setDisplayOption('menuBar', true)
    setDisplayOption('menuBar', false)
    expect(localStorage.getItem('qbminimal.menuBar')).toBeNull()
    expect(document.documentElement.hasAttribute('data-menu-bar')).toBe(false)
  })
})
