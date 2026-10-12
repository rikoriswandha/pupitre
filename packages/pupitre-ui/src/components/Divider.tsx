export function Divider({ props = {} }: { props?: Record<string, unknown> }) {
  const label = typeof props.label === 'string' ? props.label : undefined
  if (label)
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={label}
        className="my-5 flex items-center gap-3"
      >
        <span className="flex-1 border-t border-border" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="flex-1 border-t border-border" />
      </div>
    )
  return (
    <hr
      className="my-5 border-0 border-t border-border"
      role="separator"
      aria-orientation="horizontal"
    />
  )
}
export default Divider
