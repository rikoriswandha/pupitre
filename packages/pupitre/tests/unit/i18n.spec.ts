import { test } from '@japa/runner'
import { definePanel } from '../../src/builder/panel.js'
import { definePlugin } from '../../src/builder/plugin.js'
import { resolveConfig } from '../../src/define_config.js'
import {
  getMessages,
  isTranslationMarker,
  resolveLocale,
  resolveTranslations,
  t,
  stripTranslationMarkers,
  captureTranslation,
} from '../../src/i18n.js'
import { formatDate, formatNumber } from '../../src/format/index.js'
import vine, { SimpleMessagesProvider } from '@vinejs/vine'
import { requestMessages } from '../../src/i18n.js'
import { compileValidator } from '../../src/compiler/vine_compiler.js'
import { schema } from '../../src/builder/schema/schema.js'
import type { HttpContext } from '@adonisjs/core/http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { validationMessages } from '../../src/i18n/validation.js'

test.group('localization', () => {
  test('resolves nested lazy messages without translating ordinary record data', ({ assert }) => {
    const messages = { 'Save': 'Simpan', 'Delete {label}?': 'Hapus {label}?', 'Post': 'Kiriman' }
    const input = {
      title: t('Delete {label}?', { label: t('Post') }),
      record: { title: 'Save' },
      items: [t('Save')],
    }
    assert.isTrue(isTranslationMarker(input.title))
    assert.deepEqual(resolveTranslations(input, 'id', messages), {
      title: 'Hapus Kiriman?',
      record: { title: 'Save' },
      items: ['Simpan'],
    })
    assert.equal(t('a', { z: 1, a: 2 }), t('a', { a: 2, z: 1 }))
    assert.isFalse(isTranslationMarker(`${t('Save')} altered`))
  })
  test('plural forms, zero and placeholders use request locale', ({ assert }) => {
    const messages = {
      '{count} items for {name}': {
        zero: 'None for {name}',
        one: 'One for {name}',
        other: '{count} for {name}',
      },
    }
    assert.equal(
      resolveTranslations(t('{count} items for {name}', { count: 0, name: 'Ada' }), 'en', messages),
      'None for Ada'
    )
    assert.equal(
      resolveTranslations(t('{count} items for {name}', { count: 1, name: 'Ada' }), 'en', messages),
      'One for Ada'
    )
    assert.equal(
      resolveTranslations(t('{count} items for {name}', { count: 1, name: 'Ada' }), 'id', messages),
      '1 for Ada'
    )
    assert.equal(
      resolveTranslations(t('Missing {name}', { name: 'Ada' }), 'id', messages),
      'Missing Ada'
    )
  })
  test('fallback locale, declaration-order plugins and host override are per key', ({ assert }) => {
    const panel = definePanel('admin')
      .plugins([
        definePlugin({ name: 'first', messages: { id: { Custom: 'First', Plugin: 'First' } } }),
        definePlugin({ name: 'second', messages: { id: { Custom: 'Second', Plugin: 'Second' } } }),
      ])
      .toDefinition()
    const config = resolveConfig({
      i18n: {
        fallbackLocale: 'fr',
        messages: { fr: { Fallback: 'Secours' }, id: { Custom: 'Host' } },
      },
    })
    const messages = getMessages(config, panel, 'id')
    assert.equal(resolveTranslations(t('Custom'), 'id', messages), 'Host')
    assert.equal(resolveTranslations(t('Plugin'), 'id', messages), 'Second')
    assert.equal(resolveTranslations(t('Fallback'), 'id', messages), 'Secours')
    assert.equal(resolveTranslations(t('Save'), 'id', messages), 'Simpan')
    assert.throws(() =>
      definePlugin({ name: 'bad', messages: { id: { Invalid: { one: 'one' } } } } as never)
    )
  })
  test('locale choice respects preference order and language quality', ({ assert }) => {
    const options = {
      locales: ['en', 'id'],
      defaultLocale: 'en',
      acceptLanguage: 'fr;q=1,id-ID;q=0.9,en;q=0.5',
    }
    assert.equal(resolveLocale({ ...options, user: 'en', session: 'id' }), 'en')
    assert.equal(resolveLocale({ ...options, user: 'fr', session: 'id' }), 'id')
    assert.equal(resolveLocale(options), 'id')
    assert.equal(resolveLocale({ ...options, acceptLanguage: 'id;q=0,en;q=1' }), 'en')
    assert.equal(resolveLocale({ ...options, acceptLanguage: 'fr' }), 'en')
    assert.equal(resolveLocale({}), 'en')
  })
  test('deferred response values resolve after computation', async ({ assert }) => {
    const props = resolveTranslations({ data: () => Promise.resolve({ label: t('Save') }) }, 'id', {
      Save: 'Simpan',
    })
    assert.deepEqual(await props.data(), { label: 'Simpan' })
  })
  test('Indonesian dates and numbers use locale-aware formatting', ({ assert }) => {
    assert.equal(formatNumber(1234.5, { locale: 'id' }, { decimals: 1 }), '1.234,5')
    assert.equal(
      formatDate('2026-10-12', { locale: 'id', timezone: 'UTC' }, 'd MMM yyyy'),
      '12 Okt 2026'
    )
  })
  test('ordinary text cannot forge a signed translation marker', ({ assert }) => {
    const valid = t('Save')
    const forged = valid.replace(/\u{E002E}/u, '\u{E002F}')
    assert.isFalse(isTranslationMarker(forged))
    assert.equal(resolveTranslations(forged, 'id', { Save: 'Simpan' }), 'Save')
  })
  test('stored translation intent survives application-key rotation across workers', async ({
    assert,
  }) => {
    const execute = promisify(execFile)
    const options = [
      '--conditions=@rikology/source',
      '--import=@poppinss/ts-exec',
      '--input-type=module',
      '-e',
    ]
    const captured = await execute(
      process.execPath,
      [
        ...options,
        "import {t,captureTranslation} from './src/i18n.ts'; console.log(JSON.stringify(captureTranslation(t('Delete {label}?',{label:t('Save')}))));",
      ],
      { env: { ...process.env, APP_KEY: 'old-test-app-key' } }
    )
    assert.equal(stripTranslationMarkers(captured.stdout), captured.stdout)
    const restored = await execute(
      process.execPath,
      [
        ...options,
        "import {restoreTranslation,resolveTranslations,getMessages} from './src/i18n.ts'; const stored=JSON.parse(process.argv[1]); console.log(resolveTranslations(restoreTranslation(stored.text,stored.translation),'id',getMessages({},undefined,'id')));",
        captured.stdout.trim(),
      ],
      { env: { ...process.env, APP_KEY: 'rotated-test-app-key' } }
    )
    assert.equal(restored.stdout.trim(), 'Hapus Simpan?')
  })
  test('readable markers preserve English error regexes and strip incomplete framing', ({
    assert,
  }) => {
    const marker = t('Delete {label}?', { label: 'Post' })
    assert.include(new Error(marker).message, 'Delete Post?')
    assert.match(marker, /Delete Post\?/)
    assert.equal(stripTranslationMarkers(marker), 'Delete Post?')
    assert.equal(
      resolveTranslations(marker.slice(0, 20), 'id', { 'Delete {label}?': 'Hapus {label}?' }),
      'Delete Post?'
    )
    assert.equal(captureTranslation(marker).text, 'Delete Post?')
  })
  test('English remains source language with Indonesian fallback and plural forms', ({
    assert,
  }) => {
    const messages = getMessages({ i18n: { fallbackLocale: 'id' } }, undefined, 'en')
    assert.equal(resolveTranslations(t('Save'), 'en', messages), 'Save')
    assert.equal(
      resolveTranslations(t('{count} active query rules', { count: 1 }), 'en', messages),
      '1 active query rule'
    )
  })
  test('regional English uses source plurals and regional overrides, not Indonesian fallback', ({
    assert,
  }) => {
    const messages = getMessages(
      {
        i18n: {
          fallbackLocale: 'id',
          messages: { 'en': { Custom: 'Base' }, 'en-US': { Custom: 'Regional' } },
        },
      },
      undefined,
      'en-US'
    )
    assert.equal(resolveTranslations(t('Save'), 'en-US', messages), 'Save')
    assert.equal(resolveTranslations(t('Custom'), 'en-US', messages), 'Regional')
    assert.equal(resolveTranslations(t('{count} rows', { count: 1 }), 'en-US', messages), '1 row')
  })
  test('plain accessor props resolve without invalid descriptors', ({ assert }) => {
    const props = resolveTranslations(
      {
        get label() {
          return t('Save')
        },
      },
      'id',
      { Save: 'Simpan' }
    )
    assert.equal(props.label, 'Simpan')
  })
  test('repeater validation uses wildcard labels and the rendered headline fallback', async ({
    assert,
  }) => {
    const ctx = { pupitre: { locale: 'id' } } as HttpContext
    requestMessages.set(ctx, getMessages({}, undefined, 'id'))
    const validator = compileValidator([
      schema.text('name').label('Customer name').required().toDefinition(),
      schema
        .repeater('items')
        .schema((fields) => [
          fields.text('name').label('Item name').required(),
          fields.text('category_id').required(),
        ])
        .toDefinition(),
    ])
    try {
      await validator.validate({ items: [{}] }, { ctx, timezone: 'UTC' })
      assert.fail('Expected required errors')
    } catch (error) {
      if (!error || typeof error !== 'object' || !('messages' in error)) throw error
      const errors = error.messages as { field: string; message: string }[]
      assert.equal(
        errors.find((item) => item.field === 'items.0.name')?.message,
        'Item name wajib diisi.'
      )
      assert.equal(
        errors.find((item) => item.field === 'items.0.category_id')?.message,
        'Category id wajib diisi.'
      )
    }
  })
  test('reported date message and resolved field labels survive custom rule names', async ({
    assert,
  }) => {
    const ctx = { pupitre: { locale: 'id' } } as HttpContext
    requestMessages.set(ctx, getMessages({}, undefined, 'id'))
    const validator = compileValidator([
      schema.date('published_at').label(t('Publication date')).toDefinition(),
    ])
    try {
      await validator.validate({ published_at: 'not-a-date' }, { ctx, timezone: 'UTC' })
      assert.fail('Expected invalid date')
    } catch (error) {
      if (!error || typeof error !== 'object' || !('messages' in error)) throw error
      assert.include(
        JSON.stringify(error.messages),
        'Masukkan tanggal yang benar untuk Publication date.'
      )
    }
    const required = compileValidator([
      schema.text('category_id').label(t('Name')).required().toDefinition(),
    ])
    try {
      await required.validate({}, { ctx, timezone: 'UTC' })
      assert.fail('Expected required validation')
    } catch (error) {
      if (!error || typeof error !== 'object' || !('messages' in error)) throw error
      assert.include(JSON.stringify(error.messages), 'Nama wajib diisi.')
    }
  })
  test('unrelated English dictionaries retain host messages and field aliases', async ({
    assert,
  }) => {
    const previous = vine.messagesProvider
    vine.messagesProvider = new SimpleMessagesProvider(
      { required: '{{ field }} is needed by the host' },
      { category_id: 'Category' }
    )
    const ctx = { pupitre: { locale: 'en' } } as HttpContext
    requestMessages.set(ctx, { Settings: 'Settings' })
    try {
      const validator = compileValidator([schema.text('category_id').required().toDefinition()])
      await assert.rejects(() => validator.validate({}, { ctx, timezone: 'UTC' }), /validation/i)
      try {
        await validator.validate({}, { ctx, timezone: 'UTC' })
      } catch (error) {
        if (!error || typeof error !== 'object' || !('messages' in error)) throw error
        assert.include(JSON.stringify(error.messages), 'Category is needed by the host')
      }
    } finally {
      vine.messagesProvider = previous
    }
  })
  test('host Vine integer, consent and duplicate rules receive Indonesian labels and complete sentences', async ({
    assert,
  }) => {
    const ctx = { pupitre: { locale: 'id' } } as HttpContext
    requestMessages.set(ctx, getMessages({}, undefined, 'id'))
    const validator = vine.compile(
      vine.object({
        quantity: vine.number().withoutDecimals(),
        consent: vine.accepted(),
        tags: vine.array(vine.string()).distinct(),
      })
    )
    try {
      await validator.validate(
        { quantity: 1.5, consent: false, tags: ['a', 'a'] },
        {
          messagesProvider: validationMessages(ctx, {
            quantity: 'Jumlah',
            consent: 'Persetujuan',
            tags: 'Tag',
          }),
        }
      )
      assert.fail('Expected validation errors')
    } catch (error) {
      if (!error || typeof error !== 'object' || !('messages' in error)) throw error
      const errors = JSON.stringify(error.messages)
      assert.include(errors, 'Jumlah harus berupa bilangan bulat.')
      assert.include(errors, 'Persetujuan harus disetujui.')
      assert.include(errors, 'Tag berisi nilai duplikat.')
    }
  })
})
