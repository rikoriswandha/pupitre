import { test } from '@japa/runner'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, mkdtemp, readFile, rm, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPlugin, pluginNames } from '../index.js'

const execute = promisify(execFile)

test('writes all template files, replaces tokens and normalizes names', async ({ assert }) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-create-plugin-'))
  try {
    const files = await createPlugin({ name: '@acme/pupitre-demo-tools', directory: root })
    assert.lengthOf(files, 10)
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    assert.equal(manifest.name, '@acme/pupitre-demo-tools')
    assert.property(manifest.peerDependencies, '@rikology/pupitre')
    const source = await readFile(join(root, 'index.ts'), 'utf8')
    assert.include(source, 'function demoTools(options: PluginOptions = {})')
    assert.include(source, "name: 'demo-tools'")
    for (const file of files) assert.notMatch(await readFile(file, 'utf8'), /\{\{[^}]+\}\}/)
    assert.include(files, join(root, '.gitignore'))
    assert.equal(pluginNames('default').camelName, 'defaultPlugin')
    assert.equal(pluginNames('constructor').camelName, 'constructor')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects invalid names before writing files', async ({ assert }) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-create-invalid-'))
  try {
    for (const name of [
      'Bad Name',
      '../escape',
      'demo_tools',
      '2demo',
      '@BAD/demo',
      'demo-',
      'pupitre-',
    ]) {
      await assert.rejects(
        () => createPlugin({ name, directory: join(root, 'target') }),
        /kebab-case/
      )
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('refuses non-empty directories unless forced and preserves unrelated files', async ({
  assert,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-create-existing-'))
  try {
    await writeFile(join(root, 'keep.txt'), 'keep')
    await assert.rejects(() => createPlugin({ name: 'demo', directory: root }), /not empty/)
    await createPlugin({ name: 'demo', directory: root, force: true })
    await writeFile(join(root, 'index.ts'), 'custom source')
    await assert.rejects(() => createPlugin({ name: 'demo', directory: root }), /not empty/)
    await createPlugin({ name: 'demo', directory: root, force: true })
    assert.include(await readFile(join(root, 'index.ts'), 'utf8'), 'function demo(')
    assert.equal(await readFile(join(root, 'keep.txt'), 'utf8'), 'keep')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('generated package npm test resolves Pupitre from its published build only', async ({
  assert,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-plugin-published-'))
  try {
    await createPlugin({ name: 'demo', directory: root })
    const modules = new URL('../../../node_modules/', import.meta.url).pathname
    const dependencies = join(root, 'node_modules')
    await mkdir(join(dependencies, '@rikology'), { recursive: true })
    const { stdout } = await execute(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', root],
      { cwd: new URL('../../pupitre/', import.meta.url).pathname }
    )
    const tarball = JSON.parse(stdout)[0].filename
    await execute('tar', ['-xzf', join(root, tarball), '-C', root])
    await symlink(modules, join(root, 'package/node_modules'))
    await symlink(join(root, 'package'), join(dependencies, '@rikology/pupitre'))
    for (const name of [
      '@adonisjs',
      '@japa',
      '@poppinss',
      '@types',
      'reflect-metadata',
      'tsdown',
      'typescript',
    ])
      await symlink(join(modules, name), join(dependencies, name))
    const result = await execute('npm', ['test'], {
      cwd: root,
      env: { ...process.env, NODE_OPTIONS: '' },
    }).catch((error: Error & { stdout?: string; stderr?: string }) => {
      throw new Error(`${error.message}\n${error.stdout ?? ''}\n${error.stderr ?? ''}`)
    })
    assert.include(result.stdout, '1 passed')
    assert.notInclude(result.stdout.toLowerCase(), 'failed')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects directory traversal and forced symlink escapes', async ({ assert }) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-create-security-'))
  try {
    for (const directory of [join(root, 'nested') + '/../escape', 'nested\\..\\escape', ''])
      await assert.rejects(() => createPlugin({ name: 'demo', directory }), /traversal/)
    const outside = join(root, 'outside')
    await mkdir(outside)
    const target = join(root, 'target')
    await symlink(outside, target)
    await assert.rejects(
      () => createPlugin({ name: 'demo', directory: target, force: true }),
      /symlink/
    )
    const safe = join(root, 'safe')
    await mkdir(safe)
    const secret = join(outside, 'secret')
    await writeFile(secret, 'do not overwrite')
    await symlink(secret, join(safe, 'index.ts'))
    await assert.rejects(
      () => createPlugin({ name: 'demo', directory: safe, force: true }),
      /symlink/
    )
    assert.equal(await readFile(secret, 'utf8'), 'do not overwrite')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('keeps the server-only template unchanged when UI is not requested', async ({ assert }) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-create-default-'))
  try {
    const plain = join(root, 'plain')
    const explicit = join(root, 'explicit')
    const files = await createPlugin({ name: 'demo', directory: plain })
    const explicitFiles = await createPlugin({
      name: 'demo',
      directory: explicit,
      withUi: false,
    })
    assert.deepEqual(
      explicitFiles.map((file) => file.slice(explicit.length)),
      files.map((file) => file.slice(plain.length))
    )
    for (const file of files) {
      const relative = file.slice(plain.length + 1)
      const template = relative === '.gitignore' ? 'gitignore.stub' : relative
      const original = await readFile(new URL(`../template/${template}`, import.meta.url), 'utf8')
      let expected = original
      for (const [token, value] of Object.entries(pluginNames('demo')))
        expected = expected.replaceAll(`{{${token}}}`, value).replaceAll(`__${token}__`, value)
      assert.equal(await readFile(file, 'utf8'), expected)
      assert.equal(await readFile(join(explicit, relative), 'utf8'), expected)
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('creates UI subpaths and replaces every template token', async ({ assert }) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-create-ui-'))
  try {
    const files = await createPlugin({
      name: '@acme/pupitre-star-rating',
      directory: root,
      withUi: true,
    })
    assert.lengthOf(files, 12)
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    assert.deepEqual(Object.keys(manifest.exports), ['.', './catalog', './react'])
    for (const dependency of ['@rikology/pupitre-react', '@vinejs/vine', 'react', 'zod'])
      assert.property(manifest.peerDependencies, dependency)
    assert.property(manifest.devDependencies, '@types/react')
    for (const file of files)
      assert.notMatch(
        await readFile(file, 'utf8'),
        /\{\{[^}]+\}\}|__(?:name|camelName|packageName)__/
      )
    assert.include(files, join(root, 'catalog.ts'))
    assert.include(files, join(root, 'react.tsx'))
    await writeFile(join(root, 'catalog.ts'), 'custom catalog')
    await assert.rejects(
      () => createPlugin({ name: 'demo', directory: root, withUi: true }),
      /not empty/
    )
    await createPlugin({ name: 'demo', directory: root, withUi: true, force: true })
    assert.include(await readFile(join(root, 'catalog.ts'), 'utf8'), 'defineCatalogExtension')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('CLI accepts --with-ui and generates the requested UI package', async ({ assert }) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-create-cli-ui-'))
  try {
    const { stdout } = await execute(process.execPath, [
      '--import=@poppinss/ts-exec',
      new URL('../bin/create.ts', import.meta.url).pathname,
      'demo',
      '--dir',
      root,
      '--with-ui',
    ])
    assert.include(stdout, 'Created pupitre-demo')
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    assert.isTrue(Object.hasOwn(manifest.exports, './react'))
    assert.include(await readFile(join(root, 'index.ts'), 'utf8'), 'function demo()')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

for (const pluginName of [
  'demo',
  'rating',
  'pupitre-rating',
  '@acme/pupitre-rating',
  'rating-catalog',
  'define-field',
  'define',
  'define-plugin',
  'vine',
  'app',
  'test',
]) {
  test(`generated UI package ${pluginName} builds and validates against published Pupitre exports`, async ({
    assert,
  }) => {
    const root = await mkdtemp(join(tmpdir(), 'pupitre-plugin-ui-published-'))
    try {
      await createPlugin({ name: pluginName, directory: root, withUi: true })
      const modules = new URL('../../../node_modules/', import.meta.url).pathname
      const dependencies = join(root, 'node_modules')
      await mkdir(join(dependencies, '@rikology'), { recursive: true })
      for (const name of ['pupitre', 'pupitre-react']) {
        const destination = join(root, name)
        await mkdir(destination)
        const { stdout } = await execute(
          'npm',
          ['pack', '--ignore-scripts', '--json', '--pack-destination', destination],
          { cwd: new URL(`../../${name}/`, import.meta.url).pathname }
        )
        await execute('tar', [
          '-xzf',
          join(destination, JSON.parse(stdout)[0].filename),
          '-C',
          destination,
        ])
        await symlink(modules, join(destination, 'package/node_modules'))
        await symlink(join(destination, 'package'), join(dependencies, '@rikology', name))
      }
      for (const name of [
        '@adonisjs',
        '@japa',
        '@poppinss',
        '@types',
        '@vinejs',
        'react',
        'reflect-metadata',
        'tsdown',
        'typescript',
        'zod',
      ])
        await symlink(join(modules, name), join(dependencies, name))
      for (const command of [['run', 'build'], ['test']]) {
        const result = await execute('npm', command, {
          cwd: root,
          env: { ...process.env, NODE_OPTIONS: '' },
        }).catch((error: Error & { stdout?: string; stderr?: string }) => {
          throw new Error(`${error.message}\n${error.stdout ?? ''}\n${error.stderr ?? ''}`)
        })
        if (command[0] === 'test') assert.include(result.stdout, '2 passed')
      }
      await execute(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import '${pluginNames(pluginName).packageName}'; import '${pluginNames(pluginName).packageName}/catalog'; import '${pluginNames(pluginName).packageName}/react'`,
        ],
        { cwd: root, env: { ...process.env, NODE_OPTIONS: '' } }
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
}

test('CLI instructions invoke the actual plugin factory for UI import collisions', async ({
  assert,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-cli-factory-'))
  try {
    const modules = new URL('../../../node_modules/', import.meta.url).pathname
    for (const name of ['rating', 'rating-catalog', 'define-field', 'define-plugin', 'vine']) {
      const directory = join(root, name)
      const { stdout } = await execute(process.execPath, [
        '--import=@poppinss/ts-exec',
        new URL('../bin/create.ts', import.meta.url).pathname,
        name,
        '--dir',
        directory,
        '--with-ui',
      ])
      const factory = /Add (\w+)\(\) to your panel/.exec(stdout)?.[1]
      assert.isString(factory)
      await symlink(modules, join(directory, 'node_modules'))
      const result = await execute(process.execPath, [
        '--conditions=@rikology/source',
        '--import=@poppinss/ts-exec',
        '--input-type=module',
        '-e',
        `const module = await import(${JSON.stringify(join(directory, 'index.ts'))}); const plugin = module[${JSON.stringify(factory)}](); if (plugin.name !== ${JSON.stringify(name)} || !plugin.catalog?.length) throw new Error('Printed factory did not create the plugin')`,
      ])
      assert.equal(result.stderr, '')
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('two generated UI plugins coexist and validate independently in one host', async ({
  assert,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-two-ui-'))
  try {
    const modules = new URL('../../../node_modules/', import.meta.url).pathname
    for (const name of ['first-score', 'second-score']) {
      const directory = join(root, name)
      await createPlugin({ name, directory, withUi: true })
      await symlink(modules, join(directory, 'node_modules'))
    }
    const result = await execute(
      process.execPath,
      [
        '--conditions=@rikology/source',
        '--import=@poppinss/ts-exec',
        '--input-type=module',
        '-e',
        `
      import { compileValidator } from '@rikology/pupitre';
      import { mergeCatalogExtensions } from '@rikology/pupitre/catalog';
      const first = await import(${JSON.stringify(join(root, 'first-score/index.ts'))});
      const second = await import(${JSON.stringify(join(root, 'second-score/index.ts'))});
      const merged = mergeCatalogExtensions([...first.firstScore().catalog, ...second.secondScore().catalog]);
      if (!merged.components.FirstScoreInput || !merged.components.SecondScoreInput) throw new Error('Components collided');
      const validator = compileValidator([first.firstScoreField('first').stars(7).required().toDefinition(), second.secondScoreField('second').stars(2).required().toDefinition()]);
      const result = await validator.validate({first: 7, second: 2}, {timezone: 'UTC'});
      if (result.first !== 7 || result.second !== 2) throw new Error('Validation changed');
      let rejected = false;
      try { await validator.validate({first: 7, second: 3}, {timezone: 'UTC'}); } catch { rejected = true; }
      if (!rejected) throw new Error('Plugin validator lost its own limit');
    `,
      ],
      { cwd: new URL('../', import.meta.url).pathname }
    )
    assert.equal(result.stderr, '')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('npm rejects UI template peers on 1.0 and accepts the extension release on 1.1', async ({
  assert,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-ui-peer-contract-'))
  try {
    await createPlugin({ name: 'peer-proof', directory: root, withUi: true })
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    delete manifest.devDependencies
    manifest.peerDependencies = Object.fromEntries(
      Object.entries(manifest.peerDependencies).filter(([name]) => name.startsWith('@rikology/'))
    )
    await writeFile(join(root, 'package.json'), JSON.stringify(manifest))
    for (const version of ['1.0.9', '1.1.0']) {
      for (const name of ['pupitre', 'pupitre-react']) {
        const directory = join(root, 'node_modules/@rikology', name)
        await mkdir(directory, { recursive: true })
        await writeFile(
          join(directory, 'package.json'),
          JSON.stringify({ name: `@rikology/${name}`, version })
        )
      }
      if (version === '1.0.9') {
        const failure = await execute('npm', ['ls', '--depth=0', '--json'], { cwd: root }).catch(
          (error: Error & { stdout: string }) => error
        )
        assert.instanceOf(failure, Error)
        assert.match((failure as Error & { stdout: string }).stdout, /invalid.*pupitre/)
        assert.match((failure as Error & { stdout: string }).stdout, /invalid.*pupitre-react/)
      } else {
        const result = await execute('npm', ['ls', '--depth=0', '--json'], { cwd: root })
        assert.notInclude(result.stdout, 'invalid')
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
