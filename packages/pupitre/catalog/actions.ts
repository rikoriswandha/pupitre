import { z } from 'zod'
import { actionDescriptor } from './wire.js'

export const actions = {
  visit: {
    params: z.object({
      url: z.string(),
      method: z.enum(['get', 'post', 'put', 'patch', 'delete']).optional(),
      data: z.record(z.string(), z.unknown()).optional(),
      preserveScroll: z.boolean().optional(),
    }),
    description: 'Visit a URL through the Inertia router.',
  },
  reload: {
    params: z.object({
      only: z.array(z.string()),
      data: z.record(z.string(), z.unknown()).optional(),
    }),
    description: 'Reload selected Inertia props.',
  },
  submitForm: {
    params: z.object({ formId: z.string().optional() }),
    description: 'Submit the current Pupitre form.',
  },
  openAction: {
    params: z.object({
      action: actionDescriptor,
      ids: z.array(z.union([z.string(), z.number()])).optional(),
    }),
    description: 'Open or execute a declared action.',
  },
  runAction: {
    params: z.object({
      url: z.string(),
      method: z.enum(['get', 'post', 'put', 'patch', 'delete']),
      ids: z.array(z.union([z.string(), z.number()])).optional(),
    }),
    description: 'Run an action endpoint directly.',
  },
  upload: {
    params: z.object({ field: z.string(), files: z.array(z.unknown()) }),
    description: 'Upload files for a field.',
  },
  toast: {
    params: z.object({
      type: z.enum(['success', 'error', 'warning', 'info']),
      title: z.string(),
      body: z.string().optional(),
    }),
    description: 'Display a local notification.',
  },
  copy: { params: z.object({ text: z.string() }), description: 'Copy text to the clipboard.' },
} as const
