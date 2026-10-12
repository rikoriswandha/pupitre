import { lazy, Suspense, useCallback, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { t, useBoundValue, useFieldError, useUpload } from '@rikology/pupitre-react'
import type { UploadResponse } from '@rikology/pupitre/catalog'
import { Icon } from '../icons.js'
import {
  Button,
  FieldDescription,
  Tooltip,
  cn,
  controlGroupClasses,
  segmentedItemClasses,
  segmentedListClasses,
} from '../primitives/index.js'

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
      <div
        className="min-h-64 px-4 py-3 text-sm leading-7 text-foreground [&_p]:my-2 [&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary-ink [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.8125rem] [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_blockquote]:my-3 [&_blockquote]:rounded-lg [&_blockquote]:bg-muted/60 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:text-muted-foreground [&_img]:max-w-full"
        dangerouslySetInnerHTML={{ __html: html }}
      />
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
      setImageError(error instanceof Error ? error.message : t('Could not upload image.'))
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
  const formatting: Record<string, { icon: string; label: string }> = {
    bold: { icon: 'bold', label: t('Bold') },
    italic: { icon: 'italic', label: t('Italic') },
    link: { icon: 'link', label: t('Link') },
    heading: { icon: 'heading', label: t('Heading') },
    h2: { icon: 'heading', label: t('Heading 2') },
    bulletList: { icon: 'list', label: t('Bulleted list') },
    orderedList: { icon: 'list-ordered', label: t('Numbered list') },
    code: { icon: 'code', label: t('Inline code') },
    codeBlock: { icon: 'code', label: t('Code block') },
    image: { icon: 'image', label: t('Insert image') },
  }
  return (
    <div className={cn(controlGroupClasses, 'flex-col', disabled && 'bg-muted shadow-none')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 p-1.5">
        <div
          className="flex flex-wrap items-center gap-0.5"
          role="toolbar"
          aria-label={t('Markdown formatting')}
        >
          {toolbar
            .filter((item) => item === 'image' || supportedToolbar[item] === true)
            .map((item) => (
              <Tooltip key={item} label={formatting[item]!.label}>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  square
                  aria-label={formatting[item]!.label}
                  disabled={
                    disabled || readOnly || mode === 'preview' || (item === 'image' && !uploadUrl)
                  }
                  className="active:bg-accent"
                  onClick={item === 'image' ? () => imageInput.current?.click() : actions[item]}
                >
                  <Icon name={formatting[item]!.icon} />
                </Button>
              </Tooltip>
            ))}
        </div>
        <input
          ref={imageInput}
          className="sr-only"
          type="file"
          aria-label={t('Choose an image to upload')}
          disabled={!uploadUrl || disabled || readOnly}
          accept="image/*"
          onChange={(event) => {
            void upload(event.currentTarget.files?.[0])
            event.currentTarget.value = ''
          }}
        />
        {preview && (
          <div
            className={cn(segmentedListClasses, 'ml-auto')}
            role="group"
            aria-label={t('Markdown editor mode')}
          >
            <button
              type="button"
              className={segmentedItemClasses}
              onClick={() => setMode('write')}
              aria-pressed={mode === 'write'}
            >
              {t('Write')}
            </button>
            <button
              type="button"
              className={segmentedItemClasses}
              onClick={() => setMode('preview')}
              aria-pressed={mode === 'preview'}
            >
              {t('Preview')}
            </button>
          </div>
        )}
      </div>
      {mode === 'write' ? (
        <textarea
          ref={editorInput}
          id={id}
          data-markdown-editor
          aria-label={label ?? t('Markdown editor')}
          aria-describedby={
            [helperText && `${id}-helper`, errorId].filter(Boolean).join(' ') || undefined
          }
          aria-invalid={invalid || undefined}
          className="block min-h-64 w-full resize-y bg-transparent px-4 py-3 font-mono text-[0.8125rem] leading-7 text-foreground outline-none placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:text-muted-foreground"
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
              {t('Loading preview…')}
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
    <div className="grid gap-1.5" aria-busy={loading}>
      {props.label && (
        <label htmlFor={id} className="text-sm font-medium leading-5 text-foreground">
          {props.label}
        </label>
      )}
      <Suspense
        fallback={
          <div
            className="h-64 rounded-lg border border-input bg-card shadow-control"
            aria-label={t('Loading Markdown editor')}
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
      {props.helperText && (
        <FieldDescription id={`${id}-helper`}>{props.helperText}</FieldDescription>
      )}
      {error && (
        <p
          id={errorId}
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
export default MarkdownEditor
