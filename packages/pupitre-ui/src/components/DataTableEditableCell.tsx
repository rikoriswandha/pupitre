import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ColumnDescriptor } from '@rikology/pupitre/catalog'
import { jsonFetch, t, useRuntime } from '@rikology/pupitre-react'
import { CheckboxControl, SwitchControl, Input, SelectMenu } from '../primitives/index.js'

type Props = {
  column: ColumnDescriptor
  rowKey: string | number
  value: unknown
  serverValue: unknown
  display?: string
  disabled?: boolean
  onChange: (value: unknown) => number
  onSettled: (token: number, success: boolean) => void
  onEditingChange: (editing: boolean) => void
}

export function DataTableEditableCell({
  column,
  rowKey,
  value,
  serverValue,
  display,
  disabled = false,
  onChange,
  onSettled,
  onEditingChange,
}: Props) {
  const editableUrl = column.editable?.url.replace(':id', encodeURIComponent(String(rowKey)))
  const { toast } = useRuntime()
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const serverValueRef = useRef(serverValue)
  useEffect(() => {
    serverValueRef.current = serverValue
  }, [serverValue])
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
    const token = onChange(next)
    try {
      const response = await jsonFetch(editableUrl!, {
        method: 'PATCH',
        body: JSON.stringify({ value: next }),
      })
      if (!response.ok) throw new Error(t('Unable to save this value'))
      onSettled(token, true)
      toast({ type: 'success', title: t('Saved') })
    } catch {
      onSettled(token, false)
      setDraft(serverValueRef.current)
      toast({ type: 'error', title: t('Unable to save this value') })
    } finally {
      pendingRef.current = false
      setPending(false)
      setEditing(false)
      onEditingChange(false)
    }
  }

  if (column.type === 'toggle') {
    return (
      <SwitchControl
        className="-my-0.5 h-6 border-0 bg-transparent px-0.5 before:absolute before:inset-x-0 before:top-1/2 before:h-5 before:-translate-y-1/2 before:rounded-full before:bg-input-strong before:transition-colors before:duration-150 data-checked:bg-transparent data-checked:before:bg-primary [&>span]:relative"
        aria-label={t('{column}, row {row}', { column: column.label, row: rowKey })}
        checked={value === true}
        disabled={disabled || pending}
        onCheckedChange={(checked) => void save(checked)}
      />
    )
  }
  if (column.type === 'checkbox') {
    return (
      <CheckboxControl
        className="-my-1 size-6"
        aria-label={t('{column}, row {row}', { column: column.label, row: rowKey })}
        checked={value === true}
        disabled={disabled || pending}
        onCheckedChange={(checked) => void save(checked)}
      />
    )
  }
  const options = Array.isArray(column.props.options)
    ? (column.props.options as { value: string; label: string }[])
    : []
  if (column.type === 'select') {
    return (
      <SelectMenu
        size="sm"
        className="w-auto"
        aria-label={t('{column}, row {row}', { column: column.label, row: rowKey })}
        value={String(value ?? '')}
        disabled={disabled || pending}
        onValueChange={(next) => void save(next)}
        options={options.map((option) => ({ value: String(option.value), label: option.label }))}
      />
    )
  }
  const content: ReactNode = editing ? (
    <Input
      autoFocus
      aria-label={t('{column}, row {row}', { column: column.label, row: rowKey })}
      className="h-8 w-full px-2"
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
      className="min-h-8 rounded-md px-1 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
      aria-label={t('Edit {column}, {value}, row {row}', {
        column: column.label,
        value: String(value ?? ''),
        row: rowKey,
      })}
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
