# Vercel demo deployment

The owner requested Vercel for the 2026-11-09 presentation. Vercel serves the Next.js UI; `DEMO_BACKEND_URL` configures a before-files rewrite for `/api/*` to the existing Docker app through a temporary Cloudflare tunnel. Session coordination and walt.id wallet/key storage remain on the existing Docker volumes. No walt.id management port is exposed by the tunnel.

This is a temporary presentation deployment: the computer, Docker stack and tunnel must stay running. It is not a durable hosted backend or a completed VPS release gate. The tunnel address changes when restarted; update the Vercel build environment and redeploy. Never configure Vercel to store durable coordination data in a serverless filesystem.

Set `DIW_APP_ORIGIN` to the exact public Vercel origin when starting the Docker app. This enables secure HTTP-only cookies and preserves exact-origin mutation checks. The public origin is the demo entry point during this configuration; localhost is not an additional allowed mutation origin. Stop the tunnel after the presentation, unset `DIW_APP_ORIGIN` and recreate only the app container to return to local development. Keep the volumes.

Source publication excludes private research, environment files, runtime data, dependencies, traces and deployment credentials. Repository and deployment creation were explicitly requested by the owner. F8 and the full shared release acceptance remain pending.
