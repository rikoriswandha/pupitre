export type ClusterDefinition = {
  slug: string
  label: string
  icon?: string
  navigationGroup?: string
  sort: number
  subNavigationPosition: 'start' | 'top'
}
