// Runtime loading is intentional: Ally is an optional peer and must not be resolved for other hosts.
type AllyStatus = {
  redirect(): Promise<void>
  accessDenied(): boolean
  stateMisMatch(): boolean
  hasError(): boolean
  user(): Promise<{
    id: string
    email: string | null
    emailVerificationState?: 'verified' | 'unverified' | 'unsupported'
    name?: string | null
    nickName?: string | null
  }>
}

type AllyService = { use(provider: string): AllyStatus }

/** Resolve Ally lazily so applications that do not use social login need not install the peer. */
export async function allyFromContext(ctx: unknown, provider: string): Promise<AllyStatus> {
  try {
    await import('@adonisjs/ally')
  } catch (error) {
    throw new Error(
      'E_PUPITRE_MISSING_PEER: install and configure @adonisjs/ally to enable social login',
      { cause: error }
    )
  }
  const ally = (ctx as { ally?: AllyService }).ally
  if (!ally || typeof ally.use !== 'function')
    throw new Error('E_PUPITRE_ALLY_NOT_CONFIGURED: configure Ally in the host application')
  return ally.use(provider)
}
