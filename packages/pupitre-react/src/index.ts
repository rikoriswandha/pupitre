// Initialize strict-CSP schema settings before renderer dependencies construct schemas.
import '@rikology/pupitre/catalog'

export type { PupitreProps } from './page/Pupitre.js'
export { Pupitre } from './page/Pupitre.js'
export { PupitreShell } from './page/PupitreShell.js'
export { defineRegistry } from './registry/defineRegistry.js'
export type { PupitreFunctions, PupitreRegistry } from './registry/defineRegistry.js'
export { PupitreRenderer } from './renderer/PupitreRenderer.js'
export { ActionModal } from './renderer/ActionModal.js'
export { SpecRenderer } from './renderer/SpecRenderer.js'
export type { SpecRendererProps } from './renderer/SpecRenderer.js'
export type { PupitreRendererProps } from './renderer/PupitreRenderer.js'
export { createPupitreStore } from './renderer/store.js'
export { builtInFunctions } from './renderer/functions.js'
export { t } from './i18n.js'
export { matchesKeyBinding } from './key_bindings.js'
export { setRouter } from './bridge/inertia.js'
export { getRouter } from './bridge/inertia.js'
export {
  setFetch,
  fetchOptions,
  jsonFetch,
  xsrfToken,
  waitForExport,
  downloadExportFile,
} from './bridge/actions.js'
export { mapErrors } from './bridge/errors.js'
export {
  useBoundValue,
  useBoundProp,
  useFieldError,
  useStateValue,
  useSetState,
  usePanel,
  usePage,
  useRunAction,
  useTable,
  useSubmitForm,
  useEmbedded,
  useUpload,
  useToast,
  useVisit,
  useNavigationGuard,
  useOptions,
  useRuntime,
  useNotificationsPolling,
  useRealtimeSubscription,
  useTableRealtime,
} from './hooks/index.js'
export type {
  ShellProps,
  AuthShellProps,
  ToasterProps,
  ToastMessage,
  ModalProps,
  ConfirmDialogProps,
  NotFoundProps,
  ImportModalProps,
  ShellRegistry,
} from './shell/types.js'
