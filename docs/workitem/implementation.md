# Small demo implementation checklist

Updated: 2026-11-09. Follow the [PRD](../spec/prd.md), the current [feature guide](../spec/features/README.md) and the [small architecture](../arch/system-design.md). Implement one feature at a time. Record results in the existing [acceptance ledger](acceptance-results.md); do not create extra process for routine edits.

## Feature progress

| Feature | Status / next deliverable |
|---|---|
| Integration proof | Passed; reuse the [pinned working exchange](../../pocs/README.md) |
| F1-start-and-resume-demo-session | Complete locally; [evidence](F1-start-and-resume-demo-session-verification.md) |
| F2-create-and-review-credential-offer | Complete locally; [evidence](F2-create-and-review-credential-offer-verification.md) |
| F3-accept-or-decline-credential | Complete locally; [evidence](F3-accept-or-decline-credential-verification.md) |
| F4-list-and-inspect-stored-credentials | Complete locally; [evidence](F4-list-and-inspect-stored-credentials-verification.md) |
| F5-create-verification-request | Complete locally; [evidence](F5-create-verification-request-verification.md), [participant tabs](F5-create-verification-request-participant-tabs.md), [identity profiles](F5-create-verification-request-identity-profiles.md) |
| F6-review-and-approve-sharing | Complete locally; [evidence](F6-review-and-approve-sharing-verification.md) |
| F7-present-and-show-verifier-result | Complete locally; [evidence](F7-present-and-show-verifier-result-verification.md) |
| F8-handle-pending-expiry-and-failures | Next: finish shared behavior already applied during each step |
| F9-reset-current-demo | Pending: safely repeat only the current visitor's scenario |

## Keep the work small

- Reuse working F1 and walt.id integration. Add no new service or general recovery/orchestration layer.
- Use one wallet page and small panels. Add only the server calls and state needed by the current feature.
- Keep strict TypeScript, server-side keys, input/ownership checks and existing useful tests. Add focused checks for new behavior, not a large repeated suite for every screen.
- Root Compose now runs the app and three existing services in one project, preserving wallet/app volumes and signing keys. Default app origin is `http://localhost:47831`.

## Complete before publication

- [ ] Complete the real walkthrough and required [acceptance criteria](../spec/acceptance.md), including decline/cancel, service failure, refresh/reset and visitor isolation.
- [ ] Check keyboard/mobile usability and resolve actual defects using the existing bug records.
- [ ] Keep setup reproducible, keys/data persistent, runtime secrets private and public-demo resource limits small and explicit.
- [ ] Inspect the VPS, preserve existing services, reuse reverse proxy/HTTPS and verify the demo subdomain.

F1–F7 are implemented and verified locally. F8–F9 and VPS deployment have not been implemented. Detailed historical setup evidence remains available; it is not an active backlog of extra infrastructure work.
