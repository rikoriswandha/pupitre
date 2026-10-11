import { test, expect } from '@playwright/experimental-ct-react'
import { AxeBuilder } from '@axe-core/playwright'
import { FixtureStory } from './stories/catalog.story.js'

const fixtures = [
  'Text',
  'Textarea',
  'Number',
  'Slider',
  'Hidden',
  'Select',
  'Checkbox',
  'CheckboxList',
  'Radio',
  'Toggle',
  'ToggleButtons',
  'Date',
  'DateTime',
  'Time',
  'Color',
  'Tags',
  'KeyValue',
  'RichEditor',
  'FileUpload',
  'Repeater',
  'RepeaterItem',
  'Form',
  'Grid',
  'Section',
  'Fieldset',
  'Tabs',
  'Tab',
  'Group',
  'Split',
  'Placeholder',
  'Html',
  'Divider',
  'Actions',
  'View',
  'Fragment',
  'DataTable',
  'RelationManager',
  'ActionBar',
  'Infolist',
  'TextEntry',
  'IconEntry',
  'ImageEntry',
  'ColorEntry',
  'KeyValueEntry',
  'RepeatableEntry',
  'CodeEntry',
  'BadgeEntry',
]

test.describe('catalog fixtures', () => {
  for (const name of fixtures) {
    test(`${name} renders with no critical accessibility violations`, async ({ mount, page }) => {
      const view = await mount(<FixtureStory name={name} />)
      await expect(view).toBeVisible()
      const results = await new AxeBuilder({ page: page as never }).analyze()
      expect(results.violations.filter((violation) => violation.impact === 'critical')).toEqual([])
      await view.unmount()
    })
  }
})
