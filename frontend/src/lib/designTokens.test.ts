// The design tokens against docs/UI_DESIGN_SYSTEM.md and WCAG 2.2 AA, read from the CSS the app actually ships. A token cannot quietly drift
// from the design system or fall below the contrast the design system asks for.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(import.meta.dirname, '../app/globals.css'), 'utf8')
const token = (name: string) => {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)
  if (!match) throw new Error(`no token ${name}`)
  return match[1].toLowerCase()
}
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('design-system colours', () => {
  it.each([
    ['primary-500', '#2c1971', '--color-primary'],
    ['primary-600', '#45239b', '--color-primary-hover'],
    ['secondary', '#7a67af', '--color-secondary'],
    ['primary-100', '#dfddf7', '--color-lavender'],
    ['canvas', '#f3f2fd', '--color-app-bg'],
    ['surface', '#ffffff', '--color-surface'],
    ['ink', '#171329', '--color-text'],
    ['subtle', '#77738c', '--color-text-muted (placeholders and icons)'],
    ['success', '#16a36a', '--color-success'],
    ['warning', '#f59e0b', '--color-warning'],
    ['danger', '#dc3545', '--color-danger'],
    ['info', '#2563eb', '--color-info'],
    ['navy-950', '#2c1971', 'sidebar'],
  ])('%s is %s (%s)', (name, hex) => {
    expect(token(name)).toBe(hex)
  })
})

describe('text contrast is at least 4.5:1', () => {
  it.each([
    ['body text on the page', 'ink', 'canvas'],
    ['body text on a card', 'ink', 'surface'],
    ['muted text on the page', 'muted', 'canvas'],
    ['muted text on a card', 'muted', 'surface'],
    ['placeholder on a field', 'subtle', 'surface'],
    ['sidebar label', 'white', 'navy-950'],
    ['active sidebar label', 'white', 'nav-active'],
    ['primary button', 'white', 'primary-500'],
    ['primary button on hover', 'white', 'primary-600'],
    ['danger button', 'white', 'danger'],
    ['secondary button', 'primary-500', 'surface'],
    ['link', 'primary-600', 'surface'],
    ['Expected badge', 'warning-600', 'warning-50'],
    ['Checked In and Issued badge', 'primary-700', 'primary-100'],
    ['Checked Out and Available badge', 'success-600', 'success-50'],
    ['VIP badge', 'info-600', 'info-50'],
    ['danger badge and error box', 'danger-600', 'danger-50'],
    ['neutral badge', 'neutral-600', 'neutral-100'],
    ['error text on a card', 'danger-600', 'surface'],
  ])('%s', (_what, text, background) => {
    expect(contrast(token(text), token(background))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('control edges and chart marks reach 3:1', () => {
  it.each([
    ['form field edge', 'control-border', 'surface'],
    ['secondary button edge', 'secondary', 'surface'],
    ['error field edge', 'danger', 'surface'],
    ['switch when off', 'control-border', 'surface'],
    ['switch when on', 'primary-500', 'surface'],
    // The active item's fill is 2.4:1 against the sidebar, so it also carries a white bar and bold text: the bar is what must stand out.
    ['active sidebar indicator bar', 'white', 'nav-active'],
    ['arrivals bar', 'chart-arrivals', 'surface'],
    ['departures bar', 'chart-departures', 'surface'],
  ])('%s', (_what, mark, background) => {
    expect(contrast(token(mark), token(background))).toBeGreaterThanOrEqual(3)
  })
})
