import { createError } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type {
  QueryBuilderFilterDefinition,
  QueryConstraintDefinition,
} from '../definition/table.js'
import { queryOperators } from './query_operators.js'
import { applyLiteralLike } from './like.js'

type Query = ModelQueryBuilderContract<LucidModel>
type Rule = { constraint: string; operator: string; value?: unknown; negated?: boolean }
export const E_PUPITRE_INVALID_QUERY = createError(
  'E_PUPITRE_INVALID_QUERY',
  'Invalid table query: %s',
  400
)

/** Validate the complete tree before touching the query (including branches that match no rows). */
export function parseQueryBuilder(
  value: unknown,
  filter: QueryBuilderFilterDefinition,
  zone = 'UTC'
): { groups: Rule[][] } {
  if (Array.isArray(value) && value.every((part) => typeof part === 'string'))
    value = value.join(',')
  if (typeof value !== 'string' || Buffer.byteLength(value) > 8192)
    throw new E_PUPITRE_INVALID_QUERY(['encoding'])
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new E_PUPITRE_INVALID_QUERY(['JSON'])
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    Object.keys(parsed).some((key) => key !== 'groups')
  )
    throw new E_PUPITRE_INVALID_QUERY(['groups'])
  const groups = 'groups' in parsed ? parsed.groups : undefined
  if (!Array.isArray(groups) || !groups.length || groups.length > 8)
    throw new E_PUPITRE_INVALID_QUERY(['groups'])
  let count = 0
  for (const rules of groups) {
    if (!Array.isArray(rules) || !rules.length || rules.length > 16)
      throw new E_PUPITRE_INVALID_QUERY(['rules'])
    count += rules.length
    if (count > 64) throw new E_PUPITRE_INVALID_QUERY(['rule limit'])
    for (const entry of rules) {
      if (
        !entry ||
        typeof entry !== 'object' ||
        Array.isArray(entry) ||
        Object.keys(entry).some(
          (key) => !['constraint', 'operator', 'value', 'negated'].includes(key)
        )
      )
        throw new E_PUPITRE_INVALID_QUERY(['rule'])
      const rule = entry as Rule
      const constraint = filter.constraints.find((item) => item.name === rule.constraint)
      if (
        !constraint ||
        !queryOperators[constraint.type].some((operator) => operator.value === rule.operator) ||
        (rule.negated !== undefined && typeof rule.negated !== 'boolean')
      )
        throw new E_PUPITRE_INVALID_QUERY(['constraint or operator'])
      const values = Array.isArray(rule.value) ? rule.value : [rule.value]
      if (
        values.length > 50 ||
        values.some((item) => typeof item === 'string' && item.length > 500)
      )
        throw new E_PUPITRE_INVALID_QUERY(['value limit'])
      const noValue = ['blank', 'true', 'false', 'has', 'hasNone'].includes(rule.operator)
      if (noValue) {
        if (rule.value !== undefined && rule.value !== '')
          throw new E_PUPITRE_INVALID_QUERY(['unexpected value'])
      } else if (constraint.type === 'select') {
        if (
          !Array.isArray(rule.value) ||
          !rule.value.length ||
          rule.value.some(
            (item) => typeof item !== 'string' || !Object.hasOwn(constraint.options ?? {}, item)
          )
        )
          throw new E_PUPITRE_INVALID_QUERY(['selection'])
      } else if (constraint.type === 'number' || rule.operator === 'minCount') {
        if (
          rule.operator === 'between'
            ? !Array.isArray(rule.value) || values.length !== 2
            : Array.isArray(rule.value)
        )
          throw new E_PUPITRE_INVALID_QUERY(['number shape'])
        const numbers = values.map((item) =>
          typeof item === 'number'
            ? item
            : typeof item === 'string' && item.trim()
              ? Number(item)
              : Number.NaN
        )
        if (
          numbers.some(
            (item) =>
              !Number.isFinite(item) ||
              Math.abs(item) > Number.MAX_SAFE_INTEGER ||
              (constraint.integer &&
                (!Number.isInteger(item) || item < -2147483648 || item > 2147483647))
          ) ||
          (rule.operator === 'minCount' &&
            (!Number.isSafeInteger(numbers[0]) || numbers[0]! < 0)) ||
          (rule.operator === 'between' && numbers[0]! > numbers[1]!)
        )
          throw new E_PUPITRE_INVALID_QUERY(['number'])
        rule.value = rule.operator === 'between' ? numbers : numbers[0]
      } else if (constraint.type === 'date') {
        if (
          rule.operator === 'between'
            ? !Array.isArray(rule.value) || values.length !== 2
            : Array.isArray(rule.value)
        )
          throw new E_PUPITRE_INVALID_QUERY(['date shape'])
        if (
          values.some((item) => {
            if (typeof item !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item)) return true
            const start = DateTime.fromISO(item, { zone: constraint.timezone ?? zone }).startOf(
              'day'
            )
            const last = start.plus({ days: 1 })
            return (
              !start.isValid ||
              start.year < 1 ||
              start.year > 9999 ||
              start.toUTC().year < 1 ||
              start.toUTC().year > 9999 ||
              last.year > 9999 ||
              last.toUTC().year < 1 ||
              last.toUTC().year > 9999
            )
          }) ||
          (rule.operator === 'between' && String(values[0]) > String(values[1]))
        )
          throw new E_PUPITRE_INVALID_QUERY(['date'])
      } else if (typeof rule.value !== 'string' || !rule.value.length)
        throw new E_PUPITRE_INVALID_QUERY(['text'])
    }
  }
  return { groups: groups as Rule[][] }
}

