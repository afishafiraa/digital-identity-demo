# F5-create-verification-request — Local verification

Date: 2026-11-09 (JST). Status: **complete locally**. F6–F9, full shared acceptance and public deployment remain pending.

Contract: [F5 guide](../spec/features/F5-create-verification-request.md), [shared acceptance](../spec/acceptance.md), [architecture](../arch/system-design.md), [TypeScript standards](../arch/typescript-standards.md).

## Implementation

The existing wallet page has a Try verification panel for Harbor Works. It prepares a real Verifier2 session using the proved holder-bound `dc+sd-jwt` / `urn:diw:training:1` DCQL request and signature policy. It explains that nothing has been sent and sharing approval is the next demo step. There are no consent, presentation or result actions in this feature.

`POST /api/verification` accepts only exact-origin JSON `{}`. It reuses F4's validated owned-wallet read, blocks an empty wallet with Receive sample credential guidance, and reserves one current attempt in the existing SQLite coordination file. Concurrent/repeated requests reuse that reservation; only its creator calls Verifier2. `GET` inspects the current reference without creating anything. Browser IDs, service URLs and query selection are rejected. Protocol URLs, verifier IDs, raw service state and credential contents are not returned by this endpoint; the browser receives only a state, opaque attempt reference and expiry.

The reservation expires after 30 seconds if preparation cannot complete. A completed request has a five-minute application authorization window. This is a local authorization limit, not a claim that Verifier2 deletes the session after five minutes. The selected service's observed retention is much longer. Refresh checks the actual verifier session: missing/lost, used or non-UNUSED requests expire locally; identity/URL mismatch is an error. Session ownership and the current attempt are rechecked after network reads. Failed creation invalidates its reservation and offers explicit retry, leaving credential storage untouched. A lost creation response can leave an unused orphan verifier session because the proved create contract returns a server-generated ID; that orphan is never authorized for presentation. No background retries, cleanup framework or new service was added. Public retention/cleanup remains S-AC10 work.

Reads/creation share a 12-second overall deadline with the existing transport bounds. The browser has a 15-second deadline, aborts unmounted reads, blocks repeated clicks and expires a displayed ready request on its timer. There is no polling or call to Wallet2's presentation endpoint.

## Observed results

Environment: Node 22.23.2, Next 16.4.5, React 19.3.1, Playwright 1.65.0 Chromium, pinned real walt.id 1.2.1 local services and existing fictional profile/keys. Browser origin: `http://localhost:3000`; host app mode for database-aware tests. This workspace has no Git metadata; fingerprints below identify the implementation.

| Criterion | Actual evidence |
|---|---|
| F5-AC01 | Real UI acceptance stored a credential. Keyboard Enter on Try verification prepared an owned request; the direct Verifier2 info record had the exact training VCT/format. Repeated POST returned the same attempt; browser refresh resumed it. Controlled concurrent backend requests dispatched one create. |
| F5-AC02 | A real empty wallet showed Receive sample credential guidance without a verifier request; controlled owned-wallet checks confirmed no create for the empty visitor. |
| F5-AC03 | Actual Verifier2 info reported `UNUSED` and `attempted: false`, including after a replacement attempt. The UI showed no Verified result. The backend fixture rejected any unexpected endpoint and recorded no presentation call. |
| F5-AC04 | Controlled service-offline and lost-create-response failures returned redacted errors; explicit retry prepared a request. Browser-injected 502 showed Retry verification request; before/after real credential API records were identical. Existing bounded transport checks remain applicable. This is controlled fault injection, not a real verifier outage claim. |
| F5-AC05 | A real request was locally expired through the coordination store; refresh showed expiry, and explicit retry created a different attempt. A second isolated real visitor could not select the first attempt and saw no current request. Controlled fixtures rejected stale/foreign completion, replacement during an upstream read, missing upstream sessions, used sessions and mismatched identities. |

Commands and results:

- `npm run check`: environment validation, type-aware lint, **49/49 backend tests**, strict typecheck, production build and standalone artifact scan passed. Initial sandbox build registry access was blocked; the full command was rerun successfully with approved host access.
- `npm run lint && npm run typecheck`: passed after adding the F5 browser tests.
- `npm run test:e2e -- e2e/F5-create-verification-request.spec.ts`: **2/2 passed** against actual local services.
- `npm run test:e2e`: **15/15 passed**, including F1–F4 regressions and their existing brief Wallet2/Issuer2 stop/restart checks.

Desktop 1280 × 720 and narrow 390 × 844 full-page captures were visually inspected: the new panel matches the existing wallet styling, wraps readably and has no horizontal overflow. Keyboard Enter prepared the request and focus moved to its status. Private screenshots: `.local/evidence/F5-create-verification-request-{desktop,mobile}.png`.

F6 consent, F7 actual presentation/results, F8 full failure consistency, F9 reset and release-wide S-AC criteria remain unverified. Nothing here claims those later criteria passed.

Source entry points: `src/server/core/verification-handler.ts`, `src/server/core/session.ts`, `src/server/core/credentials-handler.ts`, `src/lib/verification.ts`, `src/components/verification-request.tsx`, `src/app/api/verification/route.ts`. Focused tests: `test/verification.test.ts`, `e2e/F5-create-verification-request.spec.ts`.

SHA-256 fingerprints:

- `src/server/core/verification-handler.ts`: `85026e21dcfbd12c4a18df4c2b543fcc611e2268bd707cfc36671e170b40ca0d`
- `src/server/core/session.ts`: `271de538363792e18c6fd41f51ab81e2f0ad2f0b4b228566892b61591095a6e6`
- `src/server/core/credentials-handler.ts`: `f2363dfe6cacea99907c059cad4ebce02a690ad2d65f7ffad16f1adb997af0d6`
- `src/components/verification-request.tsx`: `61ba161d58cdb332314c96c6da6fa0a64ef6634927645402348a76085137f0c4`
- `src/lib/verification.ts`: `a0fa0bcd336c0f9d6d246c546c8262ea65fcb07543a9fe6c897a5c1097e43d5e`
- `package-lock.json`: `f7d186356350c600d978f3d5b52621a0f6076e83e6e581deb1f812637ed8dda1`

## Restored local container

`docker compose build app` and `docker compose up -d app` succeeded with approved host access, preserving existing volumes. Image: `sha256:c9cda4cf001ea0f7f583d97de52f98cb8af2c4b5cc93de60e02c601900eaa0ed`. Host dev was stopped; the normal container app serves `http://localhost:3000` again. No Compose configuration or VPS settings changed.

A Node smoke check inside the rebuilt container created an isolated fictional session/wallet, observed missing-credential guidance, accepted one real offer, prepared a real verifier request and read/repeated the same attempt. Before/after credential data remained identical and the response exposed no protocol URL. Health and all smoke assertions passed. This uses the container's existing coordination volume; host-test metadata remains a separate dataset.

## Participant-view refinement

The owner requested explicit Issuer, Wallet (User) and Verifier separation. The [participant-tab record](F5-create-verification-request-participant-tabs.md) describes the revised interface and verification. Wallet opens by default; verification request controls now live in Verifier. Earlier screenshots and UI fingerprints above describe the pre-tab layout.

## Identity-profile refinement

The owner requested wallet/user identity data and an explanation of issuer/verifier identities. The [identity-profile record](F5-create-verification-request-identity-profiles.md) documents the public-data boundary, actual DID/key model, communication explanation and new verification. Earlier UI captures and fingerprints describe earlier layouts.
