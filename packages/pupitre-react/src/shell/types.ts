import type { ReactNode } from 'react'
import type {
  ActionDescriptor,
  Breadcrumb,
  NavGroup,
  PupitrePageProps,
} from '@rikology/pupitre/catalog'

export type ShellProps = {
  panel: PupitrePageProps['pupitre']['panel']
  user: PupitrePageProps['pupitre']['user']
  nav: NavGroup[]
  breadcrumbs: Breadcrumb[]
  title: string
  headerActions: ActionDescriptor[]
  currentUrl: string
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
  Toaster: React.ComponentType<ToasterProps>
  Modal: React.ComponentType<ModalProps>
  ConfirmDialog: React.ComponentType<ConfirmDialogProps>
  NotFound: React.ComponentType<NotFoundProps>
}
