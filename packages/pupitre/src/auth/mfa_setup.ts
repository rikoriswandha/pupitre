import { randomBytes, createHash } from 'node:crypto'

export async function createTotpEnrollment(issuer: string, email: string) {
  try {
    // Both peers are optional and enrollment is the only path that loads them.
    const otp = await import('otplib')
    const qr = await import('qrcode')
    const secret = otp.generateSecret()
    const uri = otp.generateURI({ issuer, label: email, secret })
    return { secret, qrCode: await qr.toDataURL(uri) }
  } catch (error) {
    throw new Error(
      'E_PUPITRE_MISSING_PEER: MFA enrollment requires the optional "otplib" and "qrcode" dependencies',
      { cause: error }
    )
  }
}

export function makeRecoveryCodes() {
  const codes = Array.from({ length: 10 }, () => randomBytes(8).toString('hex'))
  return {
    codes,
    hashes: codes.map((code) => createHash('sha256').update(code).digest('hex')),
  }
}
