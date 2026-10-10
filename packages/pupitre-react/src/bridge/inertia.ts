import { router as inertiaRouter } from '@inertiajs/react'

export type RouterLike = typeof inertiaRouter
let activeRouter: RouterLike = inertiaRouter
export function setRouter(router: RouterLike): () => void {
  const previous = activeRouter
  activeRouter = router
  return () => {
    activeRouter = previous
  }
}
export function getRouter(): RouterLike {
  return activeRouter
}
export function currentUrl(): URL {
  const location = typeof window === 'undefined' ? 'http://localhost/' : window.location.href
  return new URL(location)
}
