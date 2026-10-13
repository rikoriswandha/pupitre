import { defineCluster } from '@rikology/pupitre'

export default defineCluster('catalog')
  .label('Catalog')
  .icon('tag')
  .navigationGroup('Content')
  .sort(2)
