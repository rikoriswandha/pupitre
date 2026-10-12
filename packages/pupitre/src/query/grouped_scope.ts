import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

type Query = ModelQueryBuilderContract<LucidModel>

/** Keep callback predicates in an AND group without moving non-WHERE operations. */
export function applyGroupedScope(query: Query, callback: (query: Query) => unknown): void {
  const predicates: Array<(builder: Query) => void> = []
  const scoped = new Proxy(query, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver)
      // The model is a class-valued property, not a query-builder method.
      if (property === 'model' || typeof value !== 'function') return value
      return (...args: unknown[]) => {
        if (
          typeof property === 'string' &&
          /^(?:where|orWhere|andWhere|has$|orHas$|andHas$|doesntHave$|orDoesntHave$|andDoesntHave$)/.test(
            property
          )
        ) {
          predicates.push((builder) => {
            const method = Reflect.get(builder, property) as (...values: unknown[]) => unknown
            method.apply(builder, args)
          })
          return scoped
        }
        // Lucid caches ModelScopes on the real builder; each group needs its own proxy.
        if (property === 'withScopes' || property === 'apply') {
          const previous = Reflect.get(target, 'scopesWrapper')
          Reflect.set(target, 'scopesWrapper', undefined)
          try {
            value.apply(scoped, args)
            return scoped
          } finally {
            Reflect.set(target, 'scopesWrapper', previous)
          }
        }
        const result: unknown = value.apply(
          ['if', 'unless', 'match', 'withScopes', 'apply'].includes(String(property))
            ? scoped
            : target,
          args
        )
        return result === target ? scoped : result
      }
    },
  })
  callback(scoped)
  if (predicates.length) query.where((builder) => predicates.forEach((apply) => apply(builder)))
}
