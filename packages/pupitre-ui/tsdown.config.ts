import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/testing.ts',
    './src/components.ts',
    './src/components/*.tsx',
    './src/primitives/index.tsx',
    './src/icons.tsx',
  ],
  outDir: './build/src',
  clean: false,
  format: 'esm',
  fixedExtension: false,
  unbundle: true,
  dts: false,
  treeshake: false,
  target: 'es2022',
  platform: 'neutral',
})
