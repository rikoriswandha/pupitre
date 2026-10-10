import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  useNavigationGuard,
  useSetState,
  useStateValue,
  useEmbedded,
  useSubmitForm,
  useVisit,
} from '@rikology/pupitre-react'
import { Button } from '../primitives/index.js'
import { cn } from '../primitives/index.js'

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
  const submitting = useStateValue('/meta/submitting') === true
  const formData = useStateValue('/data')
  const [initialState, setInitialState] = useState(() => JSON.stringify(formData))
  const dirty = JSON.stringify(formData) !== initialState
  useNavigationGuard(
    useCallback(
      () => !embedded && props.dirtyGuard === true && dirty,
      [dirty, embedded, props.dirtyGuard]
    ),
    'You have unsaved changes. Leave this page?'
  )
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setInitialState(JSON.stringify(formData))
    setState('/meta/dirty', false)
    submitForm()
  }
  useEffect(() => {
    setState('/meta/dirty', dirty)
  }, [dirty, setState])
  useEffect(() => {
    const keyBindings = Array.isArray(props.keyBindings)
      ? props.keyBindings.filter((binding): binding is string => typeof binding === 'string')
      : []
    if (keyBindings.length === 0) return
    const matches = (event: KeyboardEvent, binding: string) => {
      const parts = binding
        .toLowerCase()
        .split('+')
        .map((part) => part.trim())
      const key = parts.at(-1)
      return (
        key === event.key.toLowerCase() &&
        parts
          .slice(0, -1)
          .every((part) =>
            part === 'mod'
              ? event.metaKey || event.ctrlKey
              : part === 'ctrl'
                ? event.ctrlKey
                : part === 'meta'
                  ? event.metaKey
                  : part === 'alt'
                    ? event.altKey
                    : part === 'shift'
                      ? event.shiftKey
                      : false
          )
      )
    }
    const handler = (event: KeyboardEvent) => {
      if (keyBindings.some((binding) => matches(event, binding))) {
        event.preventDefault()
        setState('/meta/dirty', false)
        setInitialState(JSON.stringify(formData))
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
      className={cn('space-y-6', typeof props.className === 'string' ? props.className : undefined)}
      action={typeof props.url === 'string' ? props.url : undefined}
      method={typeof props.method === 'string' ? props.method : undefined}
      onSubmit={submit}
      data-dirty={dirty || undefined}
      data-binding={bindings?.value}
    >
      {children}
      {/* Inside an action modal the modal footer owns submit/cancel. */}
      {!embedded && (
        <div className="flex flex-wrap justify-end gap-2">
          {typeof props.cancelUrl === 'string' && (
            <Button type="button" variant="outline" onClick={cancel} disabled={loading}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={loading || submitting}>
            {typeof props.submitLabel === 'string' ? props.submitLabel : 'Submit'}
          </Button>
        </div>
      )}
    </form>
  )
}
export default Form
