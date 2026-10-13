import type { JsonRenderSpec } from '@rikology/pupitre/catalog'
import { FixtureStory } from './catalog.story.js'
import { Modal } from '../../../src/components/Modal.js'
const blockSpec: JsonRenderSpec = {
  root: 'form',
  elements: {
    form: {
      type: 'Form',
      props: { method: 'post', url: '', submitLabel: 'Apply', dirtyGuard: false },
      children: ['title', 'tone'],
    },
    title: {
      type: 'Text',
      props: {
        name: 'title',
        label: 'Callout title',
        value: { $bindState: '/data/title' },
        required: true,
      },
    },
    tone: {
      type: 'Select',
      props: {
        name: 'tone',
        label: 'Tone',
        value: { $bindState: '/data/tone' },
        options: [
          { value: 'info', label: 'Information' },
          { value: 'warning', label: 'Warning' },
        ],
      },
    },
  },
}
const spec: JsonRenderSpec = {
  root: 'form',
  elements: {
    form: {
      type: 'Form',
      props: { url: '/save', method: 'post', submitLabel: 'Save', dirtyGuard: false },
      children: ['title', 'body'],
    },
    title: {
      type: 'Text',
      props: { name: 'title', label: 'Post title', value: { $bindState: '/data/title' } },
    },
    body: {
      type: 'RichEditor',
      props: {
        name: 'body',
        label: 'Body',
        value: { $bindState: '/data/body' },
        mergeTags: [
          { id: 'name', label: 'Customer name' },
          { id: 'today', label: 'Today' },
        ],
        mentions: [
          {
            char: '@',
            options: [
              { id: 'alice', label: 'Alice' },
              { id: 'bob', label: 'Bob' },
            ],
          },
          { char: '#', options: [{ id: 'project', label: 'Project' }] },
        ],
        customBlocks: [
          {
            id: 'callout',
            label: 'Callout',
            spec: { $raw: blockSpec },
            state: { data: { title: '', tone: 'info' } },
          },
        ],
      },
    },
  },
  state: { data: { body: '', title: 'Outer post title' }, errors: {} },
}
export function RichEditorPlusStory({
  invalid = false,
  modal = false,
}: {
  invalid?: boolean
  modal?: boolean
}) {
  const content = (
    <FixtureStory
      name="RichEditor"
      spec={spec}
      errors={invalid ? { 'body.blocks.0.title': 'Callout title is required' } : undefined}
    />
  )
  return modal ? (
    <Modal open heading="Edit body" onClose={() => {}}>
      {content}
    </Modal>
  ) : (
    content
  )
}
