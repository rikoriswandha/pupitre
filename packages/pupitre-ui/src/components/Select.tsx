import { useId, useMemo, useState, type ReactNode } from 'react'
import { useBoundValue, useFieldError, useOptions, useRuntime } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Popover } from '@base-ui/react/popover'
import { Icon } from '../icons.js'
import { InputFieldLabel } from './Text.js'
import {
  Badge,
  Button,
  Field,
  FieldError,
  FieldDescription,
  InputSlot,
  cn,
  controlGroupClasses,
  controlClasses,
  popupClasses,
  positionerClasses,
  menuItemClasses,
  SelectMenu,
  Spinner,
} from '../primitives/index.js'
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
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [createdOptions, setCreatedOptions] = useState<
    Array<{ value: string | number; label: string; description?: string; disabled?: boolean }>
  >([])
  const runtime = useRuntime()
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
  const options = [
    ...(props.optionsUrl ? asyncOptions.options : staticOptions),
    ...createdOptions,
  ].filter(
    (option, index, all) =>
      all.findIndex((item) => String(item.value) === String(option.value)) === index
  )
  const query = props.optionsUrl ? asyncOptions.search : search
  const visibleOptions = props.optionsUrl
    ? options
    : options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))
  const selected = (option: (typeof options)[number]) =>
    Array.isArray(value)
      ? value.some((item) => String(item) === String(option.value))
      : String(value) === String(option.value)
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
      setOpen(false)
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
  const placeholder = props.placeholder ?? t('Select an option')
  const triggerValue = Array.isArray(selectedOptions)
    ? selectedOptions.length
      ? selectedOptions.map((option) => option.label).join(', ')
      : placeholder
    : (selectedOptions?.label ?? placeholder)
  const complex = props.searchable || props.optionsUrl || props.multiple || createAction
  const triggerProps = {
    id,
    'aria-label': props.label ?? id,
    'aria-required': props.required,
    'aria-describedby': describedBy,
    'aria-invalid': !!error,
    'disabled': props.disabled || props.readOnly,
    'className': `${controlClasses} flex h-(--control-h) items-center justify-between gap-2 px-3 text-left`,
  }
  return (
    <div style={columnStyle}>
      <Field invalid={!!error}>
        <InputFieldLabel id={id} props={props} />
        <div className="flex min-w-0 items-center gap-1">
          {props.prefixAction && (
            <InputSlot>
              <ActionButton
                action={{
                  ...props.prefixAction,
                  variant: props.prefixAction.icon ? 'iconButton' : props.prefixAction.variant,
                }}
                variant="ghost"
                size="xs"
              />
            </InputSlot>
          )}
          {props.native ? (
            <select
              {...props.extraAttributes}
              id={id}
              name={id}
              value={Array.isArray(value) ? value.map(String) : String(value ?? '')}
              multiple={props.multiple}
              required={props.required}
              disabled={props.disabled || props.readOnly}
              aria-label={props.label ?? id}
              aria-required={props.required}
              aria-describedby={describedBy}
              aria-invalid={!!error}
              className={`${controlClasses} pupitre-native-select min-h-(--control-h)`}
              onChange={(event) => {
                if (props.multiple)
                  setValue(
                    Array.from(
                      event.currentTarget.selectedOptions,
                      (item) =>
                        options.find((option) => String(option.value) === item.value)?.value ??
                        item.value
                    )
                  )
                else
                  setValue(
                    options.find((option) => String(option.value) === event.currentTarget.value)
                      ?.value ?? ''
                  )
              }}
            >
              {!props.multiple && <option value="">{placeholder}</option>}
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
          ) : complex ? (
            <Popover.Root open={open} onOpenChange={setOpen}>
              <div
                className={
                  props.multiple
                    ? cn(
                        controlGroupClasses,
                        'min-h-(--control-h) flex-wrap items-center gap-1 px-1 py-0.5'
                      )
                    : 'contents'
                }
              >
                {props.multiple && Array.isArray(selectedOptions) && selectedOptions.length > 0 && (
                  <ul aria-label={t('Selected options')} className="flex flex-wrap gap-1">
                    {selectedOptions.map((option) => (
                      <li key={String(option.value)}>
                        <Badge className="py-0 pr-0.5">
                          {option.label}
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            square
                            className="size-6 rounded-sm"
                            aria-label={t('Remove {label}', { label: option.label })}
                            disabled={props.disabled || props.readOnly}
                            onClick={() =>
                              Array.isArray(value) &&
                              setValue(
                                value.filter((item) => String(item) !== String(option.value))
                              )
                            }
                          >
                            <Icon name="x" className="size-3.5" />
                          </Button>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <Popover.Trigger
                  role="combobox"
                  {...props.extraAttributes}
                  {...triggerProps}
                  className={
                    props.multiple
                      ? 'flex min-h-6 min-w-8 flex-1 items-center justify-between gap-2 rounded-md px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground'
                      : triggerProps.className
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault()
                      setOpen(true)
                    }
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {props.multiple && Array.isArray(selectedOptions) && selectedOptions.length
                      ? ''
                      : triggerValue}
                  </span>
                  <Icon name="chevrons-up-down" className="size-4 shrink-0 text-muted-foreground" />
                </Popover.Trigger>
              </div>
              <Popover.Portal>
                <Popover.Positioner sideOffset={5} align="start" className={positionerClasses}>
                  <Popover.Popup
                    data-pupitre-popup=""
                    aria-label={props.label ?? id}
                    className={cn(popupClasses, 'w-(--anchor-width) min-w-56')}
                  >
                    {(props.searchable || props.optionsUrl) && (
                      <div className="p-1">
                        <input
                          className={`${controlClasses} h-(--control-h) px-3`}
                          aria-label={t('Search options')}
                          data-options-search
                          placeholder={t('Search options')}
                          value={query}
                          onChange={(event) => {
                            const next = event.currentTarget.value
                            if (props.optionsUrl) asyncOptions.setSearch(next)
                            else setSearch(next)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'ArrowDown') {
                              event.preventDefault()
                              event.currentTarget
                                .closest('[data-pupitre-popup]')
                                ?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)')
                                ?.focus()
                            }
                          }}
                        />
                      </div>
                    )}
                    <div
                      role="listbox"
                      aria-label={props.label ?? id}
                      aria-multiselectable={props.multiple || undefined}
                      className="max-h-64 overflow-auto"
                      onKeyDown={(event) => {
                        const choices = Array.from(
                          event.currentTarget.querySelectorAll<HTMLButtonElement>(
                            '[role="option"]:not(:disabled)'
                          )
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
                        if (next) {
                          event.preventDefault()
                          next.focus()
                        }
                      }}
                    >
                      {visibleOptions.map((option) => (
                        <button
                          key={String(option.value)}
                          type="button"
                          role="option"
                          aria-label={option.label}
                          aria-selected={selected(option)}
                          disabled={option.disabled}
                          onClick={() => selectOption(option)}
                          className={`${menuItemClasses} hover:bg-accent focus-visible:bg-accent aria-selected:bg-primary-soft/50 disabled:opacity-50`}
                        >
                          <span className="min-w-0 flex-1">
                            <span>{option.label}</span>
                            {option.description && (
                              <span className="block text-[0.8125rem] text-muted-foreground">
                                {option.description}
                              </span>
                            )}
                          </span>
                          {selected(option) && (
                            <Icon name="check" className="size-4 text-primary-ink" />
                          )}
                        </button>
                      ))}
                      {!visibleOptions.length && !asyncOptions.loading && (
                        <p className="px-3 py-3 text-[0.8125rem] text-muted-foreground">
                          {t('No options')}
                        </p>
                      )}
                    </div>
                    {asyncOptions.loading && (
                      <div
                        role="status"
                        className="flex items-center gap-2 px-3 py-2 text-[0.8125rem] text-muted-foreground"
                      >
                        <Spinner />
                        {t('Loading options')}
                      </div>
                    )}
                    {asyncOptions.error && (
                      <p role="alert" className="px-3 py-2 text-[0.8125rem] text-danger-ink">
                        {asyncOptions.error}
                      </p>
                    )}
                    {asyncOptions.hasMore && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={asyncOptions.loadMore}
                        disabled={asyncOptions.loading}
                        className="w-full"
                      >
                        {t('Load more')}
                      </Button>
                    )}
                    {createAction && (
                      <div className="mt-1 border-t border-border pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            setOpen(false)
                            setCreateOpen(true)
                          }}
                        >
                          <Icon name="plus" className="size-4" />
                          {t('Create option')}
                        </Button>
                      </div>
                    )}
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          ) : (
            <SelectMenu
              {...props.extraAttributes}
              id={id}
              name={id}
              aria-label={triggerProps['aria-label']}
              aria-required={props.required}
              aria-describedby={describedBy}
              aria-invalid={!!error}
              options={options.map((option) => ({ ...option, value: String(option.value) }))}
              value={Array.isArray(value) ? '' : String(value ?? '')}
              placeholder={placeholder}
              required={props.required}
              disabled={props.disabled}
              readOnly={props.readOnly}
              onValueChange={(next) =>
                setValue(options.find((option) => String(option.value) === next)?.value ?? '')
              }
            />
          )}
          {props.clearable &&
            !props.multiple &&
            value !== '' &&
            value !== null &&
            value !== undefined && (
              <InputSlot>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  square
                  aria-label={t('Clear {label}', { label: props.label ?? t('selection') })}
                  disabled={props.disabled || props.readOnly}
                  onClick={() => setValue('')}
                >
                  <Icon name="x" className="size-4" />
                </Button>
              </InputSlot>
            )}
          {props.suffixAction && (
            <InputSlot>
              <ActionButton
                action={{
                  ...props.suffixAction,
                  variant: props.suffixAction.icon ? 'iconButton' : props.suffixAction.variant,
                }}
                variant="ghost"
                size="xs"
              />
            </InputSlot>
          )}
        </div>
        {props.helperText && (
          <FieldDescription id={`${id}-helper`}>{props.helperText}</FieldDescription>
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
            setCreatedOptions((previous) => [...previous, option])
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
