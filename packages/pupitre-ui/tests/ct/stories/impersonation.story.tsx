import { ImpersonationBanner } from '../../../src/components/ImpersonationBanner.js'

export function ImpersonationStory({ dark = false }: { dark?: boolean }) {
  return (
    <main
      className={
        dark ? 'dark bg-background p-8 text-foreground' : 'bg-background p-8 text-foreground'
      }
    >
      <ImpersonationBanner
        impersonation={{ name: 'Editor', leaveUrl: '/admin/impersonation/leave' }}
      />
    </main>
  )
}
