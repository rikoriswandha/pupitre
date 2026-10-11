import { useEffect } from 'react'
import { setRouter } from '@rikology/pupitre-react'
import { TenantSwitcher } from '../../../src/components/TenantSwitcher.js'

export function TenantSwitcherStory() {
  useEffect(() => {
    const restoreRouter = setRouter({
      visit: (url: string, options?: { method?: string; data?: Record<string, unknown> }) => {
        const output = document.querySelector('[data-testid="tenant-switch"]')
        if (output) output.textContent = JSON.stringify({ url, ...options })
      },
      reload: () => {},
      put: () => {},
      post: () => {},
      on: () => () => {},
    } as never)
    return restoreRouter
  }, [])

  return (
    <div className="w-64 p-8">
      <TenantSwitcher
        tenant={{ id: 1, name: 'Acme', slug: 'acme' }}
        tenants={[
          { id: 1, name: 'Acme', url: '/admin/_pupitre/tenant', method: 'post', current: true },
          { id: 2, name: 'Globex', url: '/admin/_pupitre/tenant', method: 'post' },
        ]}
      />
      <output data-testid="tenant-switch" />
    </div>
  )
}
