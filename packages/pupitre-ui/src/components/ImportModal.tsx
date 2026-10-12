import { Dialog } from '@base-ui/react/dialog'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  importJobResponse,
  importPreviewResponse,
  importResultResponse,
} from '@rikology/pupitre/catalog'
import type { ImportPreviewResponse, ImportResultResponse } from '@rikology/pupitre/catalog'
import type { ExportProgressResponse } from '@rikology/pupitre/catalog'
import type { ImportModalProps } from '@rikology/pupitre-react'
import { jsonFetch } from '@rikology/pupitre-react'
import { t } from '@rikology/pupitre-react'
import { useToast, waitForExport } from '@rikology/pupitre-react'
import {
  Badge,
  Button,
  backdropClasses,
  buttonClasses,
  dialogPopupClasses,
  SelectMenu,
} from '../primitives/index.js'
import { Icon } from '../icons.js'

function importUrl(actionUrl: string, suffix: string): string {
  const url = new URL(actionUrl, window.location.origin)
  url.pathname = `${url.pathname.replace(/\/$/, '')}${suffix}`
  return `${url.pathname}${url.search}`
}

async function uploadCsv(url: string, file: File, mapping?: Record<string, string>) {
  const body = new FormData()
  body.append('file', file)
  if (mapping) body.append('mapping', JSON.stringify(mapping))
  const response = await jsonFetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'X-Pupitre-Action': '1',
      'X-Pupitre-Url': `${window.location.pathname}${window.location.search}`,
    },
    body,
  })
  const payload: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : `Import request failed (${response.status})`
    throw new Error(message)
  }
  return payload
}

