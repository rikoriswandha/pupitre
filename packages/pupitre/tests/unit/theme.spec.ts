import { test } from '@japa/runner'
import { defineTheme } from '../../src/definition/theme.js'
import { themeVars } from '../../src/http/middleware/share_props.js'

test.group('panel theme', () => {
  test('validates options and compiles shell settings and CSS variables', ({ assert }) => {
    const definition = defineTheme({
      font: { family: 'Inter, sans-serif', url: 'https://fonts.example.test/inter.css' },
      density: 'compact',
      sidebar: 'collapsed',
      sidebarCollapsibleOnDesktop: true,
      contentWidth: '5xl',
      colors: { primary: 'oklch(0.55 0.18 255)' },
      vars: { '--accent': 'teal' },
      stylesheet: '/assets/admin-theme.css',
    })
    const output = themeVars({ theme: definition } as never)
    assert.equal(output.sidebar, 'collapsed')
    assert.equal(output.contentWidth, '5xl')
    assert.equal(output.density, 'compact')
    assert.equal(output.vars?.['--font-sans'], 'Inter, sans-serif')
    assert.equal(output.vars?.['--primary'], 'oklch(0.55 0.18 255)')
    assert.equal(output.vars?.['--accent'], 'teal')
    assert.equal(output.stylesheet, '/assets/admin-theme.css')
  })

  test('rejects CSS injection and unsafe URLs', ({ assert }) => {
    for (const value of ['red; color: blue', 'red}', '<style>', 'url(javascript:alert(1))']) {
      assert.throws(() => defineTheme({ colors: { primary: value } }), /Invalid Pupitre theme/)
    }
    assert.throws(
      () => defineTheme({ vars: { '--background': 'red; } body { display:none' } }),
      /Invalid Pupitre theme/
    )
    assert.throws(() => defineTheme({ stylesheet: 'javascript:alert(1)' }), /Invalid Pupitre theme/)
    assert.throws(
      () => defineTheme({ font: { family: 'Inter', url: 'http://remote.test/font.css' } }),
      /Invalid Pupitre theme/
    )
  })
})
