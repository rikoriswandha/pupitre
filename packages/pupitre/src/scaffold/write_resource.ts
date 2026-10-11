import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function writeResourceFile(
  path: string,
  contents: string,
  force: boolean
): Promise<boolean> {
  try {
    await access(path)
    if (!force) return false
  } catch {
    // No existing file; create it below.
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents, 'utf8')
  return true
}
