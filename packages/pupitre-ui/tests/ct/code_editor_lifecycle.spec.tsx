import { test, expect } from '@playwright/experimental-ct-react'
import { CodeEditorLifecycleStory } from './stories/code_editor_lifecycle.story.js'

for (const mode of ['disabled', 'loading', 'readOnly'] as const) {
  test(`CodeMirror preserves its view, selection, focus and undo across ${mode}`, async ({
    mount,
    page,
  }) => {
    const view = await mount(<CodeEditorLifecycleStory />)
    const editor = view.locator('.cm-content')
    await expect(editor).toHaveAttribute('contenteditable', 'true')
    const original = await editor.textContent()
    await editor.click()
    await editor.press('ControlOrMeta+End')
    await page.keyboard.insertText(' edited')
    await expect(editor).toContainText(' edited')
    await editor.evaluate((element) => {
      const state = window as Window & { __editorNode?: Element; __editorOffset?: number }
      state.__editorNode = element
      state.__editorOffset = window.getSelection()?.anchorOffset
    })
    await view.update(<CodeEditorLifecycleStory {...{ [mode]: true }} />)
    await expect(editor).toHaveAttribute('contenteditable', 'false')
    if (mode !== 'readOnly') await expect(editor).toHaveAttribute('aria-disabled', 'true')
    else await expect(editor).toHaveAttribute('aria-readonly', 'true')
    await view.update(<CodeEditorLifecycleStory />)
    await expect(editor).toHaveAttribute('contenteditable', 'true')
    await expect(editor).toBeFocused()
    expect(
      await editor.evaluate((element) => {
        const state = window as Window & { __editorNode?: Element; __editorOffset?: number }
        return (
          element === state.__editorNode &&
          window.getSelection()?.anchorOffset === state.__editorOffset
        )
      })
    ).toBe(true)
    await editor.press('ControlOrMeta+z')
    await expect(editor).toHaveText(original ?? '')
  })
}
