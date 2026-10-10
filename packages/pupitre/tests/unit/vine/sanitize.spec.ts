import { test } from '@japa/runner'
import { sanitizeHtml } from '../../../src/sanitize.js'

test.group('sanitizeHtml', () => {
  test('removes executable markup, event attributes, and javascript URLs', ({ assert }) => {
    const output = sanitizeHtml(
      '<script>alert(1)</script><p onerror="x">text</p><a href="javascript:alert(1)">bad</a><iframe src="x">frame</iframe>'
    )
    assert.equal(output, '<p>text</p><a>bad</a>')
  })

  test('preserves allowed markup and hardens blank-target links', ({ assert }) => {
    const output = sanitizeHtml(
      '<h2>Title</h2><p><strong>bold</strong> <em>italic</em><a href="https://example.com" target="_blank">link</a></p><ul><li>item</li></ul><img src="https://example.com/a.png" alt="image"><hr>'
    )
    assert.include(output, '<h2>Title</h2>')
    assert.include(output, '<strong>bold</strong>')
    assert.include(
      output,
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a>'
    )
    assert.include(output, '<img src="https://example.com/a.png" alt="image" />')
    assert.include(output, '<hr />')
  })
})
