import { lazy, Suspense, useId } from 'react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useBoundValue, useFieldError, useStateValue, useUpload } from '@rikology/pupitre-react'
import type { FileUploadDescriptor, UploadResponse } from '@rikology/pupitre/catalog'
import { Button, buttonClasses, FieldDescription } from '../primitives/index.js'
import { Icon } from '../icons.js'

function formatSize(size: number): string {
  return size < 1024 * 1024
    ? `${Math.ceil(size / 1024)} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const ImageCropper = lazy(() => import('./ImageCropper.js'))
export type FileUploadProps = {
  props: {
    descriptor: FileUploadDescriptor
    value?: string | string[] | null
    label?: string | null
    helperText?: string | null
    error?: unknown
    disabled?: boolean
    readOnly?: boolean
    required?: boolean
  }
  children?: ReactNode
  emit: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

function keysOf(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value
  return typeof value === 'string' && value !== '' ? [value] : []
}

export function FileUpload({ props, children, emit, bindings, loading = false }: FileUploadProps) {
  const { descriptor } = props
  const [value, setValue] = useBoundValue(props.value, bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
  const id = useId()
  const uploadApi = useUpload(descriptor)
  const [working, setWorking] = useState(false)
  const [workingFile, setWorkingFile] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string>()
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadResponse>>({})
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropKey, setCropKey] = useState<string | null>(null)
  const dirty = useStateValue('/meta/dirty')
  const wasDirty = useRef(false)
  useEffect(() => {
    if (dirty === true) wasDirty.current = true
    else if (dirty === false && wasDirty.current) {
      setUploadedFiles({})
      wasDirty.current = false
    }
  }, [dirty])
  const [dragOver, setDragOver] = useState(false)
  const keys = keysOf(value)
  const canChoose =
    !props.disabled &&
    !props.readOnly &&
    !loading &&
    !working &&
    (!descriptor.multiple || descriptor.maxFiles === undefined || keys.length < descriptor.maxFiles)

  async function uploadFiles(files: FileList | null, cropApplied = false) {
    if (!files?.length) return
    setLocalError(undefined)
    const chosen = Array.from(files)
    const capacity =
      cropApplied && cropKey
        ? 1
        : descriptor.multiple
          ? Math.max(0, (descriptor.maxFiles ?? Infinity) - keys.length)
          : 1
    if (chosen.length > capacity) {
      setLocalError(
        descriptor.maxFiles === undefined
          ? 'Only one file can be uploaded.'
          : `You can upload at most ${descriptor.maxFiles} file(s).`
      )
      return
    }
    const invalid = chosen.find(
      (file) => descriptor.maxSize !== undefined && file.size > descriptor.maxSize
    )
    if (invalid) {
      setLocalError(`${invalid.name} exceeds the maximum file size.`)
      return
    }
    if (
      !cropApplied &&
      descriptor.imageEditor &&
      chosen.some((file) => file.type.startsWith('image/'))
    ) {
      if (chosen.length !== 1) {
        setLocalError('Choose one image at a time when image editing is enabled.')
        return
      }
      setCropFile(chosen[0]!)
      return
    }
    setWorking(true)
    let activeFile: string | null = null
    try {
      let nextKeys = keys
      for (const file of chosen) {
        activeFile = file.name
        setWorkingFile(activeFile)
        const response = await uploadApi.upload(file)
        setUploadedFiles((current) => ({ ...current, [response.key]: response }))
        nextKeys =
          cropApplied && cropKey
            ? nextKeys.map((key) => (key === cropKey ? response.key : key))
            : descriptor.multiple
              ? [...nextKeys, response.key]
              : [response.key]
        setValue(descriptor.multiple ? nextKeys : response.key)
        emit('change', descriptor.multiple ? nextKeys : response.key)
      }
    } catch (cause) {
      setLocalError(
        `${activeFile ? `${activeFile}: ` : ''}${cause instanceof Error ? cause.message : 'File upload failed.'}`
      )
    } finally {
      setWorking(false)
      setWorkingFile(null)
      setCropKey(null)
    }
  }

  function moveFile(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= keys.length) return
    const next = [...keys]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    setValue(next)
    emit('change', next)
    emit('reorder', next)
  }

  async function removeFile(key: string) {
    setLocalError(undefined)
    const next = descriptor.multiple ? keys.filter((existing) => existing !== key) : null
    if (!uploadedFiles[key]) {
      setValue(next)
      emit('change', next)
      return
    }
    setWorking(true)
    try {
      await uploadApi.remove(key)
      setUploadedFiles((current) => {
        const remaining = { ...current }
        delete remaining[key]
        return remaining
      })
      setValue(next)
      emit('change', next)
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Could not remove file.')
    } finally {
      setWorking(false)
    }
  }
  async function editImage(key: string) {
    setLocalError(undefined)
    setWorking(true)
    try {
      const response = await fetch(uploadedFiles[key]?.url ?? key)
      if (!response.ok) throw new Error('Could not load image.')
      const blob = await response.blob()
      setCropKey(key)
      setCropFile(
        new File([blob], uploadedFiles[key]?.name ?? key.split('/').pop() ?? 'image', {
          type: blob.type,
        })
      )
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Could not load image.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div
      className="space-y-3"
      onDragOver={(event) => {
        event.preventDefault()
        if (canChoose) setDragOver(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragOver(false)
        if (canChoose) void uploadFiles(event.dataTransfer.files)
      }}
    >
      {props.label && (
        <label htmlFor={id} className="block text-sm font-medium">
          {props.label}
          {props.required && <span aria-hidden="true"> *</span>}
        </label>
      )}
      {props.helperText && (
        <FieldDescription id={`${id}-helper`}>{props.helperText}</FieldDescription>
      )}
      <div className="space-y-2">
        {keys.map((key, index) => {
          const file = uploadedFiles[key]
          return (
            <div
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
              key={key}
            >
              {descriptor.image && descriptor.previewable && file?.url ? (
                <img className="size-12 rounded-lg object-cover" src={file.url} alt={file.name} />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <Icon name={descriptor.image ? 'image' : 'file'} className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{file?.name ?? key}</p>
                {file?.size !== undefined && (
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    {formatSize(file.size)}
                  </p>
                )}
              </div>
              {descriptor.downloadable && (
                <a
                  className={buttonClasses({
                    variant: 'link',
                    color: 'primary',
                    className: 'min-h-6 text-xs',
                  })}
                  href={file?.url ?? key}
                  download
                >
                  Download
                </a>
              )}
              {descriptor.previewable && (
                <a
                  className={buttonClasses({
                    variant: 'link',
                    color: 'primary',
                    className: 'min-h-6 text-xs',
                  })}
                  href={file?.url ?? key}
                  target="_blank"
                  rel="noreferrer"
                >
                  Preview
                </a>
              )}
              {descriptor.imageEditor && descriptor.image && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  square
                  aria-label={`Edit ${file?.name ?? key}`}
                  disabled={props.disabled || props.readOnly || loading || working}
                  onClick={() => void editImage(key)}
                >
                  <Icon name="pencil" />
                </Button>
              )}
              {descriptor.reorderable && (
                <span className="inline-flex gap-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    square
                    type="button"
                    aria-label={`Move ${key} earlier`}
                    disabled={index === 0 || props.disabled || props.readOnly || working}
                    onClick={() => moveFile(index, -1)}
                  >
                    <Icon name="arrow-up" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    square
                    type="button"
                    aria-label={`Move ${key} later`}
                    disabled={
                      index === keys.length - 1 || props.disabled || props.readOnly || working
                    }
                    onClick={() => moveFile(index, 1)}
                  >
                    <Icon name="arrow-down" />
                  </Button>
                </span>
              )}
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                square
                type="button"
                aria-label={`Remove ${key}`}
                disabled={props.disabled || props.readOnly || loading || working}
                onClick={() => void removeFile(key)}
              >
                <Icon name="x" />
              </Button>
            </div>
          )
        })}
        <label
          htmlFor={id}
          className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-muted/30 px-5 py-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/50 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20 ${dragOver ? 'border-primary bg-primary-soft/40' : ''} ${!canChoose ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <span className="mb-1 grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <Icon name="upload" className="size-5" />
          </span>
          <span className="text-sm text-foreground">
            {working ? (
              'Uploading…'
            ) : (
              <>
                Drag and drop or{' '}
                <span className="font-medium text-primary-ink underline-offset-4 hover:underline">
                  browse
                </span>
              </>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {descriptor.accept?.length
              ? descriptor.accept.join(', ')
              : descriptor.image
                ? 'Image files'
                : 'All file types'}
            {descriptor.maxSize !== undefined && ` · Max ${formatSize(descriptor.maxSize)}`}
          </span>
          <input
            className="sr-only"
            id={id}
            aria-label={props.label ?? 'Choose file'}
            aria-invalid={!!(error || localError)}
            aria-required={props.required}
            aria-describedby={
              [props.helperText && `${id}-helper`, (error || localError) && `${id}-error`]
                .filter(Boolean)
                .join(' ') || undefined
            }
            type="file"
            accept={descriptor.accept?.join(',')}
            multiple={descriptor.multiple}
            disabled={!canChoose}
            onChange={(event) => {
              void uploadFiles(event.currentTarget.files)
              event.currentTarget.value = ''
            }}
          />
        </label>
        {working && (
          <div className="w-full space-y-1 text-sm text-muted-foreground" role="status">
            <span>Uploading {workingFile ?? 'file'}…</span>
            <div
              role="progressbar"
              aria-label="Upload progress"
              className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full w-1/2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
            </div>
          </div>
        )}
      </div>
      {(error || localError) && (
        <p id={`${id}-error`} className="text-[0.8125rem] text-danger-ink" role="alert">
          {error ?? localError}
        </p>
      )}
      {cropFile && (
        <Suspense fallback={<div role="status">Loading image editor…</div>}>
          <ImageCropper
            file={cropFile}
            ratios={descriptor.imageEditorAspectRatios}
            onCancel={() => {
              setCropFile(null)
              setCropKey(null)
            }}
            onComplete={(cropped) => {
              setCropFile(null)
              const transfer = new DataTransfer()
              transfer.items.add(cropped)
              void uploadFiles(transfer.files, true)
            }}
          />
        </Suspense>
      )}
      {children}
    </div>
  )
}

export default FileUpload
