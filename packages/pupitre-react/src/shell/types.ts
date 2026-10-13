import type { ComponentType, ReactNode } from 'react'
import type {
  ActionDescriptor,
  Breadcrumb,
  NavGroup,
  PupitrePageProps,
  TenantOption,
} from '@rikology/pupitre/catalog'
import type { SubNavigationItem } from '@rikology/pupitre/catalog'
import type { WidgetFilter } from '@rikology/pupitre/catalog'
import type { WidgetDescriptor } from '@rikology/pupitre/catalog'
import type { ImportResultResponse } from '@rikology/pupitre/catalog'

type SharedPupitre = PupitrePageProps['pupitre']

export type ShellProps = {
  panel: SharedPupitre['panel']
  user: SharedPupitre['user']
  impersonation?: SharedPupitre['impersonation']
  environment?: SharedPupitre['environment']
  locale?: string
  locales?: string[]
  nav: NavGroup[]
  breadcrumbs: Breadcrumb[]
  title: string
  headerActions: ActionDescriptor[]
  subNavigation?: SubNavigationItem[]
  clusterNavigation?: SubNavigationItem[]
  clusterNavigationPosition?: 'start' | 'top'
  currentUrl: string
  /** Current tenant (tenancy enabled), else `null`. */
  tenant: SharedPupitre['tenant']
  /** Tenants for the switcher; empty when the switcher is hidden. */
  tenants: TenantOption[]
  /** Database notifications tray state; absent when the panel has no notifications. */
  notifications?: SharedPupitre['notifications']
  children: ReactNode
}
/** Layout for `page.kind === 'auth'` pages (login, reset, register): no navigation shell. */
export type AuthShellProps = {
  panel: SharedPupitre['panel']
  title: string
  children: ReactNode
}
export type ToasterProps = { toasts: ToastMessage[]; dismiss: (id: string) => void }
export type ToastMessage = {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  body?: string
  actions?: { label: string; url?: string; method?: 'get' | 'post'; markAsRead?: boolean }[]
}
export type ModalProps = {
  open: boolean
  onClose: () => void
  heading?: string
  description?: string
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  slideOver?: boolean
  icon?: string
  children: ReactNode
  footer?: ReactNode
}
export type ConfirmDialogProps = {
  open: boolean
  heading: string
  description?: string
  submitLabel?: string
  cancelLabel?: string
  destructive?: boolean
  icon?: string
  loading?: boolean
  exportFormats?: readonly ('csv' | 'xlsx')[]
  exportFormat?: 'csv' | 'xlsx'
  onExportFormatChange?: (format: 'csv' | 'xlsx') => void
  onConfirm: () => void
  onCancel: () => void
}
export type ImportModalProps = {
  open: boolean
  action: ActionDescriptor
  onClose: () => void
  onComplete: (result: ImportResultResponse) => void
}
export type WidgetGridProps = {
  widgets: WidgetDescriptor[]
  data: Record<string, unknown>
  deferred?: string[]
  filters?: WidgetFilter[]
  customWidgets?: Record<string, ComponentType<{ descriptor: WidgetDescriptor; data: unknown }>>
}
export type NotFoundProps = { title: string; message: string }
export type ShellRegistry = {
  Shell: React.ComponentType<ShellProps>
  AuthShell: React.ComponentType<AuthShellProps>
  Toaster: React.ComponentType<ToasterProps>
  Modal: React.ComponentType<ModalProps>
  ConfirmDialog: React.ComponentType<ConfirmDialogProps>
  NotFound: React.ComponentType<NotFoundProps>
  ImportModal?: React.ComponentType<ImportModalProps>
  WidgetGrid?: ComponentType<WidgetGridProps>
}
