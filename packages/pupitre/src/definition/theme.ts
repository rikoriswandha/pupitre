export type ThemeDefinition = {
  font?: { family: string; url?: string }
  density?: 'compact' | 'comfortable'
  sidebar?: 'expanded' | 'collapsed' | 'top-nav'
  sidebarCollapsibleOnDesktop?: boolean
  contentWidth?:
    'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full' | 'screen'
  colors?: Record<string, string>
  radius?: string
  vars?: Record<string, string>
  stylesheet?: string
  darkMode?: 'light' | 'dark' | 'system'
  /** Legacy primary color accepted by panel.theme(). */
  primary?: string
}

const unsafeCss = /[;{}<>]|url\s*\(/i
const variableName = /^--[A-Za-z0-9_-]+$/
const colorName = /^[A-Za-z][A-Za-z0-9]*$/
const allowedWidths = new Set([
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  'full',
  'screen',
])

function validateCssValue(label: string, value: string) {
  if (typeof value !== 'string' || !value.trim() || unsafeCss.test(value)) {
    throw new Error(`Invalid Pupitre theme ${label}`)
  }
}

function validateUrl(label: string, value: string) {
  let url: URL
  try {
    url = new URL(value, 'https://pupitre.invalid')
  } catch {
    throw new Error(`Invalid Pupitre theme ${label} URL`)
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    (url.origin !== 'https://pupitre.invalid' && url.protocol !== 'https:')
  ) {
    throw new Error(`Invalid Pupitre theme ${label} URL: use a same-origin path or HTTPS URL`)
  }
}

export function validateTheme(theme: ThemeDefinition): ThemeDefinition {
  if (theme.font) {
    validateCssValue('font family', theme.font.family)
    if (theme.font.url) validateUrl('font', theme.font.url)
  }
  if (theme.stylesheet) validateUrl('stylesheet', theme.stylesheet)
  if (theme.contentWidth && !allowedWidths.has(theme.contentWidth))
    throw new Error('Invalid Pupitre theme content width')
  for (const [name, value] of Object.entries(theme.colors ?? {})) {
    if (!colorName.test(name)) throw new Error(`Invalid Pupitre theme color name "${name}"`)
    validateCssValue(`color "${name}"`, value)
  }
  for (const [name, value] of Object.entries(theme.vars ?? {})) {
    if (!variableName.test(name))
      throw new Error(`Invalid Pupitre theme CSS variable "${name}": names must start with "--"`)
    validateCssValue(`CSS variable "${name}"`, value)
  }
  if (theme.primary) validateCssValue('primary color', theme.primary)
  if (theme.radius) validateCssValue('radius', theme.radius)
  return theme
}

/** Creates a validated, immutable-friendly panel theme definition. */
export function defineTheme<T extends ThemeDefinition>(theme: T): T {
  validateTheme(theme)
  return {
    ...theme,
    ...(theme.font ? { font: { ...theme.font } } : {}),
    ...(theme.colors ? { colors: { ...theme.colors } } : {}),
    ...(theme.vars ? { vars: { ...theme.vars } } : {}),
  }
}
