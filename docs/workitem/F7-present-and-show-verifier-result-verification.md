# F7-present-and-show-verifier-result — Local verification

Date: 2026-11-09 (JST). Status: **complete locally**; final regression/build/container results are recorded below. F8–F9 and release-wide acceptance remain pending.

Contract: [F7 guide](../spec/features/F7-present-and-show-verifier-result.md), [PRD](../spec/prd.md), [shared acceptance](../spec/acceptance.md), [architecture](../arch/system-design.md) and [TypeScript standards](../arch/typescript-standards.md).

## Behavior and boundaries

Wallet (User) retains explicit Approve sharing and Send presentation actions. Sending reuses the approved F6 request/credential digest check and asks the owning Wallet2 wallet to build a holder-bound VP for exactly `selectedCredentialIds: { training: [approvedCredentialId] }`. It uses the pinned service's nested `/credentials/present/build-vp-token` and `/credentials/present/send-response` routes. Keys, signatures, proof generation, request resolution and protocol transmission stay with walt.id. Neither proof tokens nor service request URLs are returned to the browser.

Before dispatch the app rechecks the credential, whole claims, full authorization request, current visitor/attempt, approval and expiry, including a second check after proof building. The existing SQLite coordinator records only the attempt/review reference, a start time and pending/unavailable state before dispatch. A concurrent click or repeated POST can only read that attempt's result. A failed or ambiguous build/send is never blindly repeated; Check verification result reads the original verifier session. A fresh explicit verification request is the path to another attempt.

Only an actual matching Verifier2 `SUCCESSFUL` status, `attempted: true` and `policy_results.overallSuccess: true` can become Verified. Before returning it, the server revalidates the approved digest and requires exactly one presented training credential with the same complete claims as the reviewed credential. It uses the latest confirmed verifier data and rechecks ownership/current-attempt/expiry after reads. Delivery success alone, unknown status, wrong result identity, wrong claims, missing policy data, a foreign session or an earlier attempt cannot produce Verified.

Pending, Verification failed, Result not confirmed and expired/lost request messages are distinct. Rejection uses a fixed safe explanation that request/credential/holder-proof checks did not pass; arbitrary upstream errors/reasons are not displayed. A server operation has a 30-second overall deadline and existing transport byte/per-call bounds. Browser result polling is limited to ten one-second-spaced checks, then offers manual result checking without resending. A pending operation older than 30 seconds returns an inconclusive status; later manual GET can still observe a genuine terminal outcome within the request's authorization window. This is a small foreground check, not a background poller or recovery framework. F8 remains responsible for completing consistent failure handling across all features.

Refresh restores the current result from the real service. F5/F6 readers recognize a locally started presentation instead of expiring it merely because the service is processing/finished. Verifier offers Start new verification; it replaces the current request only on explicit action and clears the prior consent/result in the UI. Old async responses cannot restore the previous result. Actual scenario reset remains F9 and is not claimed here.

## Observed acceptance evidence

Environment: Node 22.23.2, Next 16.4.5, React 19.3.1, Playwright 1.65.0 Chromium, real pinned walt.id 1.2.1 services in `diw-local`. Origin: **http://localhost:47831**. Host browser tests use isolated coordination data `.local/F7-presentation-qa-20261109`. No Git metadata is present in this workspace; fingerprints below identify the final source.

| Criterion | Actual result |
|---|---|
| F7-AC01 | A real visitor received two credentials, reviewed/approved one and sent it from Wallet. Verifier2 returned SUCCESSFUL/overallSuccess true, with exactly one presented training credential matching every approved claim. The UI showed Verified, repeated POST returned the same result, and refresh restored it without another Send control. |
| F7-AC02 | Controlled delayed browser responses after a real exchange showed Verification pending and no Verified heading. Backend fixtures separately mapped processing/delivery-without-terminal-policy-success to pending. These are controlled timing checks, not a claim that a naturally slow real verifier was observed. |
| F7-AC03 | A test-only fetch adapter changed one byte of a **real generated holder-proof signature** immediately before sending through the normal handler. The real Verifier2 rejected it; the handler returned failed and browser refresh showed Verification failed with its safe explanation and no Verified heading. No key/configuration/policy was modified. |
| F7-AC04 | A browser-injected unavailable read showed Result not confirmed, distinct from rejection. Check result then read the actual success without another POST. Backend fixtures exercised unavailable services, failed proof building and a lost send response whose actual-shaped verifier result was reconciled without resending. Controlled failures are not claimed as a live service outage. |
| F7-AC05 | A second real isolated visitor could not select, submit or retrieve the first result and saw no Verified state. Anonymous GET and forged selectors were rejected. Starting a new request cleared the earlier Verified state and approval. Controlled replacement during upstream reads, foreign result identity, expired/unapproved/cancelled consent and changed signed-credential data could not send or mark the current attempt Verified. |

Focused checks: `test/presentation.test.ts` and `e2e/F7-present-and-show-verifier-result.spec.ts`. F1–F6 regression tests are reused. The real proof source is walt.id; no simulated verdict is treated as cryptographic compatibility evidence.

