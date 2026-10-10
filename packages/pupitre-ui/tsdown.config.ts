import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
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
