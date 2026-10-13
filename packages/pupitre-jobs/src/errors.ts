import { createError } from '@adonisjs/core/exceptions'

export const E_PUPITRE_JOB_RETRY = createError<[string]>('%s', 'E_PUPITRE_JOB_RETRY', 422)
export const E_PUPITRE_JOB_FORBIDDEN = createError<[string]>('%s', 'E_PUPITRE_JOB_FORBIDDEN', 403)
