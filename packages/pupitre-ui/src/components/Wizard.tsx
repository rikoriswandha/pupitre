import { createContext, useContext, type ReactNode, useEffect, useId, useMemo, useRef } from 'react'
import { t, useBoundValue, useEmbedded, useStateValue } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import { Button, cn } from '../primitives/index.js'
import { PanelNestingContext } from './Section.js'
import { FormWizardContext } from './Form.js'

type WizardContextValue = {
  active: number
  stepCount: number
  keys: string[]
  select: (step: number) => void
}
export const WizardContext = createContext<WizardContextValue | null>(null)
type WizardStep = {
  key: string
  label: string
  description?: string
  icon?: string
  fields?: string[]
}
type RuntimeProps = {
  props: Record<string, unknown>
  children?: ReactNode
  bindings?: Record<string, string | undefined>
}

export function Wizard({ props, children, bindings }: RuntimeProps) {
  const steps = useMemo(
    () =>
      Array.isArray(props.steps)
        ? props.steps.filter((step): step is WizardStep =>
            Boolean(step && typeof step === 'object' && 'key' in step && 'label' in step)
          )
        : [],
    [props.steps]
  )
  const fallback = typeof props.step === 'number' ? props.step : 0
  const [current, setCurrent] = useBoundValue(fallback, bindings?.step)
  const skippable = props.skippable === true
  const select = (step: number) => setCurrent(Math.max(0, Math.min(steps.length - 1, step)))
  const active = Math.max(
    0,
    Math.min(steps.length - 1, typeof current === 'number' ? current : fallback)
  )
  const embedded = useEmbedded()
  const nested = useContext(PanelNestingContext)
  const form = useContext(FormWizardContext)
  const activeButton = useRef<HTMLButtonElement>(null)
  const stepsId = useId()
  const previousActive = useRef(active)
  const errors = useStateValue('/errors')
  const previousErrors = useRef<unknown>(undefined)
  useEffect(() => {
    if (previousErrors.current === errors) return
    previousErrors.current = errors
    if (embedded || !errors || typeof errors !== 'object') return
    const containsError = (value: unknown): boolean =>
      typeof value === 'string'
        ? value.length > 0
        : Boolean(value && typeof value === 'object' && Object.values(value).some(containsError))
    const invalid = steps.findIndex((step) =>
      step.fields?.some((field) => {
        const value = field
          .split('.')
          .reduce<unknown>(
            (node, part) =>
              node && typeof node === 'object'
                ? (node as Record<string, unknown>)[part]
                : undefined,
            errors
          )
        return containsError(value)
      })
    )
    if (invalid >= 0 && invalid !== active) setCurrent(invalid)
  }, [errors, embedded, steps, active, setCurrent])
  useEffect(() => {
    if (previousActive.current !== active) activeButton.current?.focus()
    previousActive.current = active
  }, [active])
  return (
    <WizardContext.Provider
      value={{
        active,
        stepCount: steps.length,
        keys: steps.map((step) => step.key),
        select,
      }}
    >
      <div
        className={cn('min-w-0', !nested && !embedded && 'border-t border-rule')}
        data-wizard={typeof props.id === 'string' ? props.id : undefined}
      >
        <ol
          aria-label={t('Form steps')}
          className="flex gap-6 overflow-x-auto border-b border-border pt-3"
        >
          {steps.map((step, index) => (
            <li key={step.key} className="flex min-w-max flex-1 items-stretch">
              <button
                ref={active === index ? activeButton : undefined}
                type="button"
                className={cn(
                  'flex min-w-0 flex-1 items-start gap-3 border-b-2 border-transparent pt-1 pb-4 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed',
                  active === index && 'border-primary'
                )}
                aria-current={active === index ? 'step' : undefined}
                // Name is "<n> <label>"; the description is announced, not part of the name.
                aria-label={t('Step {number}: {label}', { number: index + 1, label: step.label })}
                aria-describedby={step.description ? `${stepsId}-${index}` : undefined}
                disabled={!skippable && index > active}
                onClick={() => {
                  if (skippable || index <= active) select(index)
                }}
              >
                <span
                  className={cn(
                    'grid size-6 shrink-0 place-items-center text-sm font-semibold tabular-nums',
                    index <= active ? 'text-primary-ink' : 'text-muted-foreground'
                  )}
                >
                  {index < active ? (
                    <>
                      <Icon name="check" className="size-4" />
                      <span className="sr-only">{index + 1}</span>
                    </>
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'flex items-center gap-1.5 text-[0.9375rem] font-semibold',
                      index === active ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {step.icon && <Icon name={step.icon} className="size-4" />}
                    {step.label}
                  </span>
                  {step.description && (
                    <span
                      id={`${stepsId}-${index}`}
                      aria-live={index === active ? 'polite' : undefined}
                      className="mt-0.5 block text-xs text-muted-foreground"
                    >
                      {step.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <PanelNestingContext.Provider value={true}>
          <div className="py-5">{children}</div>
        </PanelNestingContext.Provider>
        {!embedded && (
          <div className="flex justify-between gap-3 border-t border-border pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => select(active - 1)}
              disabled={active === 0}
            >
              {t('Back')}
            </Button>
            {/* Distinct keys: reusing one <button> would flip its type to submit mid-click
                on the last step and submit the form instead of advancing. */}
            {form && active >= steps.length - 1 ? (
              <Button key="submit" type="submit" color="primary" loading={form.submitting}>
                {form.label}
              </Button>
            ) : (
              <Button
                key="next"
                type="button"
                color="primary"
                onClick={() => select(active + 1)}
                disabled={active >= steps.length - 1}
              >
                {t('Next')}
              </Button>
            )}
          </div>
        )}
      </div>
    </WizardContext.Provider>
  )
}
export default Wizard
