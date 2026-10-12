import { createContext, useContext, type ReactNode, useEffect, useId, useMemo, useRef } from 'react'
import { useBoundValue, useEmbedded, useStateValue } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import { Button, Panel, cn } from '../primitives/index.js'
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
  const Container = nested || embedded ? 'div' : Panel
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
      <Container
        className="min-w-0"
        data-wizard={typeof props.id === 'string' ? props.id : undefined}
      >
        <ol aria-label="Form steps" className="flex overflow-x-auto px-5 py-5 sm:px-6">
          {steps.map((step, index) => (
            <li key={step.key} className="flex min-w-0 flex-1 items-center">
              <button
                ref={active === index ? activeButton : undefined}
                type="button"
                className="flex min-w-0 items-center gap-3 rounded-lg p-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed"
                aria-current={active === index ? 'step' : undefined}
                // Name is "<n> <label>"; the description is announced, not part of the name.
                aria-label={`${index + 1} ${step.label}`}
                aria-describedby={step.description ? `${stepsId}-${index}` : undefined}
                disabled={!skippable && index > active}
                onClick={() => {
                  if (skippable || index <= active) select(index)
                }}
              >
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold',
                    index < active
                      ? 'bg-primary text-primary-foreground'
                      : index === active
                        ? 'bg-primary-soft text-primary-ink ring-2 ring-primary'
                        : 'bg-muted text-muted-foreground'
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
                      'flex items-center gap-1.5 text-sm font-semibold',
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
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'mx-4 h-px min-w-6 flex-1',
                    index < active ? 'bg-primary/40' : 'bg-border'
                  )}
                />
              )}
            </li>
          ))}
        </ol>
        <PanelNestingContext.Provider value={true}>
          <div className="border-t border-border p-5 sm:p-6">{children}</div>
        </PanelNestingContext.Provider>
        {!embedded && (
          <div className="flex justify-between gap-3 rounded-b-xl border-t border-border bg-muted/30 px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => select(active - 1)}
              disabled={active === 0}
            >
              Back
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
                Next
              </Button>
            )}
          </div>
        )}
      </Container>
    </WizardContext.Provider>
  )
}
export default Wizard
