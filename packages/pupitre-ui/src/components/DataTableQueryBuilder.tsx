import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { t } from '@rikology/pupitre-react'
import { Button, CheckboxControl, Input, SelectMenu } from '../primitives/index.js'

type Constraint = {
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'relationship'
  options?: { value: string | number; label: string }[]
  operators: { value: string; label: string }[]
}
type Rule = {
  constraint: string
  operator: string
  value?: string | number | boolean | string[] | [number, number] | [string, string]
  negated?: boolean
}
type Filter = { name: string; label: string; constraints: Constraint[] }

function seed(value: string): Rule[][] {
  try {
    const parsed = JSON.parse(value) as { groups?: Rule[][] }
    return Array.isArray(parsed.groups) ? parsed.groups : []
  } catch {
    return []
  }
}

function inputValue(rule: Rule, between: boolean, part: number): string | number {
  const value = between && Array.isArray(rule.value) ? rule.value[part] : rule.value
  return typeof value === 'number' || typeof value === 'string' ? value : ''
}

export function DataTableQueryBuilder({
  filter,
  value,
  onApply,
  queryPrefix,
  deferred,
  onValidityChange,
}: {
  filter: Filter
  value: string
  onApply(value: string): void
  queryPrefix?: string
  deferred?: boolean
  onValidityChange?: (valid: boolean) => void
}) {
  const [source, setSource] = useState(value)
  const section = useRef<HTMLElement>(null)
  const focusTarget = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (!focusTarget.current) return
    section.current?.querySelector<HTMLButtonElement>(focusTarget.current)?.focus()
    focusTarget.current = null
  })
  const [groups, setGroups] = useState<Rule[][]>(() => seed(value))
  if (source !== value) {
    setSource(value)
    setGroups(seed(value))
  }
  const count = groups.reduce((total, rules) => total + rules.length, 0)
  const first = filter.constraints[0]
  const initialRule: Rule = {
    constraint: first?.name ?? '',
    operator: first?.operators[0]?.value ?? '',
  }
  const update = (groupIndex: number, ruleIndex: number, patch: Partial<Rule>) =>
    setGroups((current) =>
      current.map((rules, index) =>
        index === groupIndex
          ? rules.map((rule, inner) => (inner === ruleIndex ? { ...rule, ...patch } : rule))
          : rules
      )
    )
  const complete = groups.every((rules) =>
    rules.every((rule) => {
      if (['blank', 'true', 'false', 'has', 'hasNone'].includes(rule.operator)) return true
      if (rule.operator === 'minCount')
        return typeof rule.value === 'number' && Number.isInteger(rule.value) && rule.value >= 0
      if (Array.isArray(rule.value))
        return (
          rule.value.length > 0 &&
          (rule.operator !== 'between' ||
            (rule.value.length === 2 && rule.value[0] <= rule.value[1])) &&
          rule.value.every(
            (item) => item !== '' && Number.isFinite(typeof item === 'number' ? item : 0)
          )
        )
      return (
        rule.value !== undefined &&
        rule.value !== '' &&
        (typeof rule.value !== 'number' || Number.isFinite(rule.value))
      )
    })
  )
  const serialized = JSON.stringify({ groups: groups.filter((rules) => rules.length) })
  const filterKey = queryPrefix
    ? `${queryPrefix}[filters][${filter.name}]`
    : `filters[${filter.name}]`
  const prospectiveQuery = new URLSearchParams(
    typeof window === 'undefined' ? '' : window.location.search
  )
  prospectiveQuery.delete(queryPrefix ? `${queryPrefix}[page]` : 'page')
  for (const key of Array.from(prospectiveQuery.keys()))
    if (key === filterKey || key.startsWith(`${filterKey}[`)) prospectiveQuery.delete(key)
  if (count > 0) prospectiveQuery.set(filterKey, serialized)
  const encodedQuery = prospectiveQuery.toString()
  const encoder = new TextEncoder()
  const withinLimit =
    encoder.encode(serialized).length <= 8192 && encoder.encode(encodedQuery).length <= 8192
  useEffect(() => {
    onValidityChange?.(complete && withinLimit)
  }, [complete, withinLimit, onValidityChange])
  useEffect(() => {
    if (deferred && value !== (count ? serialized : '')) onApply(count ? serialized : '')
  }, [deferred, value, count, serialized, onApply])
  return (
    <section ref={section} aria-label={filter.label} className="min-h-32 min-w-0 space-y-3 text-sm">
      <h3 className="font-medium">{filter.label}</h3>
      {groups.map((rules, groupIndex) => (
        <div key={groupIndex} className="space-y-2">
          {groupIndex > 0 && <p className="font-medium">{t('OR')}</p>}
          <fieldset className="min-w-0 space-y-3 rounded border border-border p-3">
            <legend className="px-1">
              {t('Match all rules in group {number}', { number: groupIndex + 1 })}
            </legend>
            {rules.map((rule, ruleIndex) => {
              const constraint = filter.constraints.find((item) => item.name === rule.constraint)
              if (!constraint) return null
              const label = t('Group {group}, rule {rule}', {
                group: groupIndex + 1,
                rule: ruleIndex + 1,
              })
              const valueless = ['blank', 'true', 'false', 'has', 'hasNone'].includes(rule.operator)
              const numeric = constraint.type === 'number' || rule.operator === 'minCount'
              const between = rule.operator === 'between'
              return (
                <div key={ruleIndex} className="space-y-2">
                  <SelectMenu
                    aria-label={t('{label}: constraint', { label })}
                    value={rule.constraint}
                    options={filter.constraints.map((item) => ({
                      value: item.name,
                      label: item.label,
                    }))}
                    onValueChange={(name) => {
                      const next = filter.constraints.find((item) => item.name === name)!
                      update(groupIndex, ruleIndex, {
                        constraint: name,
                        operator: next.operators[0].value,
                        value: undefined,
                      })
                    }}
                  />
                  <SelectMenu
                    aria-label={t('{label}: operator', { label })}
                    value={rule.operator}
                    options={constraint.operators}
                    onValueChange={(operator) =>
                      update(groupIndex, ruleIndex, { operator, value: undefined })
                    }
                  />
                  {!valueless &&
                    (constraint.type === 'select' ? (
                      <div className="space-y-2">
                        {constraint.options?.map((option) => (
                          <label key={option.value} className="flex items-center gap-2">
                            <CheckboxControl
                              checked={
                                Array.isArray(rule.value) &&
                                rule.value.some((selected) => selected === String(option.value))
                              }
                              disabled={
                                Array.isArray(rule.value) &&
                                rule.value.length >= 50 &&
                                !(rule.value as string[]).includes(String(option.value))
                              }
                              onCheckedChange={(checked) =>
                                update(groupIndex, ruleIndex, {
                                  value: checked
                                    ? [
                                        ...(Array.isArray(rule.value)
                                          ? (rule.value as string[])
                                          : []),
                                        String(option.value),
                                      ]
                                    : (Array.isArray(rule.value)
                                        ? (rule.value as string[])
                                        : []
                                      ).filter((item) => item !== String(option.value)),
                                })
                              }
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className={between ? 'grid grid-cols-2 gap-2' : ''}>
                        {Array.from({ length: between ? 2 : 1 }, (_, part) => (
                          <Input
                            key={part}
                            aria-label={
                              between
                                ? t('{label}: value {number}', { label, number: part + 1 })
                                : t('{label}: value', { label })
                            }
                            type={numeric ? 'number' : constraint.type === 'date' ? 'date' : 'text'}
                            min={rule.operator === 'minCount' ? 0 : undefined}
                            step={rule.operator === 'minCount' ? 1 : numeric ? 'any' : undefined}
                            maxLength={500}
                            value={inputValue(rule, between, part)}
                            onChange={(event) => {
                              const raw = event.currentTarget.value
                              const next = numeric && raw !== '' ? Number(raw) : raw
                              if (between) {
                                const tuple = [
                                  ...(Array.isArray(rule.value) ? rule.value : ['', '']),
                                ]
                                tuple[part] = next
                                update(groupIndex, ruleIndex, {
                                  value: tuple as [number, number] | [string, string],
                                })
                              } else update(groupIndex, ruleIndex, { value: next })
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2">
                      <CheckboxControl
                        checked={rule.negated ?? false}
                        onCheckedChange={(negated) => update(groupIndex, ruleIndex, { negated })}
                      />
                      {t('Negate rule')}
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('Remove {label}', { label })}
                      onClick={() => {
                        focusTarget.current = `[data-add-rule="${groupIndex}"]`
                        setGroups((current) =>
                          current.map((items, index) =>
                            index === groupIndex
                              ? items.filter((_, inner) => inner !== ruleIndex)
                              : items
                          )
                        )
                      }}
                    >
                      {t('Remove rule')}
                    </Button>
                  </div>
                </div>
              )
            })}
            <div className="flex flex-wrap gap-2">
              <Button
                data-add-rule={groupIndex}
                size="sm"
                disabled={!first || rules.length >= 16 || count >= 64}
                onClick={() =>
                  setGroups((current) =>
                    current.map((items, index) =>
                      index === groupIndex ? [...items, { ...initialRule }] : items
                    )
                  )
                }
              >
                {t('Add rule')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  focusTarget.current = '[data-add-group]'
                  setGroups((current) => current.filter((_, index) => index !== groupIndex))
                }}
              >
                {t('Remove group')}
              </Button>
            </div>
          </fieldset>
        </div>
      ))}
      <Button
        data-add-group=""
        size="sm"
        disabled={!first || groups.length >= 8 || count >= 64}
        onClick={() => setGroups((current) => [...current, [{ ...initialRule }]])}
      >
        {groups.length ? t('Add OR group') : t('Add rule group')}
      </Button>
      <div className="flex flex-wrap gap-2">
        {!deferred && (
          <Button
            size="sm"
            disabled={!complete || !withinLimit}
            onClick={() => onApply(count ? serialized : '')}
          >
            {t('Apply query')}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setGroups([])
            onApply('')
          }}
        >
          {t('Reset query')}
        </Button>
      </div>
      {!complete && <p role="alert">{t('Complete all query rules before applying filters.')}</p>}
      {!withinLimit && <p role="alert">{t('Query exceeds the URL size limit.')}</p>}
      {value && (
        <p role="status">
          {t('{count} active query rules', {
            count: seed(value).reduce((total, rules) => total + rules.length, 0),
          })}
        </p>
      )}
      {value && (
        <ul className="space-y-1 text-muted-foreground">
          {seed(value).map((rules, index) => (
            <li key={index}>
              {rules
                .map((rule) => {
                  const constraint = filter.constraints.find(
                    (item) => item.name === rule.constraint
                  )
                  const operator = constraint?.operators.find(
                    (item) => item.value === rule.operator
                  )
                  const values = Array.isArray(rule.value)
                    ? rule.value
                    : rule.value === undefined
                      ? []
                      : [rule.value]
                  const summary = t('{constraint} {operator}: {value}', {
                    constraint: constraint?.label ?? rule.constraint,
                    operator: operator?.label ?? rule.operator,
                    value: values
                      .map(
                        (item) =>
                          constraint?.options?.find(
                            (option) => String(option.value) === String(item)
                          )?.label ?? String(item)
                      )
                      .join(', '),
                  })
                  return rule.negated ? t('Not ({rule})', { rule: summary }) : summary
                })
                .reduce(
                  (left, right) => (left ? t('{left} AND {right}', { left, right }) : right),
                  ''
                )}
              {index < seed(value).length - 1 && <span> {t('OR')}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
