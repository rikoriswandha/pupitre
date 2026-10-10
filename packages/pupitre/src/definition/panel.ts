export type PanelDefinition = {
  id: string
  path: string
  guard?: string
  middleware: readonly unknown[]
  resources: readonly unknown[]
  brand?: { name: string; logo?: string; favicon?: string }
  theme?: { primary?: string; darkMode?: string }
  timezone?: string
  locale?: 'en'
  breadcrumbs: boolean
  toJSON(): string
}
