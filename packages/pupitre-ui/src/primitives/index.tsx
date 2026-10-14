import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactElement,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react'
import { useState } from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { Field as BaseField } from '@base-ui/react/field'
import { Input as BaseInput } from '@base-ui/react/input'
import { Select as BaseSelect } from '@base-ui/react/select'
import { Switch as BaseSwitch } from '@base-ui/react/switch'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { twMerge } from 'tailwind-merge'
import { t } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'

/** Joins classes; later conflicting utilities win, so `className` overrides primitive defaults. */
export function cn(...classes: Array<string | undefined | false | null>): string {
  return twMerge(classes.filter(Boolean).join(' '))
}

/* -------------------------------------------------------------------------- */
/* Colors                                                                     */
/* -------------------------------------------------------------------------- */

/** Semantic color vocabulary shared by buttons, badges, icons, and action descriptors. */
export type Tone = 'primary' | 'gray' | 'success' | 'warning' | 'danger' | 'info'

/** Maps an action/column color name (including legacy `secondary`) to a tone. */
export function toTone(color: string | undefined | null, fallback: Tone = 'gray'): Tone {
  switch (color) {
    case 'primary':
    case 'success':
    case 'warning':
    case 'danger':
    case 'info':
    case 'gray':
      return color
    case 'destructive':
      return 'danger'
    case 'secondary':
      return 'gray'
    default:
      return fallback
  }
}

/** Text color that stays readable on card/canvas surfaces. */
export const toneText: Record<Tone, string> = {
  primary: 'text-primary-ink',
  gray: 'text-muted-foreground',
  success: 'text-success-ink',
  warning: 'text-warning-ink',
  danger: 'text-danger-ink',
  info: 'text-info-ink',
}

/** Soft fill + ink text + hairline ring; used by badges and status chips. */
export const toneSoft: Record<Tone, string> = {
  primary: 'bg-primary-soft text-primary-ink ring-primary/25',
  gray: 'bg-muted text-foreground/80 ring-foreground/10',
  success: 'bg-success-soft text-success-ink ring-success/25',
  warning: 'bg-warning-soft text-warning-ink ring-warning/35',
  danger: 'bg-danger-soft text-danger-ink ring-danger/25',
  info: 'bg-info-soft text-info-ink ring-info/25',
}

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'link'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

const solid: Record<Tone, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-control hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--foreground))]',
  gray: 'border border-input bg-card text-foreground shadow-control hover:bg-muted',
  success:
    'bg-success text-success-foreground shadow-control hover:bg-[color-mix(in_oklab,var(--success)_88%,var(--foreground))]',
  warning:
    'bg-warning text-warning-foreground shadow-control hover:bg-[color-mix(in_oklab,var(--warning)_90%,var(--foreground))]',
  danger:
    'bg-destructive text-destructive-foreground shadow-control hover:bg-[color-mix(in_oklab,var(--destructive)_88%,var(--foreground))]',
  info: 'bg-info text-info-foreground shadow-control hover:bg-[color-mix(in_oklab,var(--info)_88%,var(--foreground))]',
}
const outline: Record<Tone, string> = {
  primary: 'border border-primary/40 text-primary-ink hover:bg-primary-soft',
  gray: 'border border-input text-foreground hover:bg-muted',
  success: 'border border-success/40 text-success-ink hover:bg-success-soft',
  warning: 'border border-warning/50 text-warning-ink hover:bg-warning-soft',
  danger: 'border border-destructive/40 text-danger-ink hover:bg-danger-soft',
  info: 'border border-info/40 text-info-ink hover:bg-info-soft',
}
const ghost: Record<Tone, string> = {
  primary: 'text-primary-ink hover:bg-primary-soft',
  gray: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  success: 'text-success-ink hover:bg-success-soft',
  warning: 'text-warning-ink hover:bg-warning-soft',
  danger: 'text-danger-ink hover:bg-danger-soft',
  info: 'text-info-ink hover:bg-info-soft',
}

