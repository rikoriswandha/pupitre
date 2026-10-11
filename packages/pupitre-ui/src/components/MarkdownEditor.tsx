import { lazy, Suspense, useCallback, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useBoundValue, useFieldError, useUpload } from '@rikology/pupitre-react'
import type { UploadResponse } from '@rikology/pupitre/catalog'

type Props = {
  props: {
    name?: string
    value?: string | null
    label?: string | null
    helperText?: string | null
    error?: unknown
    toolbar?: string[]
    uploadUrl?: string
    preview?: boolean
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
  label?: string | null
  helperText?: string | null
  errorId?: string
  invalid?: boolean
  value: string
  onChange: (value: string) => void
  toolbar: string[]
  uploadImage: (file: File) => Promise<UploadResponse>
  uploadUrl?: string
  disabled?: boolean
  readOnly?: boolean
  preview?: boolean
}

const supportedToolbar: Record<string, true> = {
  bold: true,
  italic: true,
  link: true,
  heading: true,
  h2: true,
  bulletList: true,
  orderedList: true,
  code: true,
  codeBlock: true,
}
// Markdown and DOMPurify stay in a separately loaded preview chunk.
const Preview = lazy(async () => {
  const [{ marked }, purifierModule] = await Promise.all([import('marked'), import('dompurify')])
  const DOMPurify = purifierModule.default
  function MarkdownPreview({ value }: { value: string }) {
    const html = DOMPurify.sanitize(marked.parse(value, { async: false }) as string)
    return (
      <div className="prose prose-sm max-w-none p-3" dangerouslySetInnerHTML={{ __html: html }} />
    )
  }
  return { default: MarkdownPreview }
})
function MarkdownInput({
  id,
  label,
  helperText,
  errorId,
  invalid,
  value,
  onChange,
  toolbar,
  uploadImage,
  uploadUrl,
  disabled,
  readOnly,
  preview,
}: EditorProps) {
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [imageError, setImageError] = useState<string>()
  const imageInput = useRef<HTMLInputElement>(null)
  const editorInput = useRef<HTMLTextAreaElement>(null)
  function insert(before: string, after = before) {
    const input = editorInput.current
    if (!input) return
    const start = input.selectionStart
    const end = input.selectionEnd
    const selected = value.slice(start, end)
    const next = `${value.slice(0, start)}${before}${selected || 'text'}${after}${value.slice(end)}`
    onChange(next)
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(
        start + before.length,
        start + before.length + (selected || 'text').length
      )
    })
  }
  async function upload(file?: File) {
    if (!file) return
    setImageError(undefined)
    try {
      const uploaded = await uploadImage(file)
      insert(`![${uploaded.name}](${uploaded.url}`, ')')
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Could not upload image.')
    }
  }
  const actions: Record<string, () => void> = {
    bold: () => insert('**'),
    italic: () => insert('*'),
    link: () => insert('[', '](https://)'),
    heading: () => insert('## ', ''),
    h2: () => insert('## ', ''),
    bulletList: () => insert('- ', ''),
    orderedList: () => insert('1. ', ''),
    code: () => insert('`'),
    codeBlock: () => insert('```\n', '\n```'),
  }
  return (
    <div className="overflow-hidden rounded-md border border-input bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b p-2">
        {toolbar
          .filter((item) => item === 'image' || supportedToolbar[item] === true)
          .map((item) =>
            item === 'image' ? (
              <button
                key={item}
                type="button"
                disabled={!uploadUrl || disabled || readOnly}
                onClick={() => imageInput.current?.click()}
                className="rounded px-2 py-1 text-sm hover:bg-muted"
              >
                Image
              </button>
            ) : (
              <button
                key={item}
                type="button"
                disabled={disabled || readOnly}
                onClick={actions[item]}
                className="rounded px-2 py-1 text-sm hover:bg-muted"
              >
                {item}
              </button>
            )
          )}
        <input
          ref={imageInput}
          className="sr-only"
          type="file"
          aria-label="Choose an image to upload"
          disabled={!uploadUrl || disabled || readOnly}
          accept="image/*"
          onChange={(event) => {
            void upload(event.currentTarget.files?.[0])
            event.currentTarget.value = ''
          }}
        />
        {preview && (
          <div className="ml-auto flex gap-1">
            <button type="button" onClick={() => setMode('write')} aria-pressed={mode === 'write'}>
              Write
            </button>
            <button
              type="button"
              onClick={() => setMode('preview')}
              aria-pressed={mode === 'preview'}
            >
              Preview
            </button>
          </div>
        )}
      </div>
      {mode === 'write' ? (
        <textarea
          ref={editorInput}
          id={id}
          data-markdown-editor
          aria-label={label ?? 'Markdown editor'}
          aria-describedby={
            [helperText && `${id}-helper`, errorId].filter(Boolean).join(' ') || undefined
          }
          aria-invalid={invalid || undefined}
          className="block w-full resize-y bg-background p-3 font-mono text-sm outline-none"
          rows={10}
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      ) : (
        <Suspense
          fallback={
            <div className="p-3" role="status">
              Loading preview…
            </div>
          }
        >
          <Preview value={value} />
        </Suspense>
      )}
      {imageError && (
        <p className="p-2 text-sm text-destructive" role="alert">
          {imageError}
        </p>
      )}
    </div>
  )
}

export function MarkdownEditor({ props, emit, bindings, children, loading = false }: Props) {
  const [value, setValue] = useBoundValue(props.value, bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
  const id = useId()
  const errorId = error ? `${id}-error` : undefined
  const upload = useUpload({
    name: props.name ?? 'markdownEditor',
    uploadUrl: props.uploadUrl ?? '',
    deleteUrl: props.uploadUrl ?? '',
    multiple: false,
    image: true,
    reorderable: false,
    downloadable: false,
    previewable: false,
  })
  const update = useCallback(
    (text: string) => {
      setValue(text)
      emit('change', text)
    },
    [emit, setValue]
  )
  return (
    <div className="space-y-2" aria-busy={loading}>
      {props.label && (
        <label htmlFor={id} className="block text-sm font-medium">
          {props.label}
        </label>
      )}
      {props.helperText && (
        <p id={`${id}-helper`} className="text-sm text-muted-foreground">
          {props.helperText}
        </p>
      )}
      <Suspense
        fallback={
          <div
            className="h-64 rounded-md border bg-muted/20"
            aria-label="Loading Markdown editor"
            role="status"
          />
        }
      >
        <MarkdownInput
          id={id}
          label={props.label}
          helperText={props.helperText}
          errorId={errorId}
          invalid={!!error}
          value={value ?? ''}
          onChange={update}
          toolbar={
            props.toolbar ?? [
              'bold',
              'italic',
              'link',
              'heading',
              'bulletList',
              'orderedList',
              'code',
              ...(props.uploadUrl ? ['image'] : []),
            ]
          }
          uploadImage={upload.upload}
          uploadUrl={props.uploadUrl}
          disabled={props.disabled || loading}
          readOnly={props.readOnly}
          preview={props.preview ?? true}
        />
      </Suspense>
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {children}
    </div>
  )
}
export default MarkdownEditor
