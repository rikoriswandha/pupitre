import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  useNavigationGuard,
  useSetState,
  useStateValue,
  useEmbedded,
  useSubmitForm,
  useVisit,
  useRuntime,
  matchesKeyBinding,
  t,
} from '@rikology/pupitre-react'
import { Button, Panel, cn } from '../primitives/index.js'
import { PanelNestingContext } from './Section.js'

export const FormWizardContext = createContext<{ label: string; submitting: boolean } | null>(null)
type Props = Record<string, unknown>
type RuntimeProps = {
  props: Props
  children?: ReactNode
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function Form({ props, children, bindings, loading = false }: RuntimeProps) {
  const visit = useVisit()
  const setState = useSetState()
  const submitForm = useSubmitForm()
  const embedded = useEmbedded()
  // Same registry dialog as action confirmations (delete etc.), so host overrides apply.
  const LeaveConfirm = useRuntime().registry.shell.ConfirmDialog
  const nested = useContext(PanelNestingContext)
  const content: ReactNode[] = []
  let fields: ReactNode[] = []
  const flush = () => {
    if (!fields.length) return
    content.push(
      <Panel key={`fields-${content.length}`} className="p-5 sm:p-6">
        <PanelNestingContext.Provider value={true}>
          <div className="space-y-5">{fields}</div>
        </PanelNestingContext.Provider>
      </Panel>
    )
    fields = []
  }
  Children.forEach(children, (child) => {
    const metadata = isValidElement<{ element?: { type?: string } }>(child)
      ? child.props.element
      : undefined
    const name =
      metadata?.type ??
      (isValidElement(child) && typeof child.type === 'function' ? child.type.name : '')
    if (['Section', 'Tabs', 'Wizard'].includes(name)) {
      flush()
      content.push(child)
    } else fields.push(child)
  })
  flush()
  const onlyWizard =
    Children.count(children) === 1 &&
    Children.toArray(children).some(
      (child) =>
        isValidElement<{ element?: { type?: string } }>(child) &&
        (child.props.element?.type === 'Wizard' ||
          (typeof child.type === 'function' && child.type.name === 'Wizard'))
    )
  const submitting = useStateValue('/meta/submitting') === true
  const submitted = useStateValue('/meta/submitted') === true
  const errors = useStateValue('/errors')
  const formData = useStateValue('/data')
  const [initialState, setInitialState] = useState(() => JSON.stringify(formData))
  const succeeded =
    submitted && (!errors || (typeof errors === 'object' && Object.keys(errors).length === 0))
  // A successful submit (bridge sets `/meta/submitted`, no errors) makes the
  // saved data the new clean baseline; a 422 keeps the old one so the guard stays.
  if (succeeded && JSON.stringify(formData) !== initialState) {
    setInitialState(JSON.stringify(formData))
  }
  const dirty = JSON.stringify(formData) !== initialState
  const guard = useNavigationGuard(
    useCallback(
      () => !embedded && props.dirtyGuard === true && dirty,
      [dirty, embedded, props.dirtyGuard]
    )
  )
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitForm()
  }
  useEffect(() => {
    if (succeeded) setState('/meta/submitted', false)
  }, [succeeded, setState])
  useEffect(() => {
    setState('/meta/dirty', dirty)
  }, [dirty, setState])
  useEffect(() => {
    const keyBindings = Array.isArray(props.keyBindings)
      ? props.keyBindings.filter((binding): binding is string => typeof binding === 'string')
      : []
    if (keyBindings.length === 0) return
    const handler = (event: KeyboardEvent) => {
      if (keyBindings.some((binding) => matchesKeyBinding(event, binding))) {
        event.preventDefault()
        submitForm()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [formData, props.keyBindings, setState, submitForm])
  const cancel = () => {
    if (typeof props.cancelUrl === 'string') visit(props.cancelUrl)
  }
  return (
    <form
      noValidate
      className={cn('space-y-6', typeof props.className === 'string' ? props.className : undefined)}
      action={typeof props.url === 'string' ? props.url : undefined}
      method={typeof props.method === 'string' ? props.method : undefined}
      onSubmit={submit}
      data-dirty={dirty || undefined}
      data-binding={bindings?.value}
    >
      <FormWizardContext.Provider
        value={
          onlyWizard
            ? {
                label: typeof props.submitLabel === 'string' ? props.submitLabel : t('Submit'),
                submitting: loading || submitting,
              }
            : null
        }
      >
        {embedded || nested ? children : content}
      </FormWizardContext.Provider>
      {/* Inside an action modal the modal footer owns submit/cancel. */}
      {!embedded && (
        <div className="flex flex-wrap items-center gap-3">
          {!onlyWizard && (
            <Button type="submit" color="primary" loading={loading || submitting}>
              {typeof props.submitLabel === 'string' ? props.submitLabel : t('Submit')}
            </Button>
          )}
          {typeof props.cancelUrl === 'string' && (
            <Button type="button" color="gray" onClick={cancel} disabled={loading}>
              {t('Cancel')}
            </Button>
          )}
        </div>
      )}
      <LeaveConfirm
        open={guard.pending}
        heading={t('Discard unsaved changes?')}
        description={t('You have unsaved changes. If you leave this page, they will be lost.')}
        submitLabel={t('Leave page')}
        cancelLabel={t('Stay')}
        destructive
        onConfirm={guard.proceed}
        onCancel={guard.cancel}
      />
    </form>
  )
}
export default Form
