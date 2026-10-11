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
import { Button, Input } from '../primitives/index.js'

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
      <Button type="button" variant="outline" disabled={busy && !polling} onClick={close}>
        {t('Cancel')}
      </Button>
      <Button type="button" disabled={busy} onClick={() => void importRows()}>
        {busy ? t('Importing…') : t('Import CSV')}
      </Button>
    </div>
  ) : (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" disabled={busy && !polling} onClick={close}>
        {t('Cancel')}
      </Button>
      <Button type="button" disabled={busy || !file} onClick={() => void previewCsv()}>
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
        <Dialog.Backdrop
          className="fixed inset-0 z-[70] bg-black/45"
          style={{ position: 'fixed', inset: 0, zIndex: 70 }}
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-[70] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-background shadow-xl outline-none"
          style={{
            position: 'fixed',
            zIndex: 71,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'calc(100% - 2rem)',
            maxWidth: '42rem',
            maxHeight: 'calc(100dvh - 2rem)',
            overflowY: 'auto',
          }}
        >
          <header className="border-b border-border p-5">
            <Dialog.Title id="pupitre-import-heading" className="text-lg font-semibold">
              {t('Import CSV')}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              {t('Upload a CSV file, map its headers to form fields, then review the import.')}
            </Dialog.Description>
          </header>
          <div className="grid gap-4 p-5">
            {!preview && (
              <div className="grid gap-2">
                <label
                  className="text-sm font-medium leading-none text-foreground"
                  htmlFor="pupitre-import-file"
                >
                  {t('CSV file')}
                </label>
                <Input
                  id="pupitre-import-file"
                  type="file"
                  aria-label={t('CSV file')}
                  accept=".csv,text/csv"
                  onChange={chooseFile}
                />
              </div>
            )}
            {preview && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t('Previewing')} {preview.preview.length} {t('sample rows from')}{' '}
                  {preview.headers.length} {t('columns')}.
                </p>
                <div className="max-h-80 overflow-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="p-2 text-left">{t('CSV header')}</th>
                        <th className="p-2 text-left">{t('Import field')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.headers.map((header) => (
                        <tr key={header} className="border-t border-border">
                          <td className="p-2">{header}</td>
                          <td className="p-2">
                            <select
                              className="h-9 w-full rounded-md border border-border bg-background px-2"
                              aria-label={`${t('Map')} ${header}`}
                              value={mapping[header] ?? ''}
                              onChange={(event) =>
                                setMapping((current) => ({
                                  ...current,
                                  [header]: event.target.value,
                                }))
                              }
                            >
                              <option value="">{t('Skip column')}</option>
                              {preview.fields.map((field) => (
                                <option key={field.name} value={field.name}>
                                  {field.label}
                                  {field.required ? ' *' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {progress && progress.status !== 'done' && (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                {t('Import progress')}: {progress.processedRows} / {progress.totalRows}
              </p>
            )}
            {summary && (
              <div
                className="rounded-md border border-border p-3 text-sm"
                role="status"
                aria-live="polite"
              >
                <p>
                  {summary.created} {t('created')}, {summary.updated} {t('updated')},{' '}
                  {summary.failed} {t('failed')}.
                </p>
                {summary.failedRowsUrl && (
                  <a
                    className="mt-2 inline-block text-primary underline"
                    href={summary.failedRowsUrl}
                  >
                    {t('Download failed rows CSV')}
                  </a>
                )}
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <footer className="border-t border-border p-4">{footer}</footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
