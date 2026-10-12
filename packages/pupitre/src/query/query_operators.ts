import type { QueryConstraintType } from '../definition/table.js'
import { t } from '../i18n.js'

const text = [
  { value: 'contains', label: t('Contains') },
  { value: 'startsWith', label: t('Starts with') },
  { value: 'endsWith', label: t('Ends with') },
  { value: 'equals', label: t('Equals') },
  { value: 'blank', label: t('Is blank') },
]
export const queryOperators: Record<QueryConstraintType, { value: string; label: string }[]> = {
  text,
  number: [
    { value: 'equals', label: t('Equals') },
    { value: 'notEquals', label: t('Does not equal') },
    { value: 'greaterThan', label: t('Greater than') },
    { value: 'greaterThanOrEqual', label: t('Greater than or equal') },
    { value: 'lessThan', label: t('Less than') },
    { value: 'lessThanOrEqual', label: t('Less than or equal') },
    { value: 'between', label: t('Between') },
  ],
  date: [
    { value: 'before', label: t('Before') },
    { value: 'after', label: t('After') },
    { value: 'on', label: t('On') },
    { value: 'between', label: t('Between') },
    { value: 'blank', label: t('Is blank') },
  ],
  boolean: [
    { value: 'true', label: t('Is true') },
    { value: 'false', label: t('Is false') },
  ],
  select: [
    { value: 'anyOf', label: t('Is any of') },
    { value: 'noneOf', label: t('Is none of') },
  ],
  relationship: [
    { value: 'has', label: t('Has related records') },
    { value: 'hasNone', label: t('Has no related records') },
    { value: 'minCount', label: t('Has at least') },
    ...text,
  ],
}
