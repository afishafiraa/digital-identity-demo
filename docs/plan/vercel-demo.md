# Vercel demo deployment

Public URL: **https://digital-identity-demo.vercel.app**. GitHub: **https://github.com/afishafiraa/digital-idenity-demo**. Vercel project: `digital-identity-demo-afi` under `shafira-putri-anandas-projects`. The owner changed the production domain before the reset deployment; the backend now permits the exact updated origin.

The owner requested Vercel for the 2026-11-09 presentation. Vercel serves the Next.js UI; `DEMO_BACKEND_URL` configures a before-files rewrite for `/api/*` to the existing Docker app through a temporary Cloudflare tunnel. Session coordination and walt.id wallet/key storage remain on the existing Docker volumes. No walt.id management port is exposed by the tunnel.

This is a temporary presentation deployment: the computer, Docker stack and tunnel must stay running. It is not a durable hosted backend or a completed VPS release gate. The tunnel address changes when restarted; update the Vercel build environment and redeploy. Never configure Vercel to store durable coordination data in a serverless filesystem.

Set `DIW_APP_ORIGIN` to the exact public Vercel origin when starting the Docker app. This enables secure HTTP-only cookies and preserves exact-origin mutation checks. The public origin is the demo entry point during this configuration; localhost is not an additional allowed mutation origin. Stop the tunnel after the presentation, unset `DIW_APP_ORIGIN` and recreate only the app container to return to local development. Keep the volumes.

Source publication excludes private research, environment files, runtime data, dependencies, traces and deployment credentials. Repository and deployment creation were explicitly requested by the owner. F8 and the full shared release acceptance remain pending.

The current tunnel process must remain running. To recreate it, run `cloudflared tunnel --url http://127.0.0.1:47831 --no-autoupdate`, save the new HTTPS origin as Vercel's production `DEMO_BACKEND_URL`, then redeploy. Configure the backend with `DIW_APP_ORIGIN=https://digital-identity-demo.vercel.app docker compose up -d --no-deps app`. Both `APP_ORIGIN` and `DEMO_BACKEND_URL` are saved in Vercel's production environment. For source changes, push GitHub and deploy with `vercel --prod`; these deployments were made explicitly through the CLI, with no automatic Git deployment configured.

Reset is available on the wallet page; see [behavior, verification and retained-data limitations](../workitem/F9-reset-current-demo-verification.md). Stop the tunnel to withdraw public access to the persistent API. No VPS or existing portfolio site was changed.
