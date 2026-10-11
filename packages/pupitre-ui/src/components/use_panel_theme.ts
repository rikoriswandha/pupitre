import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ShellProps } from '@rikology/pupitre-react'
const EMPTY_THEME: NonNullable<ShellProps['panel']['theme']> = {}

export function usePanelTheme(panel: ShellProps['panel']): CSSProperties {
  const [dark, setDark] = useState(false)
  const panelBrand = panel.brand
  const theme = panel.theme ?? EMPTY_THEME
  const darkMode = theme.darkMode ?? 'system'
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setDark(darkMode === 'dark' || (darkMode === 'system' && media.matches))
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [darkMode])
  useEffect(() => {
    const root = document.documentElement
    const previousDark = root.classList.contains('dark')
    if (dark) root.classList.add('dark')
    else root.classList.remove('dark')
    return () => {
      if (previousDark) root.classList.add('dark')
      else root.classList.remove('dark')
    }
  }, [dark])
  useEffect(() => {
    const root = document.documentElement
    const variables = Object.entries({
      ...(theme.primary ? { '--primary': theme.primary } : {}),
      ...(theme.radius ? { '--radius': theme.radius } : {}),
      ...(theme.vars ?? {}),
    })
    const previous = variables.map(
      ([key]) =>
        [key, root.style.getPropertyValue(key), root.style.getPropertyPriority(key)] as const
    )
    for (const [key, value] of variables) root.style.setProperty(key, value)
    return () => {
      for (const [key, value, priority] of previous) {
        if (value) root.style.setProperty(key, value, priority)
        else root.style.removeProperty(key)
      }
    }
  }, [theme])
  useEffect(() => {
    const links: HTMLLinkElement[] = []
    for (const [rel, href] of [
      ['stylesheet', theme.stylesheet],
      ['stylesheet', theme.fontUrl],
    ] as const) {
      if (!href || typeof document === 'undefined') continue
      const link = document.createElement('link')
      link.rel = rel
      link.href = href
      link.dataset.pupitreTheme = panel.id
      document.head.append(link)
      links.push(link)
    }
    return () => links.forEach((link) => link.remove())
  }, [panel.id, theme.stylesheet, theme.fontUrl])
  useEffect(() => {
    if (!panelBrand?.favicon || typeof document === 'undefined') return
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.append(link)
    }
    link.href = panelBrand.favicon
  }, [panelBrand?.favicon])
  return {
    ...theme.vars,
    ...(theme.primary ? { '--primary': theme.primary } : {}),
    ...(theme.radius ? { '--radius': theme.radius } : {}),
    ...(theme.fontFamily ? { fontFamily: 'var(--font-sans)' } : {}),
  } as CSSProperties
}
