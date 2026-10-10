import { createContext, createElement, useContext, type ComponentType, type ReactNode } from 'react'

type ViewComponent = ComponentType<Record<string, unknown> & { children?: ReactNode }>
export const ViewContext = createContext<Record<string, ViewComponent>>({})
export function ViewRegistryProvider({
  registry,
  children,
}: {
  registry: Record<string, ViewComponent>
  children?: ReactNode
}) {
  return <ViewContext.Provider value={registry}>{children}</ViewContext.Provider>
}
export function useViewContext() {
  return useContext(ViewContext)
}
type RuntimeProps = { props: Record<string, unknown>; children?: ReactNode }
export function View({ props, children }: RuntimeProps) {
  const registry = useViewContext()
  const name = typeof props.component === 'string' ? props.component : ''
  const Component = registry[name]
  if (!Component)
    return (
      <div
        className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground"
        data-view-component={name || undefined}
      >
        View component unavailable
      </div>
    )
  const componentProps =
    props.props && typeof props.props === 'object' && !Array.isArray(props.props)
      ? (props.props as Record<string, unknown>)
      : {}
  return createElement(Component, { ...componentProps, children })
}
export default View
