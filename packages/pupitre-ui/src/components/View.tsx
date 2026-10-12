import { createContext, createElement, useContext, type ComponentType, type ReactNode } from 'react'
import { t } from '@rikology/pupitre-react'
import { ProfileSecurity, type ProfileSecurityProps } from './ProfileSecurity.js'

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
function isProfileSecurityProps(value: unknown): value is ProfileSecurityProps {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const props = value as Partial<ProfileSecurityProps>
  return (
    typeof props.basePath === 'string' &&
    typeof props.mfaEnabled === 'boolean' &&
    typeof props.passkeysEnabled === 'boolean'
  )
}

type RuntimeProps = { props: Record<string, unknown>; children?: ReactNode }
export function View({ props, children }: RuntimeProps) {
  const registry = useViewContext()
  const name = typeof props.component === 'string' ? props.component : ''
  if (name === 'PupitreProfileSecurity') {
    if (!isProfileSecurityProps(props.props)) return null
    return createElement(ProfileSecurity, props.props)
  }
  const Component = registry[name]
  if (!Component)
    return (
      <div
        className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground"
        data-view-component={name || undefined}
      >
        {t('View component unavailable')}
      </div>
    )
  const componentProps =
    props.props && typeof props.props === 'object' && !Array.isArray(props.props)
      ? (props.props as Record<string, unknown>)
      : {}
  return createElement(Component, { ...componentProps, children })
}
export default View
