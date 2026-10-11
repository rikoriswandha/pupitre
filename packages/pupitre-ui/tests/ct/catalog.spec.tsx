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
  'MarkdownEditor',
  'CodeEditor',
  'RichEditor',
  'FileUpload',
  'Builder',
  'BuilderItem',
  'Repeater',
  'RepeaterItem',
  'Form',
  'Grid',
  'Section',
  'Fieldset',
  'Wizard',
  'Step',
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
  'Widget.Stats',
  'Widget.Chart',
  'Widget.Table',
  'Widget.Timeline',
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
    test(`${name} renders without WCAG 2.1 A/AA violations`, async ({ mount, page }) => {
      const view = await mount(<FixtureStory name={name} />)
      await expect(view).toBeVisible()
      const results = await new AxeBuilder({ page: page as never })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      expect(results.violations).toEqual([])
      await view.unmount()
    })
  }
})