const sizes: Record<ButtonSize, string> = {
  xs: 'h-7 gap-1 rounded-md px-2 text-xs [&_svg]:size-3.5',
  sm: 'h-(--control-h-sm) gap-1.5 rounded-md px-2.5 text-[0.8125rem] [&_svg]:size-4',
  md: 'h-(--control-h) gap-2 rounded-lg px-3.5 text-sm [&_svg]:size-4',
  lg: 'h-10 gap-2 rounded-lg px-4 text-sm [&_svg]:size-4.5',
}
const squareSizes: Record<ButtonSize, string> = {
  xs: 'size-7 rounded-md [&_svg]:size-3.5',
  sm: 'size-(--control-h-sm) rounded-md [&_svg]:size-4',
  md: 'size-(--control-h) rounded-lg [&_svg]:size-4',
  lg: 'size-10 rounded-lg [&_svg]:size-4.5',
}

export type ButtonStyleOptions = {
  variant?: ButtonVariant
  color?: Tone
  size?: ButtonSize
  /** Icon-only square button; always pair with `aria-label`. */
  square?: boolean
  className?: string
}

/** Class string for anything that should look like a button (links, triggers, menu triggers). */
export function buttonClasses({
  variant = 'solid',
  color = 'gray',
  size = 'md',
  square = false,
  className,
}: ButtonStyleOptions = {}): string {
  if (variant === 'link')
    return cn(
      'inline-flex items-center gap-1.5 rounded-sm text-sm font-medium underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
      toneText[color] === 'text-muted-foreground'
        ? 'text-muted-foreground hover:text-foreground'
        : toneText[color],
      className
    )
  return cn(
    'relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium outline-none transition-[background-color,border-color,color,box-shadow,scale] duration-150 ease-ui active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:shrink-0',
    square ? squareSizes[size] : sizes[size],
    variant === 'solid' ? solid[color] : variant === 'outline' ? outline[color] : ghost[color],
    className
  )
}

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> &
  Omit<ButtonStyleOptions, 'className'> & {
    loading?: boolean
    render?: ReactElement
  }

export function Button({
  className,
  variant = 'solid',
  color = 'gray',
  size,
  square,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      data-pupitre-button=""
      data-variant={variant}
      data-color={color}
      className={buttonClasses({ variant, color, size, square, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </BaseButton>
  )
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                              */
/* -------------------------------------------------------------------------- */

/** Shared look for bordered text-like controls (input, textarea, select trigger). */
export const controlClasses =
  'w-full min-w-0 rounded-lg border border-input bg-card text-sm text-foreground shadow-control outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-subtle-foreground hover:border-[color-mix(in_oklab,var(--input)_70%,var(--foreground))] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none [&:is(input,textarea):read-only]:bg-muted/40 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20'

/** Wrapper look for grouped controls; the inner element uses `bareControlClasses`. */
export const controlGroupClasses =
  'flex w-full min-w-0 items-stretch overflow-hidden rounded-lg border border-input bg-card text-sm shadow-control transition-[border-color,box-shadow] duration-150 hover:border-[color-mix(in_oklab,var(--input)_70%,var(--foreground))] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20 has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:focus-within:ring-destructive/20 has-[:is(input,textarea):disabled]:bg-muted has-[:is(input,textarea):disabled]:shadow-none'

export const bareControlClasses =
  'h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:text-muted-foreground'

export function Input({
  className,
  bare = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { bare?: boolean }) {
  return (
    <BaseInput
      data-pupitre-control=""
      className={cn(
        bare ? bareControlClasses : cn(controlClasses, 'h-(--control-h) px-3'),
        className
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      data-pupitre-control=""
      className={cn(controlClasses, 'min-h-20 px-3 py-2 leading-6', className)}
      {...props}
    />
  )
}

/** Bordered row hosting an input plus prefix/suffix addons and inline actions. */
export function InputGroup({
  className,
  children,
  style,
}: {
  className?: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      data-pupitre-control=""
      className={cn(controlGroupClasses, 'h-(--control-h)', className)}
      style={style}
    >
      {children}
    </div>
  )
}

/** Static prefix/suffix segment inside an InputGroup (currency, units, URL scheme). */
export function InputAddon({
  children,
  position = 'start',
  className,
}: {
  children: ReactNode
  position?: 'start' | 'end'
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1.5 bg-muted/60 px-3 text-sm text-muted-foreground [&_svg]:size-4',
        position === 'start' ? 'border-r border-input' : 'border-l border-input',
        className
      )}
    >
      {children}
    </span>
  )
}

/** Inline slot for icon buttons inside an InputGroup (reveal password, clear, actions). */
export function InputSlot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-center gap-0.5 px-1', className)}>{children}</span>
  )
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <BaseField.Label
      className={cn('text-sm font-medium leading-5 text-foreground', className)}
      {...props}
    />
  )
}

/** Required marker appended to labels. */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-danger-ink">
      *
    </span>
  )
}

