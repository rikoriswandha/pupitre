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
    const variables = Object.entries(theme)
      .filter(([key]) => key.startsWith('--') || key === 'primary')
      .map(([key, value]) => [key === 'primary' ? '--primary' : key, value] as const)
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
    if (!panelBrand?.favicon || typeof document === 'undefined') return
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.append(link)
    }
    link.href = panelBrand.favicon
  }, [panelBrand?.favicon])
  return Object.fromEntries(
    Object.entries(theme)
      .filter(([key]) => key.startsWith('--') || key === 'primary')
      .map(([key, value]) => [key === 'primary' ? '--primary' : key, value])
  ) as CSSProperties
}
