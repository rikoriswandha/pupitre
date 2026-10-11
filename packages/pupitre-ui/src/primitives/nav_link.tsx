import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { useVisit } from '@rikology/pupitre-react'

type NavLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

/**
 * Anchor that navigates same-origin panel pages through Inertia instead of a
 * full document load. Modified clicks, new-tab targets, downloads, in-page
 * fragments and cross-origin URLs keep native browser behavior.
 */
export function NavLink({ href, onClick, ...props }: NavLinkProps) {
  const visit = useVisit()
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (props.target && props.target !== '_self') ||
      props.download !== undefined ||
      href.startsWith('#')
    )
      return
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return
    event.preventDefault()
    visit(`${url.pathname}${url.search}${url.hash}`)
  }
  return <a {...props} href={href} onClick={handleClick} />
}
