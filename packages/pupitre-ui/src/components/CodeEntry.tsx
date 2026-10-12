import { useState } from 'react'
import { t } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import { Button, Tooltip } from '../primitives/index.js'
import type { EntryProps } from './EntryShell.js'
import { EntryShell } from './EntryShell.js'

export function CodeEntry({ props = {} }: { props?: EntryProps }) {
  const [copyResult, setCopyResult] = useState<{
    value: string
    status: 'copied' | 'failed'
  } | null>(null)
  const value =
    typeof props.value === 'string'
      ? props.value
      : props.value === null || props.value === undefined
        ? ''
        : JSON.stringify(props.value, null, 2)
  // A result only describes the value it was produced for; new values reset to idle.
  const copyStatus = copyResult?.value === value ? copyResult.status : 'idle'
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopyResult({ value, status: 'copied' })
    } catch {
      setCopyResult({ value, status: 'failed' })
    }
  }
  return (
    <EntryShell label={props.label} columnSpan={props.columnSpan}>
      {value ? (
        <div className="overflow-hidden rounded-lg border border-input bg-card text-foreground shadow-control">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
            <Icon name="code" className="size-3.5" />
            <span>{t('Code')}</span>
            <span className="ml-auto" role="status">
              {copyStatus === 'copied'
                ? t('Copied')
                : copyStatus === 'failed'
                  ? t('Could not copy')
                  : ''}
            </span>
            <Tooltip label={copyStatus === 'copied' ? t('Copied') : t('Copy code')}>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                square
                aria-label={t('Copy {label}', { label: props.label ?? t('code') })}
                onClick={() => void copy()}
              >
                <Icon name={copyStatus === 'copied' ? 'check' : 'copy'} />
              </Button>
            </Tooltip>
          </div>
          <pre
            tabIndex={0}
            aria-label={props.label ?? t('Code')}
            className="max-h-96 overflow-auto px-4 py-3 font-mono text-[0.8125rem] leading-7 outline-none selection:bg-primary/20 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/20"
          >
            <code>{value}</code>
          </pre>
        </div>
      ) : (
        <span className="text-muted-foreground">{props.placeholder ?? '—'}</span>
      )}
    </EntryShell>
  )
}
