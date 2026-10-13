import { stableJson } from '../definition/shared.js'

import type { ClusterDefinition } from '../definition/cluster.js'

export class ClusterBuilder {
  constructor(readonly definition: ClusterDefinition) {}
  private change(patch: Partial<ClusterDefinition>): ClusterBuilder {
    return new ClusterBuilder({ ...this.definition, ...patch })
  }
  label(value: string) {
    return this.change({ label: value })
  }
  icon(value: string) {
    return this.change({ icon: value })
  }
  navigationGroup(value: string) {
    return this.change({ navigationGroup: value })
  }
  sort(value: number) {
    return this.change({ sort: value })
  }
  subNavigationPosition(value: 'start' | 'top') {
    return this.change({ subNavigationPosition: value })
  }
  toDefinition() {
    return this.definition
  }
  toJSON() {
    return stableJson(this.definition)
  }
}

export function defineCluster(slug: string): ClusterBuilder {
  return new ClusterBuilder({
    slug,
    label: slug.replaceAll('-', ' ').replace(/^\w/, (value) => value.toUpperCase()),
    sort: 0,
    subNavigationPosition: 'start',
  })
}
