const required = {
  '@rikology/pupitre': [
    'build/commands/commands.json',
    'build/stubs/main.js',
    'build/stubs/config/pupitre.stub',
  ],
  '@rikology/pupitre-ui': [
    'build/src/styles.css',
    'registry/public/registry.json',
    'registry/public/r/text.json',
  ],
  '@rikology/pupitre-shield': [
    'build/commands/commands.json',
    'build/stubs/database/migrations/shield.stub',
  ],
  '@rikology/pupitre-settings': ['build/stubs/database/migrations/settings.stub'],
  '@rikology/create-pupitre-plugin': [
    'build/bin/create.js',
    'template/package.json',
    'template/tests/plugin.spec.ts',
    'template-ui/package.json',
    'template-ui/tests/plugin.spec.ts',
  ],
}

export function checkPackedFiles(name, files) {
  const paths = new Set(files.map((file) => file.path))
  const errors = []
  for (const path of paths) {
    // Template tests are a deliberate part of the generated plugin, not our tests.
    if (
      name === '@rikology/create-pupitre-plugin' &&
      (path.startsWith('template/') || path.startsWith('template-ui/'))
    )
      continue
    if (/(^|\/)(tests?|tmp|coverage|node_modules)\//.test(path))
      errors.push(`${name}: unwanted packed file ${path}`)
    if (
      path.startsWith('registry/') &&
      !path.startsWith('registry/public/') &&
      path !== 'registry/registry.json'
    ) {
      errors.push(`${name}: registry source junk ${path}`)
    }
  }
  for (const path of required[name] ?? []) {
    if (!paths.has(path)) errors.push(`${name}: missing release asset ${path}`)
  }
  return errors
}
