import { createContext, useContext, useId, type ReactNode } from 'react'
import { useBoundValue, useEmbedded } from '@rikology/pupitre-react'
import {
  cn,
  underlineTabClasses,
  segmentedListClasses,
  segmentedItemClasses,
} from '../primitives/index.js'
import { PanelNestingContext } from './Section.js'

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
  const nested = useContext(PanelNestingContext)
  const embedded = useEmbedded()

  return (
    <TabContext.Provider value={{ active: active ?? initial, select: setActive, id }}>
      <div id={id} className="min-w-0" data-tabs-id={id} data-pupitre-tabs="">
        <div
          data-pupitre-tabs-list=""
          role="tablist"
          aria-label={typeof props.label === 'string' ? props.label : undefined}
          className={cn(
            props.contained === false
              ? segmentedListClasses
              : cn(
                  'flex items-end gap-5 overflow-x-auto border-b',
                  nested || embedded ? 'border-border' : 'border-rule'
                )
          )}
        >
          {tabs.map((tab) => (
            <button
              data-pupitre-tab=""
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
              className={cn(
                props.contained === false
                  ? segmentedItemClasses
                  : cn(underlineTabClasses, 'h-9 px-0'),
                'disabled:opacity-50'
              )}
              onClick={() => setActive(tab.key)}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span className="ml-2 rounded-full bg-muted px-1.5 text-xs">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
        <PanelNestingContext.Provider value={true}>
          <div data-pupitre-tabs-body="" className="pt-5">
            {children}
          </div>
        </PanelNestingContext.Provider>
      </div>
    </TabContext.Provider>
  )
}

export default Tabs
