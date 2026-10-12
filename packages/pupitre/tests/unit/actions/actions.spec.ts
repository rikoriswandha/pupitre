import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import { action, actions, schema } from '../../../index.js'
import {
  compileActionDescriptor,
  compileActionForm,
  executeAction,
} from '../../../src/compiler/action_compiler.js'
import { E_PUPITRE_FORBIDDEN } from '../../../src/errors.js'
import { actionDescriptor, actionFormResponse } from '../../../catalog/wire.js'
import { resolveTranslations, t } from '../../../src/i18n.js'

const ctx = {} as HttpContext
const routes = {
  list: '/posts',
  create: '/posts/create',
  edit: (id: string | number) => `/posts/${id}/edit`,
  view: (id: string | number) => `/posts/${id}`,
  destroy: (id: string | number) => `/posts/${id}`,
}
const record = { id: 42 } as unknown as LucidRow
const descriptor = (baseUrl = '/posts') => ({
  baseUrl,
  record,
  recordKey: 42,
  ctx,
  authorize: async () => true,
  routes,
})

test.group('action compiler', () => {
  test('compiles link, direct, confirm, and form action kinds', async ({ assert }) => {
    const link = await compileActionDescriptor(
      action('external').url('/help').definition,
      descriptor()
    )
    const direct = await compileActionDescriptor(action('publish').definition, descriptor())
    const confirm = await compileActionDescriptor(
      action('remove').requiresConfirmation().definition,
      descriptor()
    )
    const form = await compileActionDescriptor(
      action('schedule').form([schema.dateTime('publishedAt')]).definition,
      descriptor()
    )
    assert.equal(link.kind, 'link')
    assert.equal(link.method, 'get')
    assert.equal(direct.kind, 'direct')
    assert.equal(direct.method, 'post')
    assert.equal(confirm.kind, 'confirm')
    assert.equal(form.kind, 'form')
  })

  test('disables actions whose URLs use unsafe schemes', async ({ assert }) => {
    for (const unsafeUrl of ['javascript:alert(1)', 'data:text/html,unsafe']) {
      const result = await compileActionDescriptor(
        action('unsafe')
          .url(() => unsafeUrl)
          .openUrlInNewTab().definition,
        descriptor()
      )
      assert.isFalse(result.enabled)
    }
  })
  test('preserves action presentation metadata in the catalog descriptor', async ({ assert }) => {
    const compiled = await compileActionDescriptor(
      action('edit')
        .variant('iconButton')
        .color('primary')
        .icon('pencil')
        .openUrlInNewTab()
        .keyBindings(['mod+s'])
        .group('Record')
        .modalHeading('Edit post')
        .modalIcon('pencil')
        .modalWidth('lg')
        .slideOver()
        .modalSubmitLabel('Save').definition,
      descriptor()
    )
    assert.isTrue(actionDescriptor.safeParse(compiled).success)
    assert.equal(compiled.variant, 'iconButton')
    assert.equal(compiled.openInNewTab, true)
    assert.deepEqual(compiled.keyBindings, ['mod+s'])
    assert.equal(compiled.group, 'Record')
    assert.equal(compiled.modal?.icon, 'pencil')
    assert.equal(compiled.modal?.width, 'lg')
  })

  test('uses built-in resource routes and context-specific custom action URLs', async ({
    assert,
  }) => {
    const create = await compileActionDescriptor(actions.create().definition, descriptor())
    const edit = await compileActionDescriptor(actions.edit().definition, descriptor())
    const view = await compileActionDescriptor(actions.view().definition, descriptor())
    const remove = await compileActionDescriptor(actions.delete().definition, {
      ...descriptor(),
      resourceLabel: 'Post',
    })
    const header = await compileActionDescriptor(
      { ...action('export').definition, context: 'header' },
      { ...descriptor(), record: undefined, recordKey: undefined }
    )
    const bulk = await compileActionDescriptor(actions.bulk('archive').definition, {
      ...descriptor(),
      record: undefined,
      recordKey: undefined,
    })
    const bulkDelete = await compileActionDescriptor(actions.bulk('delete').definition, {
      ...descriptor(),
      record: undefined,
      recordKey: undefined,
      resourceLabel: 'Posts',
    })
    const row = await compileActionDescriptor(action('publish').definition, descriptor())
    assert.equal(create.url, '/posts/create')
    assert.equal(edit.url, '/posts/42/edit')
    assert.equal(view.url, '/posts/42')
    assert.equal(remove.url, '/posts/42')
    assert.equal(remove.method, 'delete')
    assert.equal(remove.kind, 'confirm')
    assert.equal(remove.confirm?.destructive, true)
    assert.equal(resolveTranslations(remove.confirm?.heading, 'en'), 'Delete Post?')
    assert.equal(
      resolveTranslations(remove.confirm?.description, 'en'),
      'This action cannot be undone.'
    )
    assert.equal(resolveTranslations(remove.confirm?.submitLabel, 'en'), 'Delete')
    assert.equal(header.url, '/posts/actions/export')
    assert.equal(bulk.url, '/posts/actions/archive')
    assert.equal(bulk.kind, 'direct')
    assert.equal(bulkDelete.kind, 'confirm')
    assert.equal(resolveTranslations(bulkDelete.confirm?.heading, 'en'), 'Delete Posts?')
    assert.equal(resolveTranslations(bulkDelete.confirm?.submitLabel, 'en'), 'Delete')
    assert.equal(row.url, '/posts/42/actions/publish')
  })

  test('splits camelCase built-in names into words for labels', async ({ assert }) => {
    const bulkForceDelete = await compileActionDescriptor(actions.bulkForceDelete().definition, {
      ...descriptor(),
      record: undefined,
      recordKey: undefined,
    })
    assert.equal(resolveTranslations(bulkForceDelete.label, 'en'), 'Force Delete')
    assert.equal(resolveTranslations(bulkForceDelete.confirm?.submitLabel, 'en'), 'Force Delete')
  })

  test('resolves action confirmation interpolation while preserving unmarked record labels', async ({
    assert,
  }) => {
    const messages = {
      'Delete': 'Hapus',
      'Delete {label}?': 'Hapus {label}?',
      'Post': 'Artikel',
    }
    const marked = await compileActionDescriptor(actions.delete().definition, {
      ...descriptor(),
      resourceLabel: t('Post'),
    })
    const raw = await compileActionDescriptor(actions.delete().definition, {
      ...descriptor(),
      resourceLabel: 'Post',
    })
    assert.equal(resolveTranslations(marked, 'id', messages).confirm?.heading, 'Hapus Artikel?')
    assert.equal(resolveTranslations(raw, 'id', messages).confirm?.heading, 'Hapus Post?')
    assert.equal(resolveTranslations(marked, 'id', messages).confirm?.submitLabel, 'Hapus')
    assert.deepEqual(resolveTranslations(marked, 'id', messages).url, marked.url)
  })

  test('combines visibility and authorization in enabled', async ({ assert }) => {
    const hidden = await compileActionDescriptor(
      action('hidden').visible(() => false).definition,
      descriptor()
    )
    const denied = await compileActionDescriptor(action('denied').can('publish').definition, {
      ...descriptor(),
      authorize: async () => false,
    })
    const visible = await compileActionDescriptor(action('visible').definition, descriptor())
    assert.isFalse(hidden.enabled)
    assert.isFalse(denied.enabled)
    assert.isTrue(visible.enabled)
  })
  test('maps built-in actions to resource abilities', async ({ assert }) => {
    const abilities: string[] = []
    const authorize = async (ability: string) => {
      abilities.push(ability)
      return true
    }
    const options = { ...descriptor(), authorize }
    await compileActionDescriptor(actions.create().definition, options)
    await compileActionDescriptor(actions.edit().definition, options)
    await compileActionDescriptor(actions.view().definition, options)
    await compileActionDescriptor(actions.delete().definition, options)
    await compileActionDescriptor(actions.bulk('delete').definition, {
      ...options,
      record: undefined,
      recordKey: undefined,
    })
    assert.deepEqual(abilities, ['create', 'update', 'view', 'delete', 'delete'])
  })

  test('compiles action form spec and fill state into the wire response', async ({ assert }) => {
    const formAction = action('edit-meta')
      .form([schema.text('title').required()])
      .fillForm(() => ({ title: 'Draft' })).definition
    const result = await compileActionForm(formAction, {
      locale: 'en',
      timezone: 'UTC',
      ctx,
      url: '/posts/actions/edit-meta',
    })
    assert.isTrue(actionFormResponse.safeParse(result).success)
    assert.equal((result.state.data as Record<string, unknown>).title, 'Draft')
  })
})

