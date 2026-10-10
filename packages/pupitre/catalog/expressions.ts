import { z } from 'zod'

const expressionSchema = z.union([
  z.object({ $state: z.string() }).passthrough(),
  z.object({ $bindState: z.string() }).passthrough(),
  z.object({ $bindItem: z.string() }).passthrough(),
  z.object({ $item: z.string() }).passthrough(),
  z.object({ $index: z.literal(true) }).passthrough(),
  z.object({ $cond: z.unknown(), $then: z.unknown(), $else: z.unknown() }).passthrough(),
  z.object({ $template: z.string() }).passthrough(),
  z
    .object({ $computed: z.string(), args: z.record(z.string(), z.unknown()).optional() })
    .passthrough(),
])

/** Accepts either a literal prop value or a json-render expression. */
export function dynamic<T extends z.ZodType>(schema: T) {
  return z.union([schema, expressionSchema]).transform((value): z.output<T> => value as z.output<T>)
}

export const jsonRenderExpression = expressionSchema
export const jsonRenderValue = z.unknown()

export const visibilitySchema = z.union([
  z.boolean(),
  z
    .object({
      $state: z.string(),
      eq: z.unknown().optional(),
      neq: z.unknown().optional(),
      gt: z.number().optional(),
      gte: z.number().optional(),
      lt: z.number().optional(),
      lte: z.number().optional(),
      not: z.boolean().optional(),
    })
    .passthrough(),
  z
    .object({ $item: z.string(), eq: z.unknown().optional(), neq: z.unknown().optional() })
    .passthrough(),
  z
    .object({
      $index: z.literal(true),
      eq: z.number().optional(),
      neq: z.number().optional(),
      gt: z.number().optional(),
      gte: z.number().optional(),
      lt: z.number().optional(),
      lte: z.number().optional(),
    })
    .passthrough(),
  z.object({ $and: z.array(z.unknown()) }).passthrough(),
  z.object({ $or: z.array(z.unknown()) }).passthrough(),
  z.array(z.unknown()),
])
