import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './index.ts',
    './testing/index.ts',
    './catalog/index.ts',
    './configure.ts',
    './src/types.ts',
    './providers/pupitre_provider.ts',
    './services/main.ts',
    './commands/*.ts',
    './src/discovery/index_admin.ts',
    './src/http/middleware/*.ts',
    './src/drivers/*.ts',
    './stubs/main.ts',
  ],
  outDir: './build',
  clean: false,
  format: 'esm',
  fixedExtension: false,
  unbundle: true,
  minify: 'dce-only',
  dts: false,
  treeshake: false,
  target: 'esnext',
  platform: 'node',
})
