# Changelog

## 0.1.0

- Added CLI and reusable createPlugin API with kebab-case/scoped names, safe directory handling and force overwrites.
- Ship a working navigation plugin template with TypeScript, tsdown and a public-manager Japa integration test.
- Security (WP42): reject parent traversal before path normalization and refuse symlink destinations/output files, including forced writes.
- Generated packages run npm test against published build exports without source-only conditions; regression coverage uses an extracted Pupitre tarball outside the workspace.
