import { useState } from 'react'
import type { ShellProps, ToastMessage } from '@rikology/pupitre-react'
import { Shell } from '../../../src/components/Shell.js'
import { Modal } from '../../../src/components/Modal.js'
import { ConfirmDialog } from '../../../src/components/ConfirmDialog.js'
import { Toaster } from '../../../src/components/Toaster.js'
import { UserMenu } from '../../../src/components/UserMenu.js'
import { AuthShell } from '../../../src/components/AuthShell.js'

const panel: ShellProps['panel'] = {
  id: 'ct-shell-a11y',
  path: '/admin',
  brand: { name: 'Editorial' },
  theme: {},
  profileUrl: '/admin/profile',
  logoutUrl: '/admin/logout',
  features: {
    login: true,
    registration: false,
    passwordReset: false,
    emailVerification: false,
    profile: true,
    tenancy: false,
    notifications: false,
    globalSearch: false,
  },
}

export function ShellA11yStory({
  sidebar = 'expanded',
}: {
  sidebar?: 'expanded' | 'collapsed' | 'top-nav'
}) {
  return (
    <Shell
      panel={{ ...panel, theme: { sidebar } }}
      user={null}
      nav={[
        { label: 'Content', collapsible: true, items: [{ label: 'Posts', url: '/admin/posts' }] },
      ]}
      breadcrumbs={[{ label: 'Posts' }]}
      title="Posts"
      headerActions={[]}
      currentUrl="/admin/posts"
      tenant={null}
      tenants={[]}
    >
      <button type="button">Create post</button>
    </Shell>
  )
}

export function UserMenuA11yStory() {
  return (
    <main className="p-8">
      <UserMenu panel={panel} user={{ id: 1, name: 'Editor', email: 'editor@example.test' }} />
    </main>
  )
}

export function DialogA11yStory({
  kind = 'modal',
  slideOver = false,
  untitled = false,
}: {
  kind?: 'modal' | 'confirm'
  slideOver?: boolean
  untitled?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <main>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      {kind === 'confirm' ? (
        <ConfirmDialog
          open={open}
          heading="Delete post?"
          description="This cannot be undone."
          destructive
          onCancel={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        />
      ) : (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          heading={untitled ? undefined : 'Edit post'}
          description="Update the title."
          slideOver={slideOver}
          footer={
            <button type="button" onClick={() => setOpen(false)}>
              Save
            </button>
          }
        >
          <label>
            Title
            <input />
          </label>
        </Modal>
      )}
    </main>
  )
}

export function ToasterA11yStory() {
  const [toasts, setToasts] = useState<ToastMessage[]>([
    {
      id: 'success',
      type: 'success',
      title: 'Post saved',
      body: 'Your changes are saved.',
      actions: [{ label: 'Dismiss saved post' }],
    },
    { id: 'error', type: 'error', title: 'Upload failed', body: 'Choose a different file.' },
    { id: 'warning', type: 'warning', title: 'Session expiring' },
    { id: 'info', type: 'info', title: 'Import queued' },
  ])
  return (
    <main>
      <h1>Notifications</h1>
      <Toaster
        toasts={toasts}
        dismiss={(id) => setToasts((items) => items.filter((item) => item.id !== id))}
      />
    </main>
  )
}

export function AuthPasskeyA11yStory() {
  return (
    <AuthShell
      panel={{ ...panel, features: { ...panel.features, passkeys: true } }}
      title="Sign in"
    >
      <p>Use your passkey to sign in.</p>
    </AuthShell>
  )
}
