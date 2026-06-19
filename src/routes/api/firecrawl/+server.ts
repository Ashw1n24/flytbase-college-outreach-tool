import { createFileRoute } from '@tanstack/react-router'
import Firecrawl from '@mendable/firecrawl-js'

export const Route = createFileRoute('/api/firecrawl/+server')({
  server: {
    handlers: {
      async POST({ request }) {
        const body = await request.json().catch(() => ({}))
        const url = String(body?.url || '').trim()

        if (!url) {
          return new Response(
            JSON.stringify({ success: false, error: 'URL is required' }),
            { status: 400, headers: { 'content-type': 'application/json' } },
          )
        }

        try {
          const key = process.env.FIRECRAWL_API_KEY
          if (!key) {
            return new Response(
              JSON.stringify({ success: false, error: 'Server is missing FIRECRAWL_API_KEY' }),
              { status: 500, headers: { 'content-type': 'application/json' } },
            )
          }

          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 45_000)

          const client = new Firecrawl({ apiKey: key })
          const result = await client.scrape(url, {
            formats: ['markdown'],
            onlyMainContent: true,
          }).catch((err: unknown) => {
            throw err
          })

          clearTimeout(timeout)

          const markdown = (result?.markdown as string | undefined) ?? ''

          if (!markdown) {
            return new Response(
              JSON.stringify({ success: false, error: 'No content extracted from page' }),
              { status: 422, headers: { 'content-type': 'application/json' } },
            )
          }

          return new Response(
            JSON.stringify({ success: true, markdown }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        } catch (err) {
          const message = (err as Error)?.message || 'Scrape failed'
          return new Response(
            JSON.stringify({ success: false, error: message }),
            { status: 500, headers: { 'content-type': 'application/json' } },
          )
        }
      },
    },
  },
})