Initial live checks found an adapter path error: build/send were incorrectly placed directly under `/credentials/`, while the pinned route source nests them under `/credentials/present/`. The paths and contract test were corrected before the successful real-service rerun. Initial strict compiler errors were fixed through proper narrowing and removal of obsolete pending-step UI references; no compiler/lint rules or exclusions were weakened.

Commands observed:

- `npm run check`: first complete run passed environment validation, typed lint, **60/60 backend tests**, strict typecheck, production build and artifact scan. Final post-integration rerun appears below.
- `npm run lint && npm run typecheck`: passed after adding browser tests and UI synchronization.
- `DEMO_DATA_DIR=.local/F7-presentation-qa-20261109 npm run test:e2e -- e2e/F7-present-and-show-verifier-result.spec.ts`: **3/3 passed**, with actual successful and rejected verifier outcomes.

Desktop 1280 × 720 and narrow 390 × 844 captures were visually inspected. The inline result has a textual heading/status, wraps readably, and has no horizontal overflow. Public keys/claims remain in their existing expandable displays; proof tokens are not rendered. Private screenshots: `.local/evidence/F7-present-and-show-verifier-result-{desktop,mobile}.png`.

This is local F7 completion evidence, not the three-reset release walkthrough, F8/F9 completion, public deployment, or a general security certification.

## Regression findings and fixes

The first full browser run passed 17/20 checks; three earlier F1/F3 checks failed. A targeted rerun exposed the [F1 outage-test cleanup defect](bugs/F1-start-and-resume-demo-session-test-service-cleanup.md): a nonzero Docker stop result was asserted outside try/finally, leaving Wallet2 stopped. The assertion now remains strict but always reaches restart cleanup. After restoring the service and fixing cleanup, both F1 checks passed in the targeted rerun.

The remaining F3 receipt assertion ran five seconds after a click while the real acceptance API returned 200 in 5.3 seconds after restart. The [receipt-wait fix](bugs/F3-accept-or-decline-credential-test-receipt-wait.md) awaits the actual successful receipt before applying the original UI assertion, within the unchanged test budget. That targeted check then passed. No test timeout, service deadline, resource cap, compiler setting or success assertion was relaxed. All 20 checks therefore had passing results across the full run and targeted reruns; the final complete rerun is recorded below.

The clean complete rerun after those test fixes passed **20/20 browser checks** with unchanged configuration. The verifier tab was then synchronized with the local presentation state so Start new verification appears immediately after sending, without reload, and choosing it clears old consent/result before the new request's network response. A focused real positive/isolation/refresh/new-attempt rerun verifies this final UI refinement. The earlier F1/F3 test defects remain documented rather than being counted as passes from the failed runs.

The final focused positive test passed **1/1**, including the new-attempt button without reload, exact-credential real success, refresh, visitor isolation and clearing the prior result. Earlier API references in the F6 record are historical; product submission is now implemented by F7.

Final source SHA-256 fingerprints:

- `src/server/core/presentation-handler.ts`: `5f7ea4c39c97302434ab87a8eb1bedd023913ea1310a29990e2ff32f9245a340`
- `src/server/core/sharing-handler.ts`: `286eceed3218b6820339f6dbe014178adf25fe162578b3233143869c65eada51`
- `src/server/core/session.ts`: `95508cfd7054ba97e3e8bc9de7f175a4e65682a2fbacb6523922db712deda039`
- `src/components/presentation-result.tsx`: `e1b7626a43014f304022df088a457eee25cfe3195c2b725f2a2df2cff50e4403`
- `src/components/sharing-review.tsx`: `b39ea1283fe1e017cef7d918eba5474dcb2e5ccda628cb467dc991a0612449af`
- `src/components/verification-request.tsx`: `60bc67e3d70bd2bb916791581e355ac788f076ecf15a647db851d516906e0afe`
- `src/lib/presentation.ts`: `3d7109805daab099f57ad4b538cdb081940ceac0461724a2c06c9d1987abcc93`

## Final checks and restored runtime

The final `npm run check` passed environment validation, strict typed lint, **60/60 backend tests**, strict typecheck, production build and private-artifact inspection after all integration/UI/test fixes. The final clean full browser suite passed **20/20**, followed by the **1/1** focused no-refresh/new-attempt UI refinement check described above.

`docker compose build app` succeeded with image `sha256:6a680ba9fb8a5116223f8819209e1b258254cb33032ae9b5eafdb0b06d4d8d73`. Host dev was stopped and the normal container app was restored at `http://localhost:47831`, retaining the existing wallet and coordination volumes. No Compose, dependency, signing-key or VPS changes were needed for F7.

The restored-container smoke passed real issue → accept → review → approve → build/send → verifier success. Repeated POST and GET returned the same verified attempt without another submission; F5/F6 snapshots recognized presentation-started, result responses contained no proof/nonce/protocol URL, and credential storage was unchanged. `docker compose ps` confirmed app/issuer/verifier/wallet running, with the app published only at `127.0.0.1:47831`.
