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
    items: [{ label: 'Posts', url: '/admin/posts', active: true }],
  },
]

export function SidebarStory() {
  return (
    <ShellSidebar
      panel={panel as never}
      nav={nav}
      currentUrl="/admin/posts"
      onNavigate={() => {}}
    />
  )
}
