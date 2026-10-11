import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'

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
  value: string
  label?: string
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
    { EditorView, keymap, lineNumbers },
    { defaultKeymap, history, historyKeymap },
    { syntaxHighlighting, defaultHighlightStyle },
    { Compartment, EditorState },
  ] = await Promise.all([
    import('@codemirror/view'),
    import('@codemirror/commands'),
    import('@codemirror/language'),
    import('@codemirror/state'),
  ])
  function CodeMirrorEditor({
    value,
    label,
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
          'tabindex': '0',
          'aria-label': label ?? 'Code editor',
          'aria-readonly': String(readOnly),
          'aria-disabled': String(disabled),
        }),
      ],
      [disabled, readOnly, label]
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
            keymap.of([...defaultKeymap, ...historyKeymap]),
            ...(showLineNumbers ? [lineNumbers()] : []),
            languageExtension,
            syntaxHighlighting(defaultHighlightStyle),
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
        ref={host}
        className="overflow-auto rounded-md border border-input bg-background text-sm"
        role="group"
        aria-label={label ?? 'Code editor'}
        style={{ minHeight }}
      />
    )
  }
  return { default: CodeMirrorEditor }
})
export function CodeEditor({ props, emit, bindings, children, loading = false }: Props) {
  const [value, setValue] = useBoundValue(props.value, bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
  const update = useCallback(
    (source: string) => {
      setValue(source)
      emit('change', source)
    },
    [emit, setValue]
  )
  return (
    <div className="space-y-2" aria-busy={loading}>
      {props.label && <label className="block text-sm font-medium">{props.label}</label>}
      {props.helperText && <p className="text-sm text-muted-foreground">{props.helperText}</p>}
      <Suspense
        fallback={
          <div
            className="rounded-md border bg-muted/20"
            style={{ minHeight: props.minHeight ?? 180 }}
            aria-label="Loading code editor"
          />
        }
      >
        <Editor
          value={value ?? ''}
          label={props.label ?? undefined}
          language={props.language ?? 'javascript'}
          lineNumbers={props.lineNumbers ?? true}
          minHeight={props.minHeight ?? 180}
          disabled={props.disabled || loading || false}
          readOnly={props.readOnly ?? false}
          onChange={update}
        />
      </Suspense>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {children}
    </div>
  )
}
export default CodeEditor
