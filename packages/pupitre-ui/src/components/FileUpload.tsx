import { lazy, Suspense, useId } from 'react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useBoundValue, useFieldError, useStateValue, useUpload } from '@rikology/pupitre-react'
import type { FileUploadDescriptor, UploadResponse } from '@rikology/pupitre/catalog'

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
    const capacity = descriptor.multiple
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
        nextKeys = descriptor.multiple ? [...nextKeys, response.key] : [response.key]
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

  return (
    <div
      className={`space-y-2 rounded-md transition-colors ${dragOver ? 'bg-accent/40 ring-2 ring-primary' : ''}`}
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
        <p id={`${id}-helper`} className="text-sm text-muted-foreground">
          {props.helperText}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {keys.map((key, index) => {
          const file = uploadedFiles[key]
          return (
            <div
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              key={key}
            >
              {descriptor.image && descriptor.previewable && file?.url && (
                <img className="h-10 w-10 rounded object-cover" src={file.url} alt={file.name} />
              )}
              <span className="max-w-64 truncate">{file?.name ?? key}</span>
              {descriptor.downloadable && (
                <a className="text-primary underline" href={file?.url ?? key} download>
                  Download
                </a>
              )}
              {descriptor.previewable && (
                <a
                  className="text-primary underline"
                  href={file?.url ?? key}
                  target="_blank"
                  rel="noreferrer"
                >
                  Preview
                </a>
              )}
              {descriptor.reorderable && (
                <span className="inline-flex gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${key} earlier`}
                    disabled={index === 0 || props.disabled || props.readOnly || working}
                    onClick={() => moveFile(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${key} later`}
                    disabled={
                      index === keys.length - 1 || props.disabled || props.readOnly || working
                    }
                    onClick={() => moveFile(index, 1)}
                  >
                    ↓
                  </button>
                </span>
              )}
              <button
                type="button"
                aria-label={`Remove ${key}`}
                disabled={props.disabled || props.readOnly || loading || working}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                onClick={() => void removeFile(key)}
              >
                Remove
              </button>
            </div>
          )
        })}
        <label
          className={`inline-flex h-9 cursor-pointer items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent ${!canChoose ? 'pointer-events-none opacity-50' : ''}`}
        >
          {working ? 'Uploading…' : 'Choose file'}
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
            <progress className="h-1 w-full accent-primary" aria-label="Upload progress" />
          </div>
        )}
      </div>
      {(error || localError) && (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error ?? localError}
        </p>
      )}
      {cropFile && (
        <Suspense fallback={<div role="status">Loading image editor…</div>}>
          <ImageCropper
            file={cropFile}
            ratios={descriptor.imageEditorAspectRatios}
            onCancel={() => setCropFile(null)}
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
