import { test, expect } from '@playwright/experimental-ct-react'
import { AuthShellStory } from './stories/auth_shell.story.js'

test('renders the panel brand, title and accessible auth form in a centered shell', async ({
  mount,
  page,
}) => {
  const story = await mount(<AuthShellStory />)
  await expect(page.getByText('Pupitre Editorial')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('form', { name: 'Sign in form' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await story.unmount()
})
