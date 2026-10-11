import { useEffect } from 'react'
import { setFetch, setRouter } from '@rikology/pupitre-react'
import { GlobalSearch } from '../../../src/components/GlobalSearch.js'

export function GlobalSearchStory() {
  useEffect(() => {
    const restoreFetch = setFetch(async (input, init) => {
      const request = document.querySelector('[data-testid="search-request"]')
      if (request)
        request.textContent = JSON.stringify({
          url: String(input),
          accept: new Headers(init?.headers).get('Accept'),
        })
      return new Response(
        JSON.stringify({
          groups: [
            {
              resource: 'posts',
              label: 'Posts',
              results: [{ title: 'Field Notes', details: ['draft'], url: '/admin/posts/7' }],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })
    const restoreRouter = setRouter({
      visit: (url: string) => {
        const output = document.querySelector('[data-testid="search-navigation"]')
        if (output) output.textContent = url
      },
      reload: () => {},
      put: () => {},
      post: () => {},
      on: () => () => {},
    } as never)
    return () => {
      restoreFetch()
      restoreRouter()
    }
  }, [])

  return (
    <div className="p-8">
      <GlobalSearch search={{ url: '/admin/_pupitre/search', keyBinding: 'mod+k' }} />
      <output data-testid="search-navigation" />
      <output data-testid="search-request" />
    </div>
  )
}