function applyRule(
  query: Query,
  constraint: QueryConstraintDefinition,
  rule: Rule,
  zone: string
): void {
  const attribute = constraint.attribute ?? constraint.name
  if (constraint.type === 'relationship') {
    if (rule.operator === 'has') query.has(attribute as never)
    else if (rule.operator === 'hasNone') query.doesntHave(attribute as never)
    else if (rule.operator === 'minCount') query.has(attribute as never, '>=', rule.value as number)
    else
      query.whereHas(attribute as never, (related) =>
        applyRule(
          related,
          { ...constraint, type: 'text', attribute: constraint.relatedAttribute! },
          rule,
          zone
        )
      )
    return
  }
  if (rule.operator === 'blank') {
    query.where((blank) => {
      blank.whereNull(attribute)
      if (constraint.type === 'text') blank.orWhere(attribute, '')
    })
  } else if (constraint.type === 'text') {
    applyLiteralLike(
      query,
      attribute,
      rule.value as string,
      rule.operator as 'contains' | 'startsWith' | 'endsWith' | 'equals'
    )
  } else if (constraint.type === 'number') {
    if (rule.operator === 'between') query.whereBetween(attribute, rule.value as [number, number])
    else {
      const operators: Record<string, string> = {
        equals: '=',
        notEquals: '<>',
        greaterThan: '>',
        greaterThanOrEqual: '>=',
        lessThan: '<',
        lessThanOrEqual: '<=',
      }
      query.where(attribute, operators[rule.operator]!, rule.value as number)
    }
  } else if (constraint.type === 'boolean') query.where(attribute, rule.operator === 'true')
  else if (constraint.type === 'select') {
    if (rule.operator === 'noneOf') query.whereNotIn(attribute, rule.value as string[])
    else query.whereIn(attribute, rule.value as string[])
  } else {
    const dates = Array.isArray(rule.value) ? rule.value : [rule.value]
    const first = DateTime.fromISO(dates[0] as string, {
      zone: constraint.timezone ?? zone,
    }).startOf('day')
    const last = DateTime.fromISO(dates[dates.length - 1] as string, {
      zone: constraint.timezone ?? zone,
    })
      .startOf('day')
      .plus({ days: 1 })
    if (!first.isValid || !last.isValid) throw new E_PUPITRE_INVALID_QUERY(['timezone'])
    // Half-open UTC day bounds also compare correctly with SQLite timestamps stored without fractions.
    const modelAttribute = query.model.$keys.columnsToAttributes.get(attribute) ?? attribute
    const calendar = query.model.$getColumn(modelAttribute)?.meta.type === 'date'
    const postgres = query.client.dialect.name === 'postgres'
    const from = calendar
      ? first.toISODate()!
      : postgres
        ? first.toUTC().toISO()!
        : first.toUTC().toFormat('yyyy-MM-dd HH:mm:ss')
    const to = calendar
      ? last.toISODate()!
      : postgres
        ? last.toUTC().toISO()!
        : last.toUTC().toFormat('yyyy-MM-dd HH:mm:ss')
    if (rule.operator === 'before') query.where(attribute, '<', from)
    else if (rule.operator === 'after') query.where(attribute, '>=', to)
    else query.where((range) => range.where(attribute, '>=', from).where(attribute, '<', to))
  }
}

export function applyQueryBuilder(
  query: Query,
  filter: QueryBuilderFilterDefinition,
  value: unknown,
  zone: string
): string {
  const parsed = parseQueryBuilder(value, filter, zone)
  // The outer AND group is mandatory: user OR branches never escape tenant/soft-delete predicates.
  query.where((outer) => {
    parsed.groups.forEach((rules, index) => {
      const method = index === 0 ? 'where' : 'orWhere'
      outer[method]((group) => {
        for (const rule of rules) {
          const constraint = filter.constraints.find((item) => item.name === rule.constraint)!
          if (rule.negated) group.whereNot((negated) => applyRule(negated, constraint, rule, zone))
          else applyRule(group, constraint, rule, zone)
        }
      })
    })
  })
  return JSON.stringify(parsed)
}
