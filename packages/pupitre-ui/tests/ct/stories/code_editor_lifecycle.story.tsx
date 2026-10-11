import { createContext, useContext } from 'react'
import type { ComponentProps } from 'react'
import { catalogFixtures } from '@rikology/pupitre/catalog'
import type { PupitrePageProps } from '@rikology/pupitre/catalog'
import { defineRegistry, PupitreRenderer } from '@rikology/pupitre-react'
import { CodeEditor } from '../../../src/components/CodeEditor.js'
import { components } from '../../../src/components.js'

type Access = { disabled?: boolean; readOnly?: boolean; loading?: boolean }
const AccessContext = createContext<Access>({})
function LifecycleEditor(props: ComponentProps<typeof CodeEditor>) {
  const access = useContext(AccessContext)
  return (
    <CodeEditor
      {...props}
      props={{ ...props.props, disabled: access.disabled, readOnly: access.readOnly }}
      loading={access.loading}
    />
  )
}
const registry = defineRegistry({ ...components, CodeEditor: LifecycleEditor })
const fixture = catalogFixtures.CodeEditor
const page: PupitrePageProps['page'] = {
  key: 'ct:editor-lifecycle',
  kind: 'custom',
  title: 'Editor lifecycle',
  breadcrumbs: [],
  spec: fixture,
  state: fixture.state,
  actions: { header: [] },
  catalogVersion: '1.0',
}
const panel: PupitrePageProps['pupitre'] = {
  panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
  user: null,
  tenant: null,
  nav: [],
  flash: [],
  locale: 'en',
  timezone: 'UTC',
}
export function CodeEditorLifecycleStory(access: Access) {
  return (
    <AccessContext.Provider value={access}>
      <PupitreRenderer
        page={page}
        pupitre={panel}
        registry={registry}
        runAction={async () => {}}
        upload={async () => ({})}
        toast={() => {}}
      />
    </AccessContext.Provider>
  )
}
