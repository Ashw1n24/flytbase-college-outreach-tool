import { createFileRoute } from '@tanstack/react-router'
import { spawn } from 'child_process'
import path from 'path'

export const Route = createFileRoute('/api/scrape/twitter/+server')({
  server: {
    handlers: {
      async POST() {
        try {
          const scraperDir = path.resolve(process.cwd(), '..', 'compscraper')
          const child = spawn('node', ['index.js'], {
            cwd: scraperDir,
            env: { ...process.env, SKIP_LINKEDIN: 'true' },
            detached: true,
            stdio: 'ignore',
          })
          child.unref()
          return new Response(
            JSON.stringify({ success: true, message: 'Twitter scraper started in background' }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        } catch (err) {
          const message = (err as Error)?.message || 'Failed to start scraper'
          return new Response(
            JSON.stringify({ success: false, error: message }),
            { status: 500, headers: { 'content-type': 'application/json' } },
          )
        }
      },
    },
  },
})
