# Small wallet demo delivery plan

Updated: 2026-11-08. Revised direction: finish one clear VC/VP walkthrough with the existing walt.id services. Keep the environment and custom code small.

## What we are building

One basic wallet page: **receive a fictional credential → view it → approve sharing → see the real verification result**. Offer/consent views are panels or dialogs within that page. There are no separate issuer/verifier interfaces or visitor accounts.

The runtime target is four containers in one Compose project: Next.js, walt.id Issuer2, Wallet2 and Verifier2. Startup now uses root `compose.yaml` in project `diw-local`, preserving the existing wallet/app volumes and signing configuration. The default app address is `http://localhost:47831`. See the [architecture](../arch/system-design.md).

## Work order

1. **Reuse the completed foundation.** The real integration proof and F1-start-and-resume-demo-session already pass. Do not rebuild them or repeat setup research for ordinary feature work.
2. **Implement the basic wallet flow, one feature at a time.** F2 offer review, F3 accept/decline, F4 credential display, F5 request, F6 consent, F7 actual result. Keep each step small and visible in the same wallet page.
3. **Finish failure/reset behavior.** Apply basic error/cancel handling while implementing each step; complete F8 and F9 without adding a workflow/recovery framework.
4. **Check the complete demo.** Reuse the existing proof and useful tests. Verify the full real exchange, decline/cancel, a service failure, refresh/reset and two-visitor isolation. Use a short keyboard/mobile walkthrough; avoid duplicating the same assertion in several test layers.
5. **Publish the stable demo.** Inspect the existing VPS, reuse its proxy/HTTPS, deploy the small stack to a demo subdomain, and check the public flow.

Each feature uses its existing [guide](../spec/features/README.md). Requirements stay in the [PRD](../spec/prd.md); status/evidence stays in the [checklist](../workitem/implementation.md) and acceptance ledger. Routine changes need no additional planning document, framework or milestone.

MPC, Backup & Recovery, extra scenarios, QR interaction and the portfolio landing page are outside this build. Revisit them only after the basic demo succeeds and the owner requests them.
