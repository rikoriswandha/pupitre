import { lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import type { UploadResponse } from '@rikology/pupitre/catalog'
import { useBoundValue, useFieldError, useUpload } from '@rikology/pupitre-react'

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
  value: string
  onChange: (html: string) => void
  toolbar: string[]
  minHeight?: number
  maxHeight?: number
  uploadUrl?: string
  uploadImage: (file: File) => Promise<UploadResponse>
  disabled?: boolean
  readOnly?: boolean
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
    value,
    onChange,
    toolbar,
    minHeight,
    maxHeight,
    uploadUrl,
    uploadImage: uploadFile,
    disabled,
    readOnly,
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
          className="rounded-md border bg-background"
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
    const actions = toolbar
      .map((name) => controls[name])
      .filter((_, index) => toolbar[index] !== 'image' || Boolean(uploadUrl))
      .filter((control): control is NonNullable<typeof control> => Boolean(control))
    return (
      <div className="overflow-hidden rounded-md border border-input bg-background">
        {actions.length > 0 && (
          <div
            className="flex flex-wrap gap-1 border-b p-1"
            role="toolbar"
            aria-label="Text formatting"
          >
            {actions.map((control) => (
              <button
                key={control.label}
                type="button"
                disabled={disabled || readOnly}
                aria-label={control.label}
                aria-pressed={control.active}
                className={`rounded px-2 py-1 text-sm hover:bg-accent disabled:opacity-50 ${control.active ? 'bg-accent font-semibold' : ''}`}
                onClick={control.run}
              >
                {control.label}
              </button>
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
          className="prose prose-sm max-w-none px-3 py-2 focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:leading-6 [&_.tiptap_p]:my-2 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5"
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
    <div className="space-y-2" aria-busy={loading}>
      {props.label && <label className="block text-sm font-medium">{props.label}</label>}
      {props.helperText && <p className="text-sm text-muted-foreground">{props.helperText}</p>}
      <Suspense
        fallback={
          <div
            className="rounded-md border bg-muted/20"
            style={{ minHeight: props.minHeight ?? 180 }}
            aria-label="Loading editor"
          />
        }
      >
        <TiptapEditor
          value={value ?? ''}
          onChange={update}
          toolbar={toolbar}
          uploadUrl={props.uploadUrl}
          uploadImage={uploadApi.upload}
          minHeight={props.minHeight}
          maxHeight={props.maxHeight}
          disabled={props.disabled || loading}
          readOnly={props.readOnly}
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

export default RichEditor
