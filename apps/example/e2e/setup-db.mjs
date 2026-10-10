import { rmSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const database = resolve(process.env.DB_DATABASE ?? 'tmp/pupitre-e2e.sqlite')
mkdirSync(dirname(database), { recursive: true })
rmSync(database, { force: true })
rmSync(`${database}-journal`, { force: true })

for (const command of ['migration:run', 'db:seed']) {
  const result = spawnSync(process.execPath, ['ace', command], { stdio: 'inherit', env: process.env })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
