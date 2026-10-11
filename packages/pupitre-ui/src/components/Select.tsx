import { useId, useMemo, useState, type ReactNode } from 'react'
import {
  useBoundValue,
  useFieldError,
  useOptions,
  useRunAction,
  useRuntime,
} from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Select as BaseSelect } from '@base-ui/react/select'
import { Field, FieldError, Label } from '../primitives/index.js'
import { ActionModal } from '@rikology/pupitre-react'
import { t } from '@rikology/pupitre-react'
import { ActionButton } from './ActionButton.js'
type Props = Infer<typeof components.Select.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function Select({ props, bindings }: Runtime) {
  const initial = props.value ?? (props.multiple ? [] : '')
  const [value, setValue] = useBoundValue(initial, bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
  const [createOpen, setCreateOpen] = useState(false)
  const runtime = useRuntime()
  const runAction = useRunAction()
  const staticOptions = Array.isArray(props.options) ? props.options : []
  const asyncOptions = useOptions({
    url: props.optionsUrl,
    value,
    initial: staticOptions,
    preload: props.preload,
  })
  const generatedId = useId()
  const id = bindings?.value
    ? bindings.value.split('/').slice(2).join('.')
    : (props.name ?? generatedId)
  const options = props.optionsUrl ? asyncOptions.options : staticOptions
  const selectedOptions = Array.isArray(value)
    ? options.filter((option) =>
        value.some((selectedValue) => String(selectedValue) === String(option.value))
      )
    : (options.find((option) => String(option.value) === String(value)) ?? null)
  const selectOption = (option: (typeof options)[number]) => {
    if (Array.isArray(value)) {
      const isSelected = value.some((item) => String(item) === String(option.value))
      setValue(
        isSelected
          ? value.filter((item) => String(item) !== String(option.value))
          : [...value, option.value]
      )
    } else {
      setValue(option.value)
    }
  }
  const createOptionUrl = props.createOption?.url
  const createAction = useMemo(
    () =>
      createOptionUrl
        ? {
            name: `create-option-${id}`,
            label: t('Create option'),
            kind: 'form' as const,
            url: `${createOptionUrl}?create=1`,
            method: 'post' as const,
            enabled: true,
          }
        : undefined,
    [createOptionUrl, id]
  )
  const describedBy =
    [props.hint && `${id}-hint`, props.helperText && `${id}-helper`, error && `${id}-error`]
      .filter(Boolean)
      .join(' ') || undefined
  const columnStyle =
    props.columnSpan === null || props.columnSpan === undefined
      ? undefined
      : {
          gridColumn:
            props.columnSpan === 'full'
              ? '1 / -1'
              : `span ${props.columnSpan} / span ${props.columnSpan}`,
        }
  return (
    <div style={columnStyle}>
      <Field invalid={!!error}>
        {props.label !== null && props.label !== undefined && (
          <Label id={`${id}-label`} htmlFor={id}>
            {props.label}
            {props.required && <span aria-hidden="true"> *</span>}
          </Label>
        )}
        {props.optionsUrl ? (
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              {props.prefixAction && (
                <button
                  type="button"
                  disabled={!props.prefixAction.enabled}
                  onClick={() => void runAction(props.prefixAction!)}
                >
                  {props.prefixAction.label}
                </button>
              )}
              {props.searchable && (
                <input
                  id={id}
                  data-options-search
                  aria-label={props.label ?? t('Search options')}
                  aria-invalid={!!error}
                  aria-required={props.required}
                  aria-describedby={describedBy}
                  value={asyncOptions.search}
                  onChange={(event) => asyncOptions.setSearch(event.currentTarget.value)}
                  disabled={props.disabled}
                  className="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {Array.isArray(value)
                  ? ''
                  : Array.isArray(selectedOptions)
                    ? (props.placeholder ?? t('Select an option'))
                    : (selectedOptions?.label ?? props.placeholder ?? t('Select an option'))}
              </span>
              {props.suffixAction && (
                <button
                  type="button"
                  disabled={!props.suffixAction.enabled}
                  onClick={() => void runAction(props.suffixAction!)}
                >
                  {props.suffixAction.label}
                </button>
              )}
            </div>
            {Array.isArray(value) &&
              Array.isArray(selectedOptions) &&
              selectedOptions.length > 0 && (
                <ul aria-label={t('Selected options')} className="flex flex-wrap gap-1">
                  {selectedOptions.map((option) => (
                    <li
                      key={String(option.value)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs"
                    >
                      <span>{option.label}</span>
                      <button
                        type="button"
                        aria-label={`${t('Remove')} ${option.label}`}
                        disabled={props.disabled || props.readOnly}
                        onClick={() =>
                          setValue(value.filter((item) => String(item) !== String(option.value)))
                        }
                        className="rounded px-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            <div
              id={props.searchable ? undefined : id}
              aria-multiselectable={props.multiple || undefined}
              role="listbox"
              aria-labelledby={
                props.label !== null && props.label !== undefined ? `${id}-label` : undefined
              }
              aria-label={props.label ?? id}
              aria-invalid={!!error}
              aria-required={props.required}
              aria-describedby={describedBy}
              aria-disabled={props.disabled || props.readOnly}
              onKeyDown={(event) => {
                const list = event.currentTarget
                const choices = Array.from(
                  list.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)')
                )
                const index = choices.indexOf(document.activeElement as HTMLButtonElement)
                const next =
                  event.key === 'Home'
                    ? choices[0]
                    : event.key === 'End'
                      ? choices[choices.length - 1]
                      : event.key === 'ArrowDown'
                        ? choices[(index + 1) % choices.length]
                        : event.key === 'ArrowUp'
                          ? choices[(index - 1 + choices.length) % choices.length]
                          : undefined
                if (!next) return
                event.preventDefault()
                next.focus()
              }}
              className="max-h-56 overflow-auto rounded-md border border-border p-1"
            >
              {options.map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  role="option"
                  aria-selected={
                    Array.isArray(value)
                      ? value.some((item) => String(item) === String(option.value))
                      : String(value) === String(option.value)
                  }
                  tabIndex={
                    options.find((candidate) => !candidate.disabled)?.value === option.value
                      ? 0
                      : -1
                  }
                  disabled={props.disabled || props.readOnly || option.disabled}
                  onClick={() => selectOption(option)}
                  className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
                >
                  {option.label}
                  {option.description && (
                    <span className="block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {asyncOptions.loading && <span role="status">{t('Loading options')}</span>}
            {asyncOptions.error && <span role="alert">{asyncOptions.error}</span>}
            {asyncOptions.hasMore && (
              <button
                type="button"
                onClick={asyncOptions.loadMore}
                disabled={props.disabled || props.readOnly || asyncOptions.loading}
              >
                {t('Load more')}
              </button>
            )}
            {createAction && (
              <button
                type="button"
                disabled={props.disabled || props.readOnly}
                onClick={() => setCreateOpen(true)}
              >
                {t('Create option')}
              </button>
            )}
          </div>
        ) : props.native ? (
          <div className="flex items-center gap-2">
            {props.prefixAction && <ActionButton action={props.prefixAction} />}
            <select
              id={id}
              name={id}
              value={Array.isArray(value) ? value.map(String) : String(value ?? '')}
              multiple={props.multiple}
              required={props.required}
              disabled={props.disabled}
              aria-required={props.required}
              aria-describedby={describedBy}
              aria-invalid={!!error}
              onChange={(event) => {
                if (props.multiple) {
                  setValue(
                    Array.from(
                      event.currentTarget.selectedOptions,
                      (selected) =>
                        options.find((option) => String(option.value) === selected.value)?.value ??
                        selected.value
                    )
                  )
                } else {
                  const selected = options.find(
                    (option) => String(option.value) === event.currentTarget.value
                  )
                  setValue(selected?.value ?? '')
                }
              }}
              className="flex min-h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {!props.multiple && (
                <option value="">{props.placeholder ?? 'Select an option'}</option>
              )}
              {options.map((option) => (
                <option
                  key={String(option.value)}
                  value={String(option.value)}
                  disabled={option.disabled}
                >
                  {option.label}
                </option>
              ))}
            </select>
            {props.suffixAction && <ActionButton action={props.suffixAction} />}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {props.prefixAction && <ActionButton action={props.prefixAction} />}
            <BaseSelect.Root
              items={options}
              id={id}
              name={id}
              value={selectedOptions}
              onValueChange={(next) => {
                if (Array.isArray(next)) {
                  setValue(next.map((option) => option.value))
                  return
                }
                setValue(next?.value ?? '')
              }}
              multiple={props.multiple}
              required={props.required}
              disabled={props.disabled}
              readOnly={props.readOnly}
            >
              <BaseSelect.Trigger
                aria-label={props.label ?? id}
                {...props.extraAttributes}
                id={id}
                aria-required={props.required}
                aria-describedby={describedBy}
                aria-invalid={!!error}
                className="flex min-h-10 w-full flex-1 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <BaseSelect.Value placeholder={props.placeholder ?? 'Select an option'} />
                <BaseSelect.Icon aria-hidden="true">⌄</BaseSelect.Icon>
              </BaseSelect.Trigger>
              <BaseSelect.Portal>
                <BaseSelect.Positioner className="z-50 outline-none">
                  <BaseSelect.Popup className="max-h-64 min-w-[var(--anchor-width)] overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                    <BaseSelect.List>
                      {options.map((option) => (
                        <BaseSelect.Item
                          key={String(option.value)}
                          value={option}
                          disabled={option.disabled}
                          className="flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50"
                        >
                          <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                        </BaseSelect.Item>
                      ))}
                    </BaseSelect.List>
                  </BaseSelect.Popup>
                </BaseSelect.Positioner>
              </BaseSelect.Portal>
            </BaseSelect.Root>
            {props.suffixAction && <ActionButton action={props.suffixAction} />}
          </div>
        )}
        {props.clearable &&
          !props.multiple &&
          value !== '' &&
          value !== null &&
          value !== undefined && (
            <button
              type="button"
              aria-label={`Clear ${props.label ?? 'selection'}`}
              onClick={() => setValue('')}
            >
              Clear
            </button>
          )}
        {props.hint && (
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {props.hint}
          </p>
        )}
        {props.helperText && (
          <p id={`${id}-helper`} className="text-sm text-muted-foreground">
            {props.helperText}
          </p>
        )}
        {error && (
          <div id={`${id}-error`}>
            <FieldError>{error}</FieldError>
          </div>
        )}
      </Field>
      {createOpen && createAction && (
        <ActionModal
          action={createAction}
          registry={runtime.registry.shell}
          runtimeRegistry={runtime.registry}
          pupitre={runtime.panel}
          close={() => setCreateOpen(false)}
          toast={runtime.toast}
          onResult={(result) => {
            for (const flash of result.flash) runtime.toast(flash)
          }}
          onOptionCreated={(option) => {
            asyncOptions.addOption(option)
            if (Array.isArray(value)) {
              setValue(
                value.some((item) => String(item) === String(option.value))
                  ? value
                  : [...value, option.value]
              )
            } else {
              setValue(option.value)
            }
            setCreateOpen(false)
            runtime.toast({ type: 'success', title: t('Option created') })
          }}
        />
      )}
    </div>
  )
}
export default Select
