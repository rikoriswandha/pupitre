import { defineConfig } from 'tsdown'
export default defineConfig({
  entry: ['./index.ts'],
  outDir: './build',
  clean: false,
  format: 'esm',
  fixedExtension: false,
  unbundle: true,
  dts: false,
  treeshake: false,
  target: 'esnext',
  platform: 'node',
})
