import { useEffect } from 'react'
import { setRouter } from '@rikology/pupitre-react'
import type { JsonRenderSpec } from '@rikology/pupitre/catalog'
import { FixtureStory } from './catalog.story.js'

/** Page wizard starts on step 2; a real form submit reports a step-1 error. */
const wizardWithError: JsonRenderSpec = {
  root: 'form',
  elements: {
    'form': {
      type: 'Form',
      props: { url: '/wizard-422', method: 'post', submitLabel: 'Save' },
      children: ['root'],
    },
    'root': {
      type: 'Wizard',
      props: {
        id: 'l.error',
        steps: [
          { key: 'account', label: 'Account', fields: ['email'] },
          {
            key: 'profile',
            label: 'Profile',
            fields: ['name'],
            description: 'Profile information',
            icon: 'user',
          },
        ],
        step: { $bindState: '/ui/wizard/l.error/step' },
      },
      children: ['account-step', 'profile-step'],
    },
    'account-step': {
      type: 'Step',
      props: { key: 'account', label: 'Account' },
      children: ['email'],
    },
    'profile-step': {
      type: 'Step',
      props: { key: 'profile', label: 'Profile' },
      children: ['name'],
    },
    'email': { type: 'Text', props: { name: 'email', value: { $bindState: '/data/email' } } },
    'name': { type: 'Text', props: { name: 'name', value: { $bindState: '/data/name' } } },
  },
  state: {
    data: { email: '', name: '' },
    ui: { wizard: { 'l.error': { step: 1 } } },
  },
}

export function BuilderStory() {
  return <FixtureStory name="Builder" />
}
export function WizardStory() {
  return <FixtureStory name="Wizard" />
}
export function Wizard422Story() {
  useEffect(
    () =>
      setRouter({
        post: (
          _url: string,
          _data: unknown,
          options: { onError: (errors: Record<string, string>) => void; onFinish: () => void }
        ) => {
          options.onError({ email: 'Required' })
          options.onFinish()
        },
        on: () => () => {},
      } as never),
    []
  )
  return <FixtureStory name="Wizard422" spec={wizardWithError} />
}