export function Field({
  className,
  children,
  ...props
}: {
  className?: string
  children: ReactNode
  invalid?: boolean
}) {
  return (
    <BaseField.Root
      data-pupitre-field=""
      className={cn('grid gap-1.5', className)}
      invalid={props.invalid}
    >
      {children}
    </BaseField.Root>
  )
}

/** Helper copy under a control. */
export function FieldDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-[0.8125rem] leading-5 text-muted-foreground', className)} {...props} />
  )
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <BaseField.Error
      match={true}
      className="flex items-start gap-1.5 text-[0.8125rem] leading-5 text-danger-ink"
    >
      <Icon name="circle-alert" className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </BaseField.Error>
  )
}

/** Compact checkbox visual independent of its hit area. Label via <label> or aria-label. */
export function CheckboxControl({
  className,
  indeterminate,
  ...props
}: Parameters<typeof BaseCheckbox.Root>[0]) {
  return (
    <BaseCheckbox.Root
      indeterminate={indeterminate}
      className={cn(
        'peer group inline-flex size-4 shrink-0 items-center justify-center rounded-[0.3rem] text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 data-disabled:cursor-not-allowed data-disabled:opacity-50',
        typeof className === 'string' ? className : undefined
      )}
      {...props}
    >
      <span className="pointer-events-none flex size-4 shrink-0 items-center justify-center rounded-[0.3rem] border border-input-strong bg-card shadow-control transition-colors duration-150 group-data-checked:border-primary group-data-checked:bg-primary group-data-indeterminate:border-primary group-data-indeterminate:bg-primary group-aria-invalid:border-destructive">
        <BaseCheckbox.Indicator className="flex data-unchecked:hidden">
          <Icon name={indeterminate ? 'minus' : 'check'} className="size-3" strokeWidth={3} />
        </BaseCheckbox.Indicator>
      </span>
    </BaseCheckbox.Root>
  )
}

/** Switch control (Base UI). `onColor` overrides the checked track color. */
export function SwitchControl({ className, ...props }: Parameters<typeof BaseSwitch.Root>[0]) {
  return (
    <BaseSwitch.Root
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-input-strong px-px outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/30 data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50',
        typeof className === 'string' ? className : undefined
      )}
      {...props}
    >
      <BaseSwitch.Thumb className="block size-4 rounded-full bg-switch-thumb shadow-control transition-transform duration-150 ease-ui data-checked:translate-x-4" />
    </BaseSwitch.Root>
  )
}

/* -------------------------------------------------------------------------- */
/* Display                                                                    */
/* -------------------------------------------------------------------------- */

export function Badge({
  children,
  className,
  color = 'gray',
  size = 'md',
  icon,
  style,
}: {
  children: ReactNode
  className?: string
  color?: Tone
  size?: 'sm' | 'md'
  icon?: string
  style?: CSSProperties
}) {
  return (
    <span
      data-pupitre-badge=""
      data-color={color}
      className={cn(
        'inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-md font-medium ring-1 ring-inset [&_svg]:shrink-0',
        size === 'sm' ? 'px-1.5 py-px text-[0.6875rem] leading-4' : 'px-2 py-0.5 text-xs leading-4',
        toneSoft[color],
        className
      )}
      style={style}
    >
      {icon && <Icon name={icon} className="size-3" />}
      {children}
    </span>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <Icon
      name="loader-circle"
      className={cn('animate-spin text-current motion-reduce:animate-none', className)}
    />
  )
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block animate-pulse rounded-md bg-muted motion-reduce:animate-none',
        className
      )}
      style={style}
    />
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted/70 px-1 font-sans text-[0.6875rem] font-medium text-muted-foreground',
        className
      )}
    >
      {children}
    </kbd>
  )
}

