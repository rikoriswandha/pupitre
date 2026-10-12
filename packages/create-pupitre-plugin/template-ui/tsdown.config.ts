import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./index.ts', './catalog.ts', './react.tsx'],
  outDir: './build',
  clean: false,
  format: 'esm',
  fixedExtension: false,
  unbundle: true,
  minify: 'dce-only',
  dts: false,
  treeshake: false,
  target: 'esnext',
  platform: 'neutral',
  external: ['react', 'react/jsx-runtime', '@rikology/pupitre', '@rikology/pupitre-react'],
})
