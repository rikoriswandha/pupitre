export async function verifyTotp(secret: string, token: string): Promise<boolean> {
  let otp: { verify(input: { secret: string; token: string }): Promise<{ valid: boolean }> }
  try {
    // otplib is optional; keep it out of module loading unless MFA is exercised.
    otp = await import('otplib')
  } catch (error) {
    throw new Error('E_PUPITRE_MISSING_PEER: MFA requires the optional "otplib" dependency', {
      cause: error,
    })
  }
  const result = await otp.verify({ secret, token })
  return result.valid
}
