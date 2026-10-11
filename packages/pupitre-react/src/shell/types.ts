import type { ReactNode } from 'react'
import type {
  ActionDescriptor,
  Breadcrumb,
  NavGroup,
  PupitrePageProps,
  TenantOption,
} from '@rikology/pupitre/catalog'

type SharedPupitre = PupitrePageProps['pupitre']

export type ShellProps = {
  panel: SharedPupitre['panel']
  user: SharedPupitre['user']
  nav: NavGroup[]
  breadcrumbs: Breadcrumb[]
  title: string
  headerActions: ActionDescriptor[]
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
  onConfirm: () => void
  onCancel: () => void
}
export type NotFoundProps = { title: string; message: string }
export type ShellRegistry = {
  Shell: React.ComponentType<ShellProps>
  AuthShell: React.ComponentType<AuthShellProps>
  Toaster: React.ComponentType<ToasterProps>
  Modal: React.ComponentType<ModalProps>
  ConfirmDialog: React.ComponentType<ConfirmDialogProps>
  NotFound: React.ComponentType<NotFoundProps>
}
