import { createFileRoute } from '@tanstack/react-router'

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
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 30_000)

          // Jina AI reader — no API key needed, returns clean markdown
          const res = await fetch(`https://r.jina.ai/${url}`, {
            headers: { Accept: 'text/markdown' },
            signal: controller.signal,
          })

          clearTimeout(timeout)

          if (!res.ok) {
            return new Response(
              JSON.stringify({ success: false, error: `Jina reader returned ${res.status}` }),
              { status: 502, headers: { 'content-type': 'application/json' } },
            )
          }

          const markdown = (await res.text()).trim()

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
