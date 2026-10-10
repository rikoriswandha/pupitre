import { test } from '@japa/runner'
import { defineCatalog } from '@json-render/core'
import { defineRegistry, useBoundProp } from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { Input } from '@base-ui/react/input'
import { z } from 'zod'
import { mountHarness } from './_harness.js'

const inputProps = z.object({ name: z.string(), value: z.string() })
const strictCatalog = defineCatalog(schema, {
  components: { Text: { props: inputProps, description: 'Strict text input' } },
  actions: {},
})
const CompatibleBaseInput = ({
  props,
  bindings,
}: {
  props: { name: string; value: string }
  bindings?: Record<string, string>
}) => {
  const [value, setValue] = useBoundProp(props.value, bindings?.value)
  return (
    <Input
      aria-label={props.name}
      value={value ?? ''}
      onChange={(event) => setValue(event.currentTarget.value)}
    />
  )
}
const valid = defineRegistry(strictCatalog, { components: { Text: CompatibleBaseInput } })
void valid
const invalid = defineRegistry(strictCatalog, {
  // @ts-expect-error the registry rejects component props that differ from the catalog schema
  components: { Text: (_ctx: { props: { wrong: number } }) => <span>{_ctx.props.wrong}</span> },
})
void invalid

test.group('M0 K4 host registry', () => {
  test('a Base UI component uses useBoundProp through the json-render registry', async ({
    assert,
  }) => {
    const spec = {
      root: 'field',
      state: { data: { title: 'Before' } },
      elements: {
        field: {
          type: 'BaseInput',
          props: { name: 'title', value: { $bindState: '/data/title' } },
        },
      },
    }
    const view = mountHarness(spec)
    try {
      const actualInput = view.container.querySelector(
        '[aria-label="title"]'
      ) as unknown as HTMLInputElement | null
      assert.equal(actualInput?.value, 'Before')
      assert.equal(view.store.store.get('/data/title'), 'Before')
    } finally {
      view.unmount()
    }
  })
})
