import type { HttpContext } from '@adonisjs/core/http'
import type {
  NavEntryDefinition,
  NavGroupDefinition,
  NavItemDefinition,
} from '../definition/navigation.js'

type Definable<T> = T | { toDefinition(): T }
type Badge =
  | string
  | number
  | ((
      ctx: HttpContext
    ) => string | number | null | undefined | Promise<string | number | null | undefined>)
type Visible = boolean | ((ctx: HttpContext) => boolean | Promise<boolean>)

export type NavItemBuilder = {
  readonly definition: NavItemDefinition
  resource(slug: string): NavItemBuilder
  page(slug: string): NavItemBuilder
  url(url: string): NavItemBuilder
  external(enabled?: boolean): NavItemBuilder
  icon(value: string): NavItemBuilder
  sort(value: number): NavItemBuilder
  badge(value: Badge): NavItemBuilder
  visible(value: Visible): NavItemBuilder
  toDefinition(): NavItemDefinition
}

export type NavGroupBuilder = {
  readonly definition: NavGroupDefinition
  items(values: readonly (string | Definable<NavItemDefinition>)[]): NavGroupBuilder
  icon(value: string): NavGroupBuilder
  sort(value: number): NavGroupBuilder
  collapsible(collapsed?: boolean): NavGroupBuilder
  toDefinition(): NavGroupDefinition
}

function unwrap<T>(value: Definable<T>): T {
  return typeof value === 'object' && value !== null && 'toDefinition' in value
    ? value.toDefinition()
    : value
}

class Item implements NavItemBuilder {
  constructor(readonly definition: NavItemDefinition) {}
  private set(patch: Partial<NavItemDefinition>): NavItemBuilder {
    return new Item({ ...this.definition, ...patch })
  }
  resource(slug: string) {
    return this.set({ resource: slug, page: undefined, url: undefined })
  }
  page(slug: string) {
    return this.set({ page: slug, resource: undefined, url: undefined })
  }
  url(url: string) {
    return this.set({ url, resource: undefined, page: undefined })
  }
  external(enabled = true) {
    return this.set({ external: enabled })
  }
  icon(value: string) {
    return this.set({ icon: value })
  }
  sort(value: number) {
    return this.set({ sort: value })
  }
  badge(value: Badge) {
    return this.set({ badge: value })
  }
  visible(value: Visible) {
    return this.set({ visible: value })
  }
  toDefinition() {
    return this.definition
  }
}

class Group implements NavGroupBuilder {
  constructor(readonly definition: NavGroupDefinition) {}
  private set(patch: Partial<NavGroupDefinition>): NavGroupBuilder {
    return new Group({ ...this.definition, ...patch })
  }
  items(values: readonly (string | Definable<NavItemDefinition>)[]) {
    return this.set({
      items: values.map((value) =>
        typeof value === 'string' ? { type: 'item', resource: value } : unwrap(value)
      ),
    })
  }
  icon(value: string) {
    return this.set({ icon: value })
  }
  sort(value: number) {
    return this.set({ sort: value })
  }
  collapsible(collapsed = false) {
    return this.set({ collapsible: true, collapsed })
  }
  toDefinition() {
    return this.definition
  }
}

export const nav = {
  group(label: string): NavGroupBuilder {
    return new Group({ type: 'group', label, collapsible: false, collapsed: false, items: [] })
  },
  item(label?: string): NavItemBuilder {
    return new Item({ type: 'item', ...(label ? { label } : {}) })
  },
}

export type { NavEntryDefinition }