/** Initials avatar with optional image. */
export function Avatar({
  name,
  src,
  className,
}: {
  name: string
  src?: string | null
  className?: string
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
  return src ? (
    <img src={src} alt="" className={cn('size-8 shrink-0 rounded-full object-cover', className)} />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink ring-1 ring-inset ring-primary/20',
        className
      )}
    >
      {initials || '?'}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

/** Raised content container: sections, tables, widgets. Never nest panels. */
export const panelClasses =
  'rounded-xl border border-border bg-card text-card-foreground shadow-panel'

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-pupitre-panel="" className={cn(panelClasses, className)} {...props} />
}

/** The ink rule that opens a ledger section or table. */
export const ledgerRuleClasses = 'border-t border-rule'

/**
 * Unboxed page region: an ink rule, a heading row, then content directly on the canvas.
 * Widgets, view-page sections and tables use it instead of cards, so a page reads as
 * one ruled sheet rather than a grid of boxes.
 */
export function LedgerSection({
  heading,
  description,
  aside,
  headingLevel = 2,
  className,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  heading?: ReactNode
  description?: ReactNode
  aside?: ReactNode
  headingLevel?: 2 | 3
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <section
      data-pupitre-section=""
      className={cn('min-w-0', ledgerRuleClasses, className)}
      {...props}
    >
      {(heading || description || aside) && (
        <div
          data-pupitre-section-header=""
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-3 pb-4"
        >
          <div className="min-w-0">
            {heading && (
              <Heading
                data-pupitre-section-heading=""
                className="text-[0.9375rem] font-semibold leading-6 text-foreground"
              >
                {heading}
              </Heading>
            )}
            {description && (
              <p className="text-[0.8125rem] leading-5 text-muted-foreground">{description}</p>
            )}
          </div>
          {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function PanelHeader({
  heading,
  description,
  icon,
  aside,
  className,
  headingLevel = 2,
}: {
  heading?: ReactNode
  description?: ReactNode
  icon?: string
  aside?: ReactNode
  className?: string
  headingLevel?: 2 | 3
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <div className={cn('flex items-start gap-3 px-5 py-4 sm:px-6', className)}>
      {icon && (
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon name={icon} className="size-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {heading && (
          <Heading className="text-[0.9375rem] font-semibold leading-6 text-foreground">
            {heading}
          </Heading>
        )}
        {description && (
          <p className="mt-0.5 text-[0.8125rem] leading-5 text-muted-foreground">{description}</p>
        )}
      </div>
      {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
    </div>
  )
}

export function EmptyState({
  icon = 'inbox',
  heading,
  description,
  actions,
  compact = false,
  className,
}: {
  icon?: string
  heading: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Lighter variant for tables nested in another panel (relation managers, widgets). */
  compact?: boolean
  className?: string
}) {
  return (
    <div
      data-pupitre-empty=""
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-7' : 'px-6 py-12',
        className
      )}
    >
      <span
        className={cn(
          'grid place-items-center rounded-full bg-muted text-muted-foreground',
          compact ? 'size-8' : 'size-11 ring-8 ring-muted/40'
        )}
      >
        <Icon name={icon} className={compact ? 'size-4' : 'size-5'} />
      </span>
      <p className={cn('text-sm font-semibold text-foreground', compact ? 'mt-3' : 'mt-4')}>
        {heading}
      </p>
      {description && (
        <p className="mt-1 max-w-sm text-[0.8125rem] leading-5 text-muted-foreground">
          {description}
        </p>
      )}
      {actions && (
        <div className={cn('flex flex-wrap justify-center gap-2', compact ? 'mt-4' : 'mt-5')}>
          {actions}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Popups (Base UI Menu / Popover / Select / Combobox / Dialog)               */
/* -------------------------------------------------------------------------- */

/** Positioner z-index above dialogs so menus opened inside modals stay visible. */
export const positionerClasses = 'z-[120] outline-none'

/** Floating surface for menus, popovers, listboxes. Animates via Base UI starting/ending styles. */
export const popupClasses =
  'min-w-48 origin-(--transform-origin) rounded-xl border border-border bg-popover p-1 text-sm text-popover-foreground shadow-popover outline-none transition-[opacity,scale] duration-150 ease-ui data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0'

/** Menu / listbox row. Works with Base UI `data-highlighted`, `data-selected`, `data-disabled`. */
export const menuItemClasses =
  'flex w-full cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-foreground outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'

export const menuDangerItemClasses =
  'text-danger-ink data-highlighted:bg-danger-soft [&_svg]:text-danger-ink'

export const menuLabelClasses = 'px-2.5 pb-1 pt-2 text-xs font-medium text-muted-foreground'

export const menuSeparatorClasses = '-mx-1 my-1 h-px bg-border'

export const backdropClasses =
  'fixed inset-0 z-[100] bg-(--scrim) transition-opacity duration-200 ease-ui data-ending-style:opacity-0 data-starting-style:opacity-0'

export const dialogWidths = {
  'sm': 'max-w-sm',
  'md': 'max-w-md',
  'lg': 'max-w-lg',
  'xl': 'max-w-xl',
  '2xl': 'max-w-2xl',
  'full': 'max-w-[calc(100vw-2rem)]',
} as const

/** Centered dialog surface. Pair with `backdropClasses`. */
export function dialogPopupClasses(width: keyof typeof dialogWidths = 'lg'): string {
  return cn(
    'fixed left-1/2 top-1/2 z-[101] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-dialog outline-none transition-[opacity,scale] duration-200 ease-ui data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0',
    dialogWidths[width]
  )
}

/** Right-hand slide-over surface. */
export function sheetPopupClasses(width: keyof typeof dialogWidths = 'md'): string {
  return cn(
    'fixed inset-y-0 right-0 z-[101] flex w-full flex-col border-l border-border bg-card text-card-foreground shadow-dialog outline-none transition-transform duration-250 ease-drawer data-ending-style:translate-x-full data-starting-style:translate-x-full',
    dialogWidths[width]
  )
}

/* -------------------------------------------------------------------------- */
/* Select menu                                                                */
/* -------------------------------------------------------------------------- */

export type SelectMenuOption = {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export type SelectMenuProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'defaultValue' | 'onChange' | 'className' | 'children' | 'name' | 'color'
> & {
  value: string
  onValueChange: (value: string) => void
  options: readonly SelectMenuOption[]
  /** Shown when `value` matches no option. */
  placeholder?: string
  /** `sm` follows `--control-h-sm` for toolbars, footers, and table cells. */
  size?: 'sm' | 'md'
  /** Submits the value through Base UI's hidden input. */
  name?: string
  required?: boolean
  readOnly?: boolean
  className?: string
}

const selectTriggerSizes = {
  sm: 'h-(--control-h-sm) px-2.5 text-[0.8125rem]',
  md: 'h-(--control-h) px-3',
}

/** Single-value Base UI select: the trigger and listbox every Pupitre select draws. */
export function SelectMenu({
  value,
  onValueChange,
  options,
  placeholder,
  size = 'md',
  name,
  required,
  disabled,
  readOnly,
  className,
  ...trigger
}: SelectMenuProps) {
  return (
    <BaseSelect.Root
      items={options}
      name={name}
      value={options.some((option) => option.value === value) ? value : null}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      onValueChange={(next) => onValueChange(next ?? '')}
    >
      <BaseSelect.Trigger
        data-pupitre-control=""
        role="combobox"
        {...trigger}
        disabled={disabled || readOnly}
        className={cn(
          controlClasses,
          'flex items-center justify-between gap-2 text-left',
          selectTriggerSizes[size],
          className
        )}
      >
        {/* Like a native select, size to the widest option: invisible labels share the value's
            grid cell. Pseudo-element text keeps them out of textContent and the a11y tree. */}
        <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)]">
          <BaseSelect.Value
            placeholder={placeholder}
            className="col-start-1 row-start-1 min-w-0 truncate"
          />
          {[...(placeholder ? [placeholder] : []), ...options.map((option) => option.label)].map(
            (label, index) => (
              <span
                key={index}
                aria-hidden="true"
                data-label={label}
                className="invisible col-start-1 row-start-1 h-0 truncate before:content-[attr(data-label)]"
              />
            )
          )}
        </span>
        <Icon name="chevrons-up-down" className="size-4 shrink-0 text-muted-foreground" />
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          sideOffset={5}
          alignItemWithTrigger={false}
          className={positionerClasses}
        >
          <BaseSelect.Popup
            data-pupitre-popup=""
            className={cn(popupClasses, 'min-w-(--anchor-width)')}
          >
            <BaseSelect.List className="max-h-64 overflow-auto">
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  aria-label={option.label}
                  className={menuItemClasses}
                >
                  <span className="min-w-0 flex-1">
                    <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                    {option.description && (
                      <span className="block text-[0.8125rem] text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                  <BaseSelect.ItemIndicator>
                    <Icon name="check" className="size-4" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
              {!options.length && (
                <p className="px-3 py-3 text-[0.8125rem] text-muted-foreground">
                  {t('No options')}
                </p>
              )}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

/** Underline tabs: record sub-navigation, form tabs. */
export const underlineTabListClasses =
  'flex items-center gap-1 overflow-x-auto border-b border-border'
export const underlineTabClasses =
  'relative -mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 aria-[current=page]:border-primary aria-[current=page]:text-foreground aria-selected:border-primary aria-selected:text-foreground data-active:border-primary data-active:text-foreground [&_svg]:size-4'

/** Segmented pill tabs: list tabs, view switches, toggle buttons. */
export const segmentedListClasses =
  'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-border bg-muted/60 p-1'
export const segmentedItemClasses =
  'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[0.8125rem] font-medium text-muted-foreground outline-none transition-[background-color,color,box-shadow] duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-control aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-control aria-selected:bg-card aria-selected:text-foreground aria-selected:shadow-control data-active:bg-card data-active:text-foreground data-active:shadow-control data-pressed:bg-card data-pressed:text-foreground data-pressed:shadow-control [&_svg]:size-4'

/* -------------------------------------------------------------------------- */
/* Tooltip                                                                    */
/* -------------------------------------------------------------------------- */

/** Hover/focus label for icon-only controls. `children` must be a single focusable element. */
export function Tooltip({
  label,
  children,
  side = 'top',
}: {
  label: ReactNode
  children: ReactElement
  side?: 'top' | 'bottom' | 'left' | 'right'
}) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger delay={400} render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={6} className={positionerClasses}>
          <BaseTooltip.Popup
            data-pupitre-popup=""
            className="max-w-xs origin-(--transform-origin) rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-popover transition-[opacity,scale] duration-100 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
          >
            {label}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}

/* -------------------------------------------------------------------------- */
/* Collapse                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Height + fade disclosure for section bodies, collection items, and nav groups.
 * Content mounts on open and unmounts after the closing transition; the initial
 * render never animates. Pair the trigger's `aria-expanded` with `open`.
 */
export function Collapse({
  open,
  className,
  children,
}: {
  open: boolean
  className?: string
  children: ReactNode
}) {
  // Clip only while the height moves, so focus rings at the edges stay visible at rest.
  const [clipping, setClipping] = useState(false)
  const [previousOpen, setPreviousOpen] = useState(open)
  if (previousOpen !== open) {
    setPreviousOpen(open)
    setClipping(true)
  }
  return (
    <BaseCollapsible.Root open={open}>
      <BaseCollapsible.Panel
        className={cn(
          'h-(--collapsible-panel-height) transition-[height,opacity] duration-200 ease-ui data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0',
          clipping && 'overflow-hidden',
          className
        )}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && event.propertyName === 'height')
            setClipping(false)
        }}
      >
        {children}
      </BaseCollapsible.Panel>
    </BaseCollapsible.Root>
  )
}
