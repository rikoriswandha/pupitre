import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./index.ts', './client/index.ts'],
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
