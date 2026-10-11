import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ColumnDescriptor } from '@rikology/pupitre/catalog'
import { jsonFetch, t, useRuntime } from '@rikology/pupitre-react'

type Props = {
  column: ColumnDescriptor
  rowKey: string | number
  value: unknown
  display?: string
  disabled?: boolean
  onChange: (value: unknown) => void
  onEditingChange: (editing: boolean) => void
}

export function DataTableEditableCell({
  column,
  rowKey,
  value,
  display,
  disabled = false,
  onChange,
  onEditingChange,
}: Props) {
  const editableUrl = column.editable?.url.replace(':id', encodeURIComponent(String(rowKey)))
  const { toast } = useRuntime()
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const canceling = useRef(false)
  const submittingWithEnter = useRef(false)
  useEffect(() => {
    if (!editing && restoreFocus.current) {
      restoreFocus.current = false
      const frame = requestAnimationFrame(() => buttonRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
  }, [editing])
  if (!editableUrl) return <>{display ?? String(value ?? '')}</>

  async function save(next: unknown) {
    if (pendingRef.current || Object.is(next, value)) {
      setEditing(false)
      onEditingChange(false)
      return
    }
    pendingRef.current = true
    onEditingChange(true)
    setPending(true)
    onChange(next)
    try {
      const response = await jsonFetch(editableUrl!, {
        method: 'PATCH',
        body: JSON.stringify({ value: next }),
      })
      if (!response.ok) throw new Error(t('Unable to save this value'))
      toast({ type: 'success', title: t('Saved') })
    } catch {
      onChange(value)
      setDraft(value)
      toast({ type: 'error', title: t('Unable to save this value') })
    } finally {
      pendingRef.current = false
      setPending(false)
      setEditing(false)
      onEditingChange(false)
    }
  }

  if (column.type === 'toggle' || column.type === 'checkbox') {
    return (
      <input
        aria-label={`${column.label}, ${t('row')} ${rowKey}`}
        type="checkbox"
        checked={value === true}
        disabled={disabled || pending}
        onChange={(event) => void save(event.currentTarget.checked)}
      />
    )
  }
  const options = Array.isArray(column.props.options)
    ? (column.props.options as { value: string; label: string }[])
    : []
  if (column.type === 'select') {
    return (
      <select
        aria-label={`${column.label}, ${t('row')} ${rowKey}`}
        className="h-8 rounded border bg-background px-2"
        value={String(value ?? '')}
        disabled={disabled || pending}
        onChange={(event) => void save(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }
  const content: ReactNode = editing ? (
    <input
      autoFocus
      aria-label={`${column.label}, ${t('row')} ${rowKey}`}
      className="h-8 w-full rounded border bg-background px-2"
      value={String(draft ?? '')}
      disabled={disabled || pending}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onFocus={() => onEditingChange(true)}
      onBlur={() => {
        if (canceling.current || submittingWithEnter.current) {
          canceling.current = false
          submittingWithEnter.current = false
          return
        }
        void save(draft)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          restoreFocus.current = true
          submittingWithEnter.current = true
          void save(draft)
        }
        if (event.key === 'Escape') {
          restoreFocus.current = true
          canceling.current = true
          setDraft(value)
          setEditing(false)
          onEditingChange(false)
        }
      }}
    />
  ) : (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      className="text-left"
      aria-label={`${t('Edit')} ${column.label}, ${String(value ?? '')}, ${t('row')} ${rowKey}`}
      onClick={() => {
        canceling.current = false
        submittingWithEnter.current = false
        restoreFocus.current = false
        setDraft(value)
        setEditing(true)
        onEditingChange(true)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          canceling.current = false
          submittingWithEnter.current = false
          restoreFocus.current = false
          setDraft(value)
          setEditing(true)
          onEditingChange(true)
        }
      }}
    >
      {display ?? (String(value ?? '') || <span className="text-muted-foreground">—</span>)}
    </button>
  )
  return content
}
