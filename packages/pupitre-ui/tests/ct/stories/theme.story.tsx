import { Shell } from '../../../src/components/Shell.js'

export function ThemeStory({
  sidebar = 'expanded',
}: {
  sidebar?: 'expanded' | 'collapsed' | 'top-nav'
}) {
  return (
    <Shell
      panel={{
        id: 'theme-test',
        path: '/admin',
        brand: { name: 'Theme' },
        features: {},
        theme: {
          density: 'compact',
          sidebar,
          sidebarCollapsibleOnDesktop: sidebar !== 'top-nav',
          contentWidth: '3xl',
        },
      }}
      user={null}
      nav={[{ label: 'Content', items: [{ label: 'Posts', url: '/admin/posts', icon: 'file' }] }]}
      breadcrumbs={[]}
      title="Theme"
      headerActions={[]}
      currentUrl="/admin"
      tenant={null}
      tenants={[]}
    >
      <div>Theme content</div>
      <input type="checkbox" aria-label="Density checkbox" />
    </Shell>
  )
}
