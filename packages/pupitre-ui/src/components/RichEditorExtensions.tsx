import { Node, mergeAttributes, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import Mention from '@tiptap/extension-mention'
import type { MentionNodeAttrs } from '@tiptap/extension-mention'
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import type { Editor, NodeViewProps } from '@tiptap/react'
import { useId, useMemo, useRef } from 'react'
import { Menu } from '@base-ui/react/menu'
import { SpecRenderer, t } from '@rikology/pupitre-react'
import { jsonRenderSpec } from '@rikology/pupitre/catalog'
import { Modal } from './Modal.js'
import { Icon } from '../icons.js'
import {
  Button,
  buttonClasses,
  menuItemClasses,
  popupClasses,
  positionerClasses,
} from '../primitives/index.js'

export type RichChoice = { id: string | number; label: string }
export type RichBlock = {
  id: string
  label: string
  icon?: string
  spec: unknown
  state: Record<string, unknown>
}
export type RichFeatures = {
  mergeTags?: RichChoice[]
  mentions?: { char: string; options?: RichChoice[] }[]
  customBlocks?: RichBlock[]
  optionsUrl?: string
}
export type BlockEdit = { block: RichBlock; position?: number; config: Record<string, unknown> }

let suggestionSequence = 0
function suggestionPopup() {
  let popup: HTMLDivElement | undefined
  let current: SuggestionProps<RichChoice> | undefined
  let selected = 0
  const clearEditor = () => {
    const editor = current?.editor.view.dom
    editor?.removeAttribute('aria-controls')
    editor?.removeAttribute('aria-activedescendant')
  }
  const refresh = () => {
    if (!popup || !current) return
    popup.replaceChildren()
    current.items.forEach((item, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('role', 'option')
      button.setAttribute('aria-selected', String(index === selected))
      button.id = `${popup!.id}-option-${index}`
      button.tabIndex = -1
      button.className = menuItemClasses
      button.textContent = item.label
      button.addEventListener('mousedown', (event) => {
        event.preventDefault()
        current?.command(item)
      })
      popup!.append(button)
    })
    popup.hidden = current.items.length === 0
    const editor = current.editor.view.dom
    if (popup.hidden) clearEditor()
    else {
      editor.setAttribute('aria-controls', popup.id)
      editor.setAttribute('aria-activedescendant', `${popup.id}-option-${selected}`)
    }
    const rect = current.clientRect?.()
    if (rect) {
      popup.style.left = `${rect.left}px`
      popup.style.top = `${rect.bottom + 4}px`
    }
  }
  return {
    onStart(props: SuggestionProps<RichChoice>) {
      current = props
      selected = 0
      popup = document.createElement('div')
      popup.id = `pupitre-suggestions-${++suggestionSequence}`
      popup.setAttribute('data-pupitre-popup', '')
      popup.className = popupClasses
      popup.setAttribute('role', 'listbox')
      popup.setAttribute('aria-label', t('Suggestions'))
      popup.style.position = 'fixed'
      popup.style.zIndex = '120'
      document.body.append(popup)
      refresh()
    },
    onUpdate(props: SuggestionProps<RichChoice>) {
      current = props
      selected = 0
      refresh()
    },
    onKeyDown({ event }: { event: KeyboardEvent }) {
      if (event.key === 'Escape') {
        clearEditor()
        popup?.remove()
        return true
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const length = current?.items.length ?? 0
        selected = length ? (selected + (event.key === 'ArrowDown' ? 1 : length - 1)) % length : 0
        refresh()
        return true
      }
      if (event.key === 'Enter' && current?.items[selected]) {
        current.command(current.items[selected])
        return true
      }
      return false
    },
    onExit() {
      clearEditor()
      popup?.remove()
      popup = undefined
      current = undefined
    },
  }
}

export function richEditorExtensions(features: RichFeatures, editBlock: (edit: BlockEdit) => void) {
  const extensions = []
  if (features.mergeTags?.length) {
    const choices = features.mergeTags
    extensions.push(
      Node.create({
        name: 'mergeTag',
        group: 'inline',
        inline: true,
        atom: true,
        addAttributes: () => ({
          id: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-id'),
            renderHTML: (attrs) => ({ 'data-id': attrs.id }),
          },
        }),
        parseHTML: () => [{ tag: 'span[data-type="mergeTag"]' }],
        renderHTML: ({ node, HTMLAttributes }) => [
          'span',
          mergeAttributes(HTMLAttributes, { 'data-type': 'mergeTag' }),
          `{{ ${node.attrs.id} }}`,
        ],
        addProseMirrorPlugins() {
          return [
            Suggestion({
              editor: this.editor,
              pluginKey: new PluginKey('mergeTags'),
              char: '{{',
              items: ({ query }) =>
                choices.filter((choice) =>
                  choice.label.toLowerCase().includes(query.toLowerCase())
                ),
              command: ({ editor, range, props }) => {
                editor
                  .chain()
                  .focus()
                  .insertContentAt(range, [
                    { type: 'mergeTag', attrs: { id: props.id } },
                    { type: 'text', text: ' ' },
                  ])
                  .run()
              },
              render: suggestionPopup,
            }),
          ]
        },
      })
    )
  }
  if (features.mentions?.length) {
    const providers = features.mentions
    extensions.push(
      Mention.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            char: {
              default: '@',
              parseHTML: (element) => element.getAttribute('data-char'),
              renderHTML: (attrs) => ({ 'data-char': attrs.char }),
            },
          }
        },
        renderHTML({ node, HTMLAttributes }) {
          return [
            'span',
            mergeAttributes(HTMLAttributes, {
              'data-type': 'mention',
              'data-id': node.attrs.id,
              'data-label': node.attrs.label,
              'data-char': node.attrs.char,
            }),
            `${node.attrs.char}${node.attrs.label}`,
          ]
        },
      }).configure({
        suggestions: providers.map((provider, index) => ({
          char: provider.char,
          pluginKey: new PluginKey(`mention-${index}`),
          items: async ({ query }: { query: string }) => {
            if (provider.options)
              return provider.options.filter((choice) =>
                choice.label.toLowerCase().includes(query.toLowerCase())
              )
            if (!features.optionsUrl) return []
            const url = new URL(features.optionsUrl, window.location.origin)
            url.searchParams.set('mention', provider.char)
            url.searchParams.set('q', query)
            const response = await fetch(url, {
              credentials: 'same-origin',
              headers: { Accept: 'application/json' },
            })
            if (!response.ok) return []
            const body: unknown = await response.json()
            if (
              !body ||
              typeof body !== 'object' ||
              !('options' in body) ||
              !Array.isArray(body.options)
            )
              return []
            return body.options.flatMap((option: unknown) => {
              if (
                !option ||
                typeof option !== 'object' ||
                !('value' in option) ||
                !('label' in option) ||
                typeof option.label !== 'string' ||
                (typeof option.value !== 'string' && typeof option.value !== 'number')
              )
                return []
              return [{ id: option.value, label: option.label }]
            })
          },
          command: ({
            editor,
            range,
            props,
          }: {
            editor: Editor
            range: { from: number; to: number }
            props: MentionNodeAttrs
          }) => {
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                {
                  type: 'mention',
                  attrs: { id: props.id, label: props.label, char: provider.char },
                },
                { type: 'text', text: ' ' },
              ])
              .run()
          },
          render: suggestionPopup,
        })),
      })
    )
  }
  if (features.customBlocks?.length) {
    const blocks = features.customBlocks
    function BlockCard({ node, getPos, editor }: NodeViewProps) {
      const block = blocks.find((candidate) => candidate.id === node.attrs.id)
      return (
        <NodeViewWrapper
          className="my-3 rounded-lg border border-border bg-muted p-3"
          contentEditable={false}
        >
          <div className="flex items-center gap-2">
            {block?.icon && <Icon name={block.icon} className="size-4" />}
            <strong>{block?.label ?? node.attrs.id}</strong>
          </div>
          <p className="text-sm text-muted-foreground">
            {Object.values(node.attrs.config)
              .filter((value) => typeof value === 'string')
              .join(' · ')}
          </p>
          {block && (
            <Button
              type="button"
              size="sm"
              disabled={!editor.isEditable}
              onClick={() => editBlock({ block, position: getPos(), config: node.attrs.config })}
            >
              {t('Edit block')}
            </Button>
          )}
        </NodeViewWrapper>
      )
    }
    extensions.push(
      Node.create({
        name: 'customBlock',
        group: 'block',
        atom: true,
        draggable: true,
        addAttributes: () => ({
          id: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-id'),
            renderHTML: (attrs) => ({ 'data-id': attrs.id }),
          },
          config: {
            default: {},
            parseHTML: (element) => {
              try {
                const config: unknown = JSON.parse(element.getAttribute('data-config') ?? '{}')
                return config && typeof config === 'object' && !Array.isArray(config) ? config : {}
              } catch {
                return {}
              }
            },
            renderHTML: (attrs) => ({ 'data-config': JSON.stringify(attrs.config) }),
          },
        }),
        parseHTML: () => [{ tag: 'div[data-type="customBlock"]' }],
        renderHTML: ({ HTMLAttributes }) => [
          'div',
          mergeAttributes(HTMLAttributes, { 'data-type': 'customBlock' }),
        ],
        addNodeView: () => ReactNodeViewRenderer(BlockCard),
      })
    )
  }
  return extensions
}