test.group('action execution', () => {
  test('rejects direct invocation when authorization fails', async ({ assert }) => {
    const denied = action('publish')
      .can('publish')
      .handle(() => {}).definition
    let error: { code?: string; status?: number } | undefined
    try {
      await executeAction(denied, {
        ctx,
        data: {},
        currentUrl: '/posts',
        listUrl: '/posts',
        authorize: async () => false,
      })
    } catch (caught) {
      error = caught as { code?: string; status?: number }
    }
    assert.instanceOf(error, E_PUPITRE_FORBIDDEN)
    assert.equal(error?.status, 403)
  })

  test('runs handlers with validated data, accumulates notifications, and applies after results', async ({
    assert,
  }) => {
    let received: Record<string, unknown> | undefined
    const execute = action('schedule')
      .form([schema.dateTime('publishedAt').required()])
      .handle(({ data, notify }) => {
        received = data
        notify?.success('Scheduled').body('Post is scheduled').send()
      })
      .after(({ redirect }) => redirect.to('/posts/42')).definition
    const result = await executeAction(execute, {
      ctx,
      data: { publishedAt: '2026-06-01T12:00:00.000Z' },
      currentUrl: '/posts',
      listUrl: '/posts',
      authorize: async () => true,
    })
    assert.isTrue(DateTime.isDateTime(received?.publishedAt))
    assert.deepEqual(result.flash, [
      { type: 'success', title: 'Scheduled', body: 'Post is scheduled' },
    ])
    assert.equal(result.redirect, '/posts/42')
  })

  test('returns reload and deselect instructions for refresh.table', async ({ assert }) => {
    const refreshAction = action('archive')
      .deselectAfter()
      .after(({ refresh }) => refresh?.table()).definition
    const result = await executeAction(refreshAction, {
      ctx,
      data: {},
      currentUrl: '/posts?page=2',
      listUrl: '/posts',
      authorize: async () => true,
    })
    assert.deepEqual(result, { flash: [], reload: true, deselect: true })
  })

  test('passes all selected rows to bulk handlers', async ({ assert }) => {
    let received: readonly unknown[] | undefined
    const bulk = actions.bulk('archive').handle(({ records }) => {
      received = records
    }).definition
    const rows = [{ id: 1 }, { id: 2 }] as unknown as LucidRow[]
    await executeAction(bulk, {
      ctx,
      records: rows,
      data: {},
      currentUrl: '/posts',
      listUrl: '/posts',
      authorize: async () => true,
    })
    assert.deepEqual(received, rows)
  })

  test('rejects invalid form data with Vine field paths', async ({ assert }) => {
    const formAction = action('edit-title').form([schema.text('title').required()]).definition
    let error: { messages?: Array<{ field: string }>; status?: number } | undefined
    try {
      await executeAction(formAction, {
        ctx,
        data: {},
        currentUrl: '/posts',
        listUrl: '/posts',
        authorize: async () => true,
      })
    } catch (caught) {
      error = caught as { messages?: Array<{ field: string }>; status?: number }
    }
    assert.equal(error?.status, 422)
    assert.isTrue(error?.messages?.some((message) => message.field === 'title'))
  })
})
