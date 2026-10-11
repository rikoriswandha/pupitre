import { createContext, useId, type ReactNode } from 'react'
import { useBoundValue } from '@rikology/pupitre-react'

type TabContextValue = { active: string; select: (key: string) => void; id: string }
export const TabContext = createContext<TabContextValue | null>(null)
type RuntimeProps = {
  props: Record<string, unknown>
  children?: ReactNode
  bindings?: Record<string, string | undefined>
}

export function Tabs({ props, children, bindings }: RuntimeProps) {
  const tabs = Array.isArray(props.tabs)
    ? props.tabs.filter(
        (tab): tab is { key: string; label: string; badge?: string | number; disabled?: boolean } =>
          !!tab &&
          typeof tab === 'object' &&
          'key' in tab &&
          'label' in tab &&
          typeof tab.key === 'string' &&
          typeof tab.label === 'string'
      )
    : []
  const initial =
    typeof props.active === 'string' ? props.active : (tabs.find((tab) => !tab.disabled)?.key ?? '')
  const [active, setActive] = useBoundValue(initial, bindings?.active)
  const generatedId = useId()
  const id = typeof props.id === 'string' ? props.id : generatedId

  return (
    <TabContext.Provider value={{ active: active ?? initial, select: setActive, id }}>
      <div id={id} className="space-y-4" data-tabs-id={id}>
        <div
          role="tablist"
          aria-label={typeof props.label === 'string' ? props.label : undefined}
          className="flex gap-1 overflow-x-auto border-b border-border"
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`${id}-${tab.key}-tab`}
              aria-selected={(active ?? initial) === tab.key}
              aria-controls={`${id}-${tab.key}-panel`}
              disabled={tab.disabled === true}
              tabIndex={(active ?? initial) === tab.key ? 0 : -1}
              onKeyDown={(event) => {
                const enabled = tabs.filter((candidate) => !candidate.disabled)
                const index = enabled.findIndex((candidate) => candidate.key === tab.key)
                const next =
                  event.key === 'Home'
                    ? enabled[0]
                    : event.key === 'End'
                      ? enabled[enabled.length - 1]
                      : event.key === 'ArrowRight'
                        ? enabled[(index + 1) % enabled.length]
                        : event.key === 'ArrowLeft'
                          ? enabled[(index - 1 + enabled.length) % enabled.length]
                          : undefined
                if (!next) return
                event.preventDefault()
                setActive(next.key)
                document.getElementById(`${id}-${next.key}-tab`)?.focus()
              }}
              className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground aria-selected:border-primary aria-selected:text-foreground disabled:opacity-50"
              onClick={() => setActive(tab.key)}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span className="ml-2 rounded-full bg-muted px-1.5 text-xs">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
        {children}
      </div>
    </TabContext.Provider>
  )
}

export default Tabs