export function RichEditorTools({
  editor,
  features,
  onEdit,
}: {
  editor: Editor
  features: RichFeatures
  onEdit: (edit: BlockEdit) => void
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border p-1.5">
      {!!features.mergeTags?.length && (
        <Menu.Root>
          <Menu.Trigger
            disabled={!editor.isEditable}
            className={buttonClasses({ size: 'sm', variant: 'ghost' })}
          >
            {t('Merge tags')}
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner className={positionerClasses}>
              <Menu.Popup data-pupitre-popup="" className={popupClasses}>
                {features.mergeTags.map((choice) => (
                  <Menu.Item
                    key={choice.id}
                    className={menuItemClasses}
                    onClick={() =>
                      editor
                        .chain()
                        .focus()
                        .insertContent({ type: 'mergeTag', attrs: { id: choice.id } })
                        .run()
                    }
                  >
                    {choice.label}
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      )}
      {!!features.customBlocks?.length && (
        <Menu.Root>
          <Menu.Trigger
            disabled={!editor.isEditable}
            className={buttonClasses({ size: 'sm', variant: 'ghost' })}
          >
            {t('Insert block')}
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner className={positionerClasses}>
              <Menu.Popup data-pupitre-popup="" className={popupClasses}>
                {features.customBlocks.map((block) => (
                  <Menu.Item
                    key={block.id}
                    className={menuItemClasses}
                    onClick={() => onEdit({ block, config: {} })}
                  >
                    {block.icon && <Icon name={block.icon} className="size-4" />}
                    {block.label}
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      )}
    </div>
  )
}

function scopeBlockBindings(value: unknown, namespace: string, key = ''): unknown {
  if (typeof value === 'string' && ['$bindState', '$state', 'statePath'].includes(key))
    return value.replace(/^\/(data|errors)\//, `/$1/${namespace}/`)
  if (Array.isArray(value)) return value.map((item) => scopeBlockBindings(item, namespace))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([property, item]) => [
        property.replace(/^\/(data|errors)\//, `/$1/${namespace}/`),
        scopeBlockBindings(item, namespace, property),
      ])
    )
  return value
}

export function RichBlockDialog({
  edit,
  editor,
  onClose,
}: {
  edit: BlockEdit
  editor: Editor
  onClose: () => void
}) {
  const initialConfig = { ...(edit.block.state.data as Record<string, unknown>), ...edit.config }
  const config = useRef(initialConfig)
  const namespace = useId()
  const state = { ...edit.block.state, data: { [namespace]: initialConfig }, errors: {} }
  const spec = useMemo(
    () => jsonRenderSpec.parse(scopeBlockBindings(edit.block.spec, namespace)),
    [edit.block.spec, namespace]
  )
  const apply = () => {
    if (edit.position === undefined)
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'customBlock',
          attrs: { id: edit.block.id, config: config.current },
        })
        .run()
    else
      editor
        .chain()
        .focus()
        .setNodeSelection(edit.position)
        .updateAttributes('customBlock', { config: config.current })
        .run()
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      heading={edit.block.label}
      description={t('Configure this content block.')}
      footer={
        <Button type="button" onClick={apply}>
          {t('Apply')}
        </Button>
      }
    >
      <SpecRenderer
        spec={spec}
        state={state}
        embeddedSubmit={apply}
        onStateChange={(next) => {
          if (!next.data || typeof next.data !== 'object' || Array.isArray(next.data)) return
          const data = next.data as Record<string, unknown>
          const value = data[namespace]
          if (value && typeof value === 'object' && !Array.isArray(value))
            config.current = value as Record<string, unknown>
        }}
      />
    </Modal>
  )
}
