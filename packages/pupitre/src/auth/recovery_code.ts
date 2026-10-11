import { createHash } from 'node:crypto'
import type { LucidModel } from '@adonisjs/lucid/types/model'

/** Serialize consumption so neither same-code nor different-code submissions can restore a code. */
export async function consumeRecoveryCode(
  Model: LucidModel,
  userId: string,
  attribute: string,
  code: string
): Promise<boolean> {
  const digest = createHash('sha256').update(code).digest('hex')
  return Model.transaction(async (trx) => {
    const user = await Model.query({ client: trx })
      .where(Model.primaryKey, userId)
      .forUpdate()
      .first()
    if (!user) return false
    const stored = user.$attributes[attribute]
    let hashes: unknown
    try {
      hashes = typeof stored === 'string' ? JSON.parse(stored) : stored
    } catch {
      return false
    }
    if (!Array.isArray(hashes) || !hashes.every((hash) => typeof hash === 'string')) return false
    const index = hashes.indexOf(digest)
    if (index < 0) return false
    hashes.splice(index, 1)
    user.useTransaction(trx)
    user.merge({ [attribute]: JSON.stringify(hashes) })
    await user.save()
    return true
  })
}
