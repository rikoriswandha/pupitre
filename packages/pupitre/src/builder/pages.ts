import type { PageDefinition, PageKind } from '../definition/page.js'
class Page {
  constructor(readonly definition: PageDefinition) {}
  component(value: string): Page {
    return new Page({ ...this.definition, component: value })
  }
  redirectTo(value: 'edit' | 'list' | 'view'): Page {
    return new Page({ ...this.definition, redirectTo: value })
  }
  tabs(value: NonNullable<PageDefinition['tabs']>): Page {
    return new Page({ ...this.definition, tabs: value })
  }
}
function make(kind: PageKind): Page {
  return new Page({ kind })
}
export const pages = {
  list: () => make('list'),
  create: () => make('create'),
  edit: () => make('edit'),
  view: () => make('view'),
}
export type PageBuilder = Page
