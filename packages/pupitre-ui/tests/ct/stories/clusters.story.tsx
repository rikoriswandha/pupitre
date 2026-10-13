import { ClusterNavigation } from '../../../src/components/ClusterNavigation.js'

export function ClustersStory({ position = 'start' }: { position?: 'start' | 'top' }) {
  return (
    <main className="bg-background p-6 text-foreground">
      <h1>Catalog</h1>
      <ClusterNavigation
        position={position}
        items={[
          { key: 'categories', label: 'Categories', url: '#categories', active: true },
          { key: 'tags', label: 'Tags', url: '#tags' },
        ]}
      />
    </main>
  )
}
