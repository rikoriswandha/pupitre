import { createError } from '@adonisjs/core/exceptions'
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
