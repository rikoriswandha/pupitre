import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import { FieldDescription, cn, controlGroupClasses } from '../primitives/index.js'

type Language =
  'json' | 'javascript' | 'typescript' | 'html' | 'css' | 'markdown' | 'sql' | 'python' | 'php'
type Props = {
  props: {
    value?: string | null
    label?: string | null
    helperText?: string | null
    error?: unknown
    language?: Language
    lineNumbers?: boolean
    minHeight?: number
    disabled?: boolean
    readOnly?: boolean
  }
  children?: ReactNode
  emit: (event: string, payload?: unknown) => void
  bindings?: Record<string, string | undefined>
  loading?: boolean
}
type EditorProps = {
  id: string
  value: string
  label?: string
  describedBy?: string
  invalid: boolean
  language: Language
  lineNumbers: boolean
  minHeight: number
  disabled: boolean
  readOnly: boolean
  onChange: (value: string) => void
}
// CodeMirror remains in its own chunk; only the selected language extension is imported on demand.
const Editor = lazy(async () => {
  const [
    {
      EditorView,
      keymap,
      lineNumbers,
      drawSelection,
      highlightActiveLine,
      highlightActiveLineGutter,
    },
    { defaultKeymap, history, historyKeymap },
    { syntaxHighlighting, HighlightStyle },
    { Compartment, EditorState },
    { tags },
  ] = await Promise.all([
    import('@codemirror/view'),
    import('@codemirror/commands'),
    import('@codemirror/language'),
    import('@codemirror/state'),
    import('@lezer/highlight'),
  ])
  const theme = EditorView.theme({
    '&': {
      backgroundColor: 'var(--card)',
      color: 'var(--foreground)',
      minHeight: 'var(--editor-min-height)',
      fontSize: '13px',
    },
    '&.cm-focused': { outline: 'none' },
    '&:has(.cm-content[aria-disabled=true])': {
      backgroundColor: 'var(--muted)',
      color: 'var(--muted-foreground)',
    },
    '.cm-scroller': { fontFamily: 'var(--font-mono, ui-monospace, monospace)', lineHeight: '1.75' },
    '.cm-content': {
      padding: '12px 0',
      caretColor: 'var(--foreground)',
      minHeight: 'var(--editor-min-height)',
    },
    '.cm-line': { padding: '0 16px' },
    '.cm-gutters': {
      backgroundColor: 'var(--muted)',
      color: 'var(--muted-foreground)',
      borderRight: '1px solid var(--border)',
    },
    '.cm-gutterElement': { padding: '0 8px' },
    '.cm-activeLine, .cm-activeLineGutter': {
      backgroundColor: 'color-mix(in oklch, var(--primary) 6%, transparent)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'color-mix(in oklch, var(--primary) 18%, transparent)',
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },
  })
  const highlightStyle = HighlightStyle.define([
    { tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword], color: 'var(--primary-ink)' },
    { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--success-ink)' },
    { tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--warning-ink)' },
    { tag: [tags.comment, tags.meta], color: 'var(--muted-foreground)' },
    { tag: [tags.typeName, tags.className, tags.tagName], color: 'var(--info-ink)' },
    { tag: [tags.propertyName, tags.attributeName], color: 'var(--foreground)' },
    { tag: tags.invalid, color: 'var(--danger-ink)' },
    { tag: tags.heading, color: 'var(--foreground)', fontWeight: '600' },
    { tag: tags.link, color: 'var(--primary-ink)', textDecoration: 'underline' },
    { tag: tags.strong, fontWeight: '600' },
    { tag: tags.emphasis, fontStyle: 'italic' },
  ])
  function CodeMirrorEditor({
    id,
    value,
    label,
    describedBy,
    invalid,
    language,
    lineNumbers: showLineNumbers,
    minHeight,
    disabled,
    readOnly,
    onChange,
  }: EditorProps) {
    const host = useRef<HTMLDivElement>(null)
    const view = useRef<InstanceType<typeof EditorView> | null>(null)
    const onChangeRef = useRef(onChange)
    const valueRef = useRef(value)
    const [access] = useState(() => new Compartment())
    const accessExtensions = useCallback(
      () => [
        EditorState.readOnly.of(disabled || readOnly),
        EditorView.editable.of(!disabled && !readOnly),
        EditorView.contentAttributes.of({
          'id': id,
          'tabindex': '0',
          'aria-label': label ?? 'Code editor',
          'aria-readonly': String(readOnly),
          'aria-disabled': String(disabled),
          'aria-describedby': describedBy ?? '',
          'aria-invalid': String(invalid),
        }),
      ],
      [id, disabled, readOnly, label, describedBy, invalid]
    )
    const accessRef = useRef(accessExtensions)
    useEffect(() => {
      accessRef.current = accessExtensions
      view.current?.dispatch({ effects: access.reconfigure(accessExtensions()) })
    }, [access, accessExtensions])
    useEffect(() => {
      onChangeRef.current = onChange
    }, [onChange])
    useEffect(() => {
      valueRef.current = value
    }, [value])
    useEffect(() => {
      let current = true
      let editor: InstanceType<typeof EditorView> | undefined
      async function create() {
        let languageExtension
        switch (language) {
          case 'json': {
            const lang = await import('@codemirror/lang-json')
            languageExtension = lang.json()
            break
          }
          case 'javascript': {
            const lang = await import('@codemirror/lang-javascript')
            languageExtension = lang.javascript()
            break
          }
          case 'typescript': {
            const lang = await import('@codemirror/lang-javascript')
            languageExtension = lang.javascript({ typescript: true })
            break
          }
          case 'html': {
            const lang = await import('@codemirror/lang-html')
            languageExtension = lang.html()
            break
          }
          case 'css': {
            const lang = await import('@codemirror/lang-css')
            languageExtension = lang.css()
            break
          }
          case 'markdown': {
            const lang = await import('@codemirror/lang-markdown')
            languageExtension = lang.markdown()
            break
          }
          case 'sql': {
            const lang = await import('@codemirror/lang-sql')
            languageExtension = lang.sql()
            break
          }
          case 'python': {
            const lang = await import('@codemirror/lang-python')
            languageExtension = lang.python()
            break
          }
          case 'php': {
            const lang = await import('@codemirror/lang-php')
            languageExtension = lang.php()
            break
          }
        }
        if (!current || !host.current) return
        editor = new EditorView({
          doc: valueRef.current,
          extensions: [
            history(),
            theme,
            drawSelection(),
            highlightActiveLine(),
            highlightActiveLineGutter(),
            keymap.of([...defaultKeymap, ...historyKeymap]),
            ...(showLineNumbers ? [lineNumbers()] : []),
            languageExtension,
            syntaxHighlighting(highlightStyle),
            access.of(accessRef.current()),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) onChangeRef.current(update.state.doc.toString())
            }),
          ],
          parent: host.current,
        })
        view.current = editor
      }
      void create()
      return () => {
        current = false
        editor?.destroy()
        view.current = null
      }
    }, [language, showLineNumbers, access])
    useEffect(() => {
      const current = view.current
      if (!current || current.state.doc.toString() === value) return
      current.dispatch({ changes: { from: 0, to: current.state.doc.length, insert: value } })
    }, [value])
    return (
      <div
        className={cn(controlGroupClasses, 'flex-col', disabled && 'bg-muted shadow-none')}
        role="group"
        aria-label={label ?? 'Code editor'}
      >
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <Icon name="code" className="size-3.5" />
          <span>
            {language === 'javascript'
              ? 'JavaScript'
              : language === 'typescript'
                ? 'TypeScript'
                : language.toUpperCase()}
          </span>
          {(readOnly || disabled) && <span className="ml-auto">Read only</span>}
        </div>
        <div
          ref={host}
          className="min-w-0 overflow-auto"
          style={{ '--editor-min-height': `${minHeight}px`, minHeight } as CSSProperties}
        />
      </div>
    )
  }
  return { default: CodeMirrorEditor }
})
export function CodeEditor({ props, emit, bindings, children, loading = false }: Props) {
  const [value, setValue] = useBoundValue(props.value, bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
  const id = useId()
  const describedBy =
    [props.helperText && `${id}-helper`, error && `${id}-error`].filter(Boolean).join(' ') ||
    undefined
  const update = useCallback(
    (source: string) => {
      setValue(source)
      emit('change', source)
    },
    [emit, setValue]
  )
  return (
    <div className="grid gap-1.5" aria-busy={loading}>
      {props.label && (
        <label htmlFor={id} className="text-sm font-medium leading-5 text-foreground">
          {props.label}
        </label>
      )}
      <Suspense
        fallback={
          <div
            className="rounded-lg border border-input bg-card shadow-control"
            style={{ minHeight: props.minHeight ?? 180 }}
            aria-label="Loading code editor"
            role="status"
          />
        }
      >
        <Editor
          id={id}
          value={value ?? ''}
          label={props.label ?? undefined}
          describedBy={describedBy}
          invalid={!!error}
          language={props.language ?? 'javascript'}
          lineNumbers={props.lineNumbers ?? true}
          minHeight={props.minHeight ?? 180}
          disabled={props.disabled || loading || false}
          readOnly={props.readOnly ?? false}
          onChange={update}
        />
      </Suspense>
      {props.helperText && (
        <FieldDescription id={`${id}-helper`}>{props.helperText}</FieldDescription>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="flex items-start gap-1.5 text-[0.8125rem] leading-5 text-danger-ink"
          role="alert"
        >
          <Icon name="circle-alert" className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {children}
    </div>
  )
}
export default CodeEditor
