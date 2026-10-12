import { lazy, useCallback, useEffect, useId, useRef, useState } from 'react'
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import type { UploadResponse } from '@rikology/pupitre/catalog'
import { useBoundValue, useFieldError, useUpload } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import { Button, FieldDescription, Tooltip, cn, controlGroupClasses } from '../primitives/index.js'

export type RichEditorProps = {
  props: {
    name?: string
    value?: string | null
    label?: string | null
    helperText?: string | null
    error?: unknown
    toolbar?: string[]
    uploadUrl?: string
    minHeight?: number
    maxHeight?: number
    disabled?: boolean
    readOnly?: boolean
  }
  children?: ReactNode
  emit: (event: string, payload?: unknown) => void
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

type LazyEditorProps = {
  id: string
  value: string
  onChange: (html: string) => void
  toolbar: string[]
  minHeight?: number
  maxHeight?: number
  uploadUrl?: string
  uploadImage: (file: File) => Promise<UploadResponse>
  disabled?: boolean
  readOnly?: boolean
  label?: string
  describedBy?: string
  invalid: boolean
}

const TiptapEditor = lazy(async () => {
  const [reactEditor, starterKitModule, linkModule, imageModule] = await Promise.all([
    import('@tiptap/react'),
    import('@tiptap/starter-kit'),
    import('@tiptap/extension-link'),
    import('@tiptap/extension-image'),
  ])
  const StarterKit = starterKitModule.default
  const Link = linkModule.default
  const Image = imageModule.default
  function Editor({
    id,
    value,
    onChange,
    toolbar,
    minHeight,
    maxHeight,
    uploadUrl,
    uploadImage: uploadFile,
    disabled,
    readOnly,
    label,
    describedBy,
    invalid,
  }: LazyEditorProps) {
    const imageInput = useRef<HTMLInputElement>(null)
    const [uploadingImage, setUploadingImage] = useState(false)
    const [imageError, setImageError] = useState<string>()
    const editor = reactEditor.useEditor({
      // Tiptap v3 StarterKit bundles Link; disable it so the configured Link is the only one.
      extensions: [
        StarterKit.configure({ link: false }),
        Link.configure({ openOnClick: false }),
        Image,
      ],
      content: value,
      editable: !disabled && !readOnly,
      onUpdate: ({ editor: current }) => onChange(current.getHTML()),
      immediatelyRender: false,
      editorProps: {
        attributes: {
          'id': id,
          'class': 'min-h-[inherit] outline-none',
          'role': 'textbox',
          'aria-label': label ?? 'Rich text editor',
          'aria-multiline': 'true',
          'aria-invalid': String(invalid),
          'aria-describedby': describedBy ?? '',
          'aria-readonly': String(!!readOnly),
          'aria-disabled': String(!!disabled),
        },
      },
    })
    useEffect(() => {
      if (editor && editor.getHTML() !== value)
        editor.commands.setContent(value, { emitUpdate: false })
    }, [editor, value])
    async function uploadImage(file: File) {
      if (!uploadUrl) return
      setImageError(undefined)
      setUploadingImage(true)
      try {
        const response = await uploadFile(file)
        editor?.chain().focus().setImage({ src: response.url }).run()
      } catch (cause) {
        setImageError(cause instanceof Error ? cause.message : 'Image upload failed.')
      } finally {
        setUploadingImage(false)
      }
    }
    if (!editor)
      return (
        <div
          className="rounded-lg border border-input bg-card shadow-control"
          style={{ minHeight: minHeight ?? 180 }}
          aria-hidden="true"
        />
      )

    const controls: Record<string, { label: string; run: () => void; active?: boolean }> = {
      bold: {
        label: 'Bold',
        run: () => editor.chain().focus().toggleBold().run(),
        active: editor.isActive('bold'),
      },
      italic: {
        label: 'Italic',
        run: () => editor.chain().focus().toggleItalic().run(),
        active: editor.isActive('italic'),
      },
      strike: {
        label: 'Strike',
        run: () => editor.chain().focus().toggleStrike().run(),
        active: editor.isActive('strike'),
      },
      heading: {
        label: 'Heading',
        run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        active: editor.isActive('heading'),
      },
      h2: {
        label: 'Heading 2',
        run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        active: editor.isActive('heading', { level: 2 }),
      },
      h3: {
        label: 'Heading 3',
        run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        active: editor.isActive('heading', { level: 3 }),
      },
      codeBlock: {
        label: 'Code block',
        run: () => editor.chain().focus().toggleCodeBlock().run(),
        active: editor.isActive('codeBlock'),
      },
      bulletList: {
        label: 'Bulleted list',
        run: () => editor.chain().focus().toggleBulletList().run(),
        active: editor.isActive('bulletList'),
      },
      orderedList: {
        label: 'Numbered list',
        run: () => editor.chain().focus().toggleOrderedList().run(),
        active: editor.isActive('orderedList'),
      },
      blockquote: {
        label: 'Quote',
        run: () => editor.chain().focus().toggleBlockquote().run(),
        active: editor.isActive('blockquote'),
      },
      undo: { label: 'Undo', run: () => editor.chain().focus().undo() },
      redo: { label: 'Redo', run: () => editor.chain().focus().redo() },
      link: {
        label: 'Link',
        run: () => {
          const href = window.prompt('Link URL')
          if (href) editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
        },
        active: editor.isActive('link'),
      },
      image: { label: 'Insert image', run: () => imageInput.current?.click() },
    }
    const icons: Record<string, string> = {
      'Bold': 'bold',
      'Italic': 'italic',
      'Strike': 'strikethrough',
      'Heading': 'heading',
      'Heading 2': 'heading',
      'Heading 3': 'heading',
      'Code block': 'code',
      'Bulleted list': 'list',
      'Numbered list': 'list-ordered',
      'Quote': 'quote',
      'Undo': 'undo-2',
      'Redo': 'undo-2',
      'Link': 'link',
      'Insert image': 'image',
    }
    const actions = toolbar
      .map((name) => controls[name])
      .filter((_, index) => toolbar[index] !== 'image' || Boolean(uploadUrl))
      .filter((control): control is NonNullable<typeof control> => Boolean(control))
    return (
      <div className={cn(controlGroupClasses, 'flex-col', disabled && 'bg-muted shadow-none')}>
        {actions.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1.5"
            role="toolbar"
            aria-label="Text formatting"
            onKeyDown={(event) => {
              const buttons = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
              )
              const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
              const next =
                event.key === 'Home'
                  ? buttons[0]
                  : event.key === 'End'
                    ? buttons[buttons.length - 1]
                    : event.key === 'ArrowRight'
                      ? buttons[(index + 1) % buttons.length]
                      : event.key === 'ArrowLeft'
                        ? buttons[(index - 1 + buttons.length) % buttons.length]
                        : undefined
              if (!next) return
              event.preventDefault()
              next.focus()
            }}
          >
            {actions.map((control) => (
              <Tooltip key={control.label} label={control.label}>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  square
                  disabled={disabled || readOnly}
                  aria-label={control.label}
                  aria-pressed={control.active}
                  className="aria-pressed:bg-primary-soft aria-pressed:text-primary-ink active:bg-accent"
                  onClick={control.run}
                >
                  <Icon
                    name={icons[control.label]}
                    className={control.label === 'Redo' ? '-scale-x-100' : undefined}
                  />
                </Button>
              </Tooltip>
            ))}
          </div>
        )}
        {uploadUrl && (
          <div className="px-3 pt-2">
            <input
              ref={imageInput}
              className="sr-only"
              type="file"
              accept="image/*"
              disabled={disabled || readOnly || uploadingImage}
              aria-label="Choose an image to upload"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                if (file) void uploadImage(file)
                event.currentTarget.value = ''
              }}
            />
            {uploadingImage && (
              <p className="text-sm text-muted-foreground" role="status">
                Uploading image…
              </p>
            )}
            {imageError && (
              <p className="text-sm text-destructive" role="alert">
                {imageError}
              </p>
            )}
          </div>
        )}
        <reactEditor.EditorContent
          editor={editor}
          className="min-w-0 px-4 py-3 text-sm leading-7 text-foreground [&_.tiptap]:outline-none [&_p]:my-2 [&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary-ink [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.8125rem] [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_blockquote]:my-3 [&_blockquote]:rounded-lg [&_blockquote]:bg-muted/60 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:text-muted-foreground [&_img]:max-w-full"
          style={{
            minHeight: minHeight ?? 180,
            maxHeight,
            overflowY: maxHeight ? 'auto' : undefined,
          }}
        />
      </div>
    )
  }
  return { default: Editor }
})

