import { useEffect, useState } from 'react'
import { setRouter } from '@rikology/pupitre-react'
import { ShellSidebar } from '../../../src/components/ShellSidebar.js'

const panel = {
  id: 'ct-sidebar',
  path: '/admin',
  brand: { name: 'Pupitre' },
  theme: {},
  features: {},
}
const nav = [
  {
    label: 'Content',
    collapsible: true,
    collapsed: false,
    items: [{ label: 'Posts', url: '/admin/posts', active: true, badge: 4 }],
  },
]

export function SidebarStory({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <ShellSidebar
      panel={panel as never}
      nav={nav}
      currentUrl="/admin/posts"
      onNavigate={() => {}}
      collapsed={collapsed}
    />
  )
}

export function SidebarNavigationStory() {
  const [visited, setVisited] = useState('')
  useEffect(
    () =>
      setRouter({
        visit: (url: string) => setVisited(url),
        on: () => () => {},
      } as never),
    []
  )
  return (
    <>
      <SidebarStory />
      <output data-testid="visited">{visited}</output>
    </>
  )
}
