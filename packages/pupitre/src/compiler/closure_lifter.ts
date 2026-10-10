import { parse } from 'acorn'
import { computedFunctionNames } from '../../catalog/index.js'

export type LiftResult =
  { kind: 'expression'; value: unknown } | { kind: 'computed'; value: unknown } | { kind: 'static' }

type Node = {
  type: string
  body?: Node | Node[]
  expression?: Node
  argument?: Node
  params?: Node[]
  properties?: Node[]
  key?: Node
  value?: unknown
  quasis?: Node[]
  expressions?: Node[]
  callee?: Node
  arguments?: Node[]
  name?: string
  operator?: string
  left?: Node
  right?: Node
  test?: Node
  consequent?: Node
  alternate?: Node
  cooked?: string | null
  raw?: string
}
type Scope = {
  pathPrefix: string
  inRepeater: boolean
  getNames?: Record<string, true>
  setNames?: Record<string, true>
}
type Lifted = { value: unknown; computed: boolean }
const computedNames: Record<string, true> = Object.fromEntries(
  computedFunctionNames.map((name) => [name, true])
)

type ParsedFunction = { params?: Node[]; body?: Node | Node[]; type: string }
function parseFunction(fn: Function): ParsedFunction | null {
  try {
    const program = parse(`(${fn.toString()})`, { ecmaVersion: 'latest' }) as unknown as {
      body?: Array<{ expression?: ParsedFunction }>
    }
    return program.body?.[0]?.expression ?? null
  } catch {
    return null
  }
}
function expressionNode(fn: Function): Node | null {
  const expression = parseFunction(fn)
  if (!expression) return null
  if (
    expression.type === 'ArrowFunctionExpression' &&
    expression.body &&
    !Array.isArray(expression.body) &&
    expression.body.type !== 'BlockStatement'
  )
    return expression.body
  const statements =
    expression.body && !Array.isArray(expression.body) && Array.isArray(expression.body.body)
      ? expression.body.body
      : null
  if (!statements) return null
  const returned = statements.find((statement) => statement.type === 'ReturnStatement')
  if (returned?.argument) return returned.argument
  return expression.body && !Array.isArray(expression.body) ? expression.body : null
}
function aliases(fn: Function, key: 'get' | 'set'): Record<string, true> {
  const result: Record<string, true> = { [key]: true }
  const parameter = parseFunction(fn)?.params?.[0]
  if (parameter?.type !== 'ObjectPattern') return result
  for (const property of parameter.properties ?? []) {
    if (
      property.key?.name === key &&
      property.value &&
      typeof property.value === 'object' &&
      'name' in property.value
    ) {
      const name = property.value.name
      if (typeof name === 'string') result[name] = true
    }
  }
  return result
}
function getCall(node: Node, scope: Scope): boolean {
  return (
    node.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    Boolean(node.callee.name && scope.getNames?.[node.callee.name])
  )
}
function pathFor(path: string, scope: Scope) {
  const clean = path.replace(/^\/+/, '')
  if (scope.inRepeater && !clean.includes('.')) return { $item: clean }
  const prefix = scope.pathPrefix.replace(/\/$/, '')
  return { $state: `${prefix}/${clean.replaceAll('.', '/')}` }
}
function lift(node: Node, scope: Scope): Lifted | null {
  if (node.type === 'Literal') return { value: node.value, computed: false }
  if (node.type === 'TemplateLiteral') {
    let text = ''
    const quasis = node.quasis ?? []
    const expressions = node.expressions ?? []
    for (const [index, quasi] of quasis.entries()) {
      const value = quasi!.value as { cooked?: string | null; raw?: string }
      text += value.cooked ?? value.raw ?? ''
      if (index < expressions.length) {
        const part = lift(expressions[index]!, scope)
        if (!part) return null
        const binding = part.value as Record<string, unknown>
        if (binding.$state) text += `\${${String(binding.$state)}}`
        else if (binding.$item) text += `\${${String(binding.$item)}}`
        else return null
      }
    }
    return { value: { $template: text }, computed: false }
  }
  if (getCall(node, scope)) {
    const path = node.arguments?.[0]?.value
    return typeof path === 'string' ? { value: pathFor(path, scope), computed: false } : null
  }
  if (node.type === 'UnaryExpression' && node.operator === '!') {
    const arg = node.argument ? lift(node.argument, scope) : null
    if (!arg || !('$state' in (arg.value as object) || '$item' in (arg.value as object)))
      return null
    return { value: { ...(arg.value as object), not: true }, computed: false }
  }
  if (node.type === 'LogicalExpression') {
    if (!node.left || !node.right) return null
    const left = lift(node.left, scope)
    const right = lift(node.right, scope)
    if (!left || !right) return null
    return {
      value: { [node.operator === '&&' ? '$and' : '$or']: [left.value, right.value] },
      computed: left.computed || right.computed,
    }
  }
  if (node.type === 'BinaryExpression') {
    if (!node.left || !node.right) return null
    const left = lift(node.left, scope)
    const right = lift(node.right, scope)
    if (!left || !right) return null
    const compare: Record<string, string> = {
      '===': 'eq',
      '==': 'eq',
      '!==': 'neq',
      '!=': 'neq',
      '>': 'gt',
      '>=': 'gte',
      '<': 'lt',
      '<=': 'lte',
    }
    const operator = node.operator ?? ''
    if (compare[operator]) {
      const stateSide = left.value as Record<string, unknown>
      if ('$state' in stateSide || '$item' in stateSide)
        return { value: { ...stateSide, [compare[operator]!]: right.value }, computed: false }
      const rightSide = right.value as Record<string, unknown>
      if ('$state' in rightSide || '$item' in rightSide)
        return { value: { ...rightSide, [compare[operator]!]: left.value }, computed: false }
      return null
    }
    const fn: Record<string, string> = { '*': 'mul', '+': 'add', '-': 'sub', '/': 'div' }
    const functionName = fn[operator]
    if (!functionName || !computedNames[functionName]) return null
    return { value: { $computed: functionName, args: [left.value, right.value] }, computed: true }
  }
  if (node.type === 'ConditionalExpression') {
    if (!node.test || !node.consequent || !node.alternate) return null
    const test = lift(node.test, scope)
    const consequent = lift(node.consequent, scope)
    const alternate = lift(node.alternate, scope)
    if (!test || !consequent || !alternate) return null
    return {
      value: { $cond: test.value, $then: consequent.value, $else: alternate.value },
      computed: test.computed || consequent.computed || alternate.computed,
    }
  }
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    node.callee.name &&
    computedNames[node.callee.name]
  ) {
    const args = (node.arguments ?? []).map((argument) => lift(argument, scope))
    if (args.some((argument) => !argument)) return null
    return {
      value: {
        $computed: node.callee.name,
        args: args.map((argument) => (argument as Lifted).value),
      },
      computed: true,
    }
  }
  return null
}
export function liftClosure(
  fn: Function,
  purpose: 'visible' | 'disabled' | 'label' | 'content' | 'afterStateUpdated',
  scope: Scope
): LiftResult {
  const closureScope = { ...scope, getNames: aliases(fn, 'get'), setNames: aliases(fn, 'set') }
  const body = expressionNode(fn)
  if (!body) return { kind: 'static' }
  if (purpose === 'afterStateUpdated') {
    const statements =
      body.type === 'BlockStatement' && Array.isArray(body.body)
        ? body.body
        : [{ type: 'ExpressionStatement', expression: body }]
    const updates: unknown[] = []
    for (const statement of statements) {
      const call = statement.expression
      if (
        call?.type !== 'CallExpression' ||
        call.callee?.type !== 'Identifier' ||
        !call.callee.name ||
        !closureScope.setNames?.[call.callee.name]
      )
        return { kind: 'static' }
      const path = call.arguments?.[0]?.value
      const value = call.arguments?.[1] ? lift(call.arguments[1], closureScope) : null
      if (typeof path !== 'string' || !value) return { kind: 'static' }
      const statePath = scope.inRepeater
        ? { $item: path }
        : `${scope.pathPrefix}/${path.replaceAll('.', '/')}`
      updates.push({ action: 'setState', params: { statePath, value: value.value } })
    }
    return { kind: 'expression', value: updates }
  }
  const result = lift(body, closureScope)
  if (!result) return { kind: 'static' }
  return { kind: result.computed ? 'computed' : 'expression', value: result.value }
}

export function evaluateClosure(
  fn: Function,
  data: Record<string, unknown>,
  record: Record<string, unknown> | null,
  ctx?: unknown
) {
  return fn({
    get: (path: string) => {
      let value: unknown = data
      for (const key of path.split('.')) {
        if (!value || typeof value !== 'object') return undefined
        value = (value as Record<string, unknown>)[key]
      }
      return value
    },
    record,
    ctx,
  })
}