export function ImportModal({ open, action, onClose, onComplete }: ImportModalProps) {
  const toast = useToast()
  const pollController = useRef<AbortController | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [polling, setPolling] = useState(false)
  const [summary, setSummary] = useState<ImportResultResponse | null>(null)
  const [progress, setProgress] = useState<ExportProgressResponse | null>(null)
  const [previousOpen, setPreviousOpen] = useState(open)
  if (previousOpen !== open) {
    setPreviousOpen(open)
    if (!open) {
      setBusy(false)
      setPolling(false)
      setProgress(null)
    }
  }
  useEffect(() => {
    if (!open) {
      pollController.current?.abort()
      pollController.current = null
      return
    }
    return () => pollController.current?.abort()
  }, [open])

  const close = () => {
    if (busy && !polling) return
    if (polling) {
      pollController.current?.abort()
      pollController.current = null
      setPolling(false)
      setBusy(false)
      setProgress(null)
      toast({ type: 'info', title: t('Import continues in background') })
    }
    onClose()
  }

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.currentTarget.files?.[0] ?? null
    setFile(selected)
    setPreview(null)
    setMapping({})
    setSummary(null)
    setProgress(null)
    setError(null)
  }

  const previewCsv = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const payload = await uploadCsv(importUrl(action.url, '/preview'), file)
      const parsed = importPreviewResponse.safeParse(payload)
      if (!parsed.success) throw new Error('The server returned an invalid CSV preview.')
      setPreview(parsed.data)
      setMapping(
        Object.fromEntries(
          parsed.data.headers.map((header) => [
            header,
            parsed.data.fields.some((field) => field.name === header) ? header : '',
          ])
        )
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to read the CSV file.')
    } finally {
      setBusy(false)
    }
  }

  const importRows = async () => {
    if (!file || !preview) return
    setBusy(true)
    setError(null)
    setProgress(null)
    const controller = new AbortController()
    pollController.current = controller
    try {
      const payload = await uploadCsv(action.url, file, mapping)
      if (controller.signal.aborted) return
      const synchronous = importResultResponse.safeParse(payload)
      if (synchronous.success) {
        setSummary(synchronous.data)
        onComplete(synchronous.data)
        return
      }
      const job = importJobResponse.safeParse(payload)
      if (!job.success) throw new Error('The server returned an invalid import response.')
      setPolling(true)
      const completedProgress = await waitForExport(
        job.data,
        (next) => {
          if (!controller.signal.aborted) setProgress(next)
        },
        { signal: controller.signal }
      )
      if (controller.signal.aborted) return
      const result = importResultResponse.safeParse({
        total: completedProgress.totalRows,
        created: completedProgress.createdRows ?? 0,
        updated: completedProgress.updatedRows ?? 0,
        failed: completedProgress.failedRows ?? 0,
        ...(completedProgress.failedRowsUrl
          ? { failedRowsUrl: completedProgress.failedRowsUrl }
          : {}),
      })
      if (!result.success) throw new Error('The server returned an invalid import summary.')
      setSummary(result.data)
      onComplete(result.data)
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'Unable to import CSV rows.')
    } finally {
      if (pollController.current === controller) pollController.current = null
      if (!controller.signal.aborted) {
        setBusy(false)
        setPolling(false)
      }
    }
  }

  const footer = summary ? (
    <Button type="button" onClick={close}>
      {t('Close')}
    </Button>
  ) : preview ? (
    <div className="flex justify-end gap-2">
      <Button type="button" color="gray" disabled={busy && !polling} onClick={close}>
        {t('Cancel')}
      </Button>
      <Button type="button" color="primary" loading={busy} onClick={() => void importRows()}>
        {busy ? t('Importing…') : t('Import CSV')}
      </Button>
    </div>
  ) : (
    <div className="flex justify-end gap-2">
      <Button type="button" color="gray" disabled={busy && !polling} onClick={close}>
        {t('Cancel')}
      </Button>
      <Button
        type="button"
        color="primary"
        loading={busy}
        disabled={!file}
        onClick={() => void previewCsv()}
      >
        {busy ? t('Reading…') : t('Continue')}
      </Button>
    </div>
  )

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={backdropClasses} />
        <Dialog.Popup
          data-pupitre-popup=""
          initialFocus={preview ? true : fileInput}
          className={dialogPopupClasses('2xl')}
        >
          <header className="flex shrink-0 items-start gap-3 px-6 pt-5 pb-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-ink">
              <Icon name="upload" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title
                id="pupitre-import-heading"
                className="text-base font-semibold leading-6"
              >
                {t('Import CSV')}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[0.8125rem] leading-5 text-muted-foreground">
                {t('Upload a CSV file, map its headers to form fields, then review the import.')}
              </Dialog.Description>
            </div>
            <Button
              type="button"
              variant="ghost"
              square
              size="sm"
              aria-label={t('Close dialog')}
              disabled={busy && !polling}
              onClick={close}
            >
              <Icon name="x" className="size-4" />
            </Button>
          </header>
          <div className="grid min-h-0 gap-5 overflow-y-auto px-6 pb-5">
            {!preview && (
              <label
                className="relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-input bg-muted/20 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary-soft/30 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20"
                htmlFor="pupitre-import-file"
              >
                <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Icon name={file ? 'file-text' : 'upload'} className="size-5" />
                </span>
                <span className="text-sm font-medium">{file ? file.name : t('CSV file')}</span>
                <span className="text-[0.8125rem] text-muted-foreground">
                  {t('Choose a CSV file to import')}
                </span>
                <input
                  ref={fileInput}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                  id="pupitre-import-file"
                  type="file"
                  aria-label={t('CSV file')}
                  accept=".csv,text/csv"
                  disabled={busy}
                  onChange={chooseFile}
                />
              </label>
            )}
            {preview && (
              <>
                <p className="text-[0.8125rem] leading-5 text-muted-foreground">
                  {t('Previewing')} {preview.preview.length} {t('sample rows from')}{' '}
                  {preview.headers.length} {t('columns')}.
                </p>
                <div className="max-h-80 overflow-auto rounded-lg border border-border">
                  <div className="grid grid-cols-2 gap-4 bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    <span>{t('CSV header')}</span>
                    <span>{t('Import field')}</span>
                  </div>
                  <div className="divide-y divide-border">
                    {preview.headers.map((header) => (
                      <div key={header} className="grid grid-cols-2 items-center gap-4 px-4 py-3">
                        <label
                          htmlFor={`pupitre-import-map-${header}`}
                          className="min-w-0 break-words text-sm font-medium"
                        >
                          {header}
                        </label>
                        <SelectMenu
                          id={`pupitre-import-map-${header}`}
                          aria-label={`${t('Map')} ${header}`}
                          value={mapping[header] ?? ''}
                          disabled={busy}
                          onValueChange={(next) =>
                            setMapping((current) => ({ ...current, [header]: next }))
                          }
                          options={[
                            { value: '', label: t('Skip column') },
                            ...preview.fields.map((field) => ({
                              value: field.name,
                              label: `${field.label}${field.required ? ' *' : ''}`,
                            })),
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            {polling && (
              <div
                className="grid gap-3 rounded-lg bg-muted/40 p-4"
                role="status"
                aria-live="polite"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[0.8125rem] text-muted-foreground">
                    {t('Import progress')}: {progress?.processedRows ?? 0} /{' '}
                    {progress?.totalRows ?? 0}
                  </p>
                  <Badge color="info" icon="loader-circle">
                    {t('Importing…')}
                  </Badge>
                </div>
                <div
                  role="progressbar"
                  aria-label={t('Import progress')}
                  aria-valuemin={0}
                  aria-valuemax={progress?.totalRows || 100}
                  aria-valuenow={progress?.processedRows ?? 0}
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${progress?.totalRows ? Math.min(100, (progress.processedRows / progress.totalRows) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {summary && (
              <div
                className="grid gap-3 rounded-lg bg-muted/40 p-4 text-sm"
                role="status"
                aria-live="polite"
              >
                <div>
                  <Badge
                    color={summary.failed ? 'warning' : 'success'}
                    icon={summary.failed ? 'triangle-alert' : 'circle-check'}
                  >
                    {t('Import complete')}
                  </Badge>
                </div>
                <p>
                  {summary.created} {t('created')}, {summary.updated} {t('updated')},{' '}
                  {summary.failed} {t('failed')}.
                </p>
                {summary.failedRowsUrl && (
                  <a
                    className={buttonClasses({
                      variant: 'link',
                      color: 'primary',
                      className: 'min-h-6 justify-self-start text-[0.8125rem]',
                    })}
                    href={summary.failedRowsUrl}
                  >
                    {t('Download failed rows CSV')}
                  </a>
                )}
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-danger-soft px-4 py-3 text-[0.8125rem] leading-5 text-danger-ink"
              >
                {error}
              </p>
            )}
          </div>
          <footer className="flex shrink-0 justify-end border-t border-border bg-muted/30 px-6 py-3">
            {footer}
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
