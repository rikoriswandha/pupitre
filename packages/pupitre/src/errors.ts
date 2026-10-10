import { createError } from '@adonisjs/core/exceptions'
export const E_PUPITRE_FORBIDDEN = createError(
  'E_PUPITRE_FORBIDDEN',
  'You are not authorized to perform this action',
  403
)
export const E_PUPITRE_INVALID_ACTION_NAME = createError(
  'E_PUPITRE_INVALID_ACTION_NAME',
  'Action names must be non-numeric slugs',
  500
)
export const E_PUPITRE_INVALID_RESOURCE_SLUG = createError(
  'E_PUPITRE_INVALID_RESOURCE_SLUG',
  'Resource slugs must be kebab-case',
  500
)
export const E_PUPITRE_INVALID_PANEL_ID = createError(
  'E_PUPITRE_INVALID_PANEL_ID',
  'Panel identifiers must be slugs',
  500
)
export const E_PUPITRE_UNLIFTABLE_CLOSURE = createError(
  'E_PUPITRE_UNLIFTABLE_CLOSURE',
  'The afterStateUpdated closure cannot be lifted into client state actions',
  500
)
export const E_PUPITRE_INVALID_SPEC = createError(
  'E_PUPITRE_INVALID_SPEC',
  'The schema compiler produced an invalid json-render spec',
  500
)
