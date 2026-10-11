import { useState } from 'react'
import type { ReactNode } from 'react'
import { PageActionsContext } from '../../../../pupitre-react/src/runtime.js'
import type { ActionDescriptor } from '@rikology/pupitre/catalog'
import { ImportModal } from '../../../src/components/ImportModal.js'

const action: ActionDescriptor = {
  name: 'import',
  label: 'Import',
  kind: 'direct',
  url: '/admin/posts/import?action=import',
  method: 'post',
  enabled: true,
}

function ImportRuntime({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<string[]>([])
  return (
    <PageActionsContext.Provider
      value={{
        runAction: async () => {},
        toast: (message) => setMessages((current) => [...current, message.title]),
      }}
    >
      {children}
      {messages.map((message, index) => (
        <p role="status" key={index}>
          {message}
        </p>
      ))}
    </PageActionsContext.Provider>
  )
}

export function ImportModalStory() {
  return (
    <ImportRuntime>
      <ImportModal open action={action} onClose={() => {}} onComplete={() => {}} />
    </ImportRuntime>
  )
}
export function ImportModalDialogStory() {
  const [open, setOpen] = useState(false)
  const [completed, setCompleted] = useState(0)
  return (
    <ImportRuntime>
      <button type="button" onClick={() => setOpen(true)}>
        Open import
      </button>
      <ImportModal
        open={open}
        action={action}
        onClose={() => setOpen(false)}
        onComplete={() => setCompleted((current) => current + 1)}
      />
      <output aria-label="Completed imports">{completed}</output>
    </ImportRuntime>
  )
}