export function RichEditor({ props, emit, bindings, children, loading = false }: RichEditorProps) {
  const [value, setValue] = useBoundValue(props.value, bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
  const generatedId = useId()
  const describedBy =
    [props.helperText && `${generatedId}-helper`, error && `${generatedId}-error`]
      .filter(Boolean)
      .join(' ') || undefined
  const uploadApi = useUpload({
    name: props.name ?? 'richEditor',
    uploadUrl: props.uploadUrl ?? '',
    deleteUrl: props.uploadUrl ?? '',
    multiple: false,
    image: true,
    reorderable: false,
    downloadable: false,
    previewable: false,
  })
  const update = useCallback(
    (html: string) => {
      setValue(html)
      emit('change', html)
    },
    [emit, setValue]
  )
  const toolbar = props.toolbar ?? [
    'bold',
    'italic',
    'h2',
    'h3',
    'link',
    ...(props.uploadUrl ? ['image'] : []),
    'bulletList',
    'orderedList',
    'codeBlock',
    'undo',
    'redo',
  ]
  return (
    <div className="grid gap-1.5" aria-busy={loading}>
      {props.label && (
        <label htmlFor={generatedId} className="text-sm font-medium leading-5 text-foreground">
          {props.label}
        </label>
      )}
      <Suspense
        fallback={
          <div
            className="rounded-lg border border-input bg-card shadow-control"
            style={{ minHeight: props.minHeight ?? 180 }}
            aria-label="Loading editor"
            role="status"
          />
        }
      >
        <TiptapEditor
          id={generatedId}
          value={value ?? ''}
          onChange={update}
          toolbar={toolbar}
          uploadUrl={props.uploadUrl}
          uploadImage={uploadApi.upload}
          minHeight={props.minHeight}
          maxHeight={props.maxHeight}
          disabled={props.disabled || loading}
          readOnly={props.readOnly}
          label={props.label ?? undefined}
          describedBy={describedBy}
          invalid={!!error}
        />
      </Suspense>
      {props.helperText && (
        <FieldDescription id={`${generatedId}-helper`}>{props.helperText}</FieldDescription>
      )}
      {error && (
        <p
          id={`${generatedId}-error`}
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

export default RichEditor
