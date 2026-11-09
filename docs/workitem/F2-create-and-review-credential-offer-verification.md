# F2-create-and-review-credential-offer — Local verification

Date: 2026-11-08. Status: **complete locally**. At this historical F2 checkpoint, F3 acceptance/decline was not implemented; reviewing an offer stores no credential. F3 is now complete: see [F3 evidence](F3-accept-or-decline-credential-verification.md). Public release and full shared acceptance remain pending.

Contract: [F2 guide](../spec/features/F2-create-and-review-credential-offer.md), [shared criteria](../spec/acceptance.md), [small architecture](../arch/system-design.md), [TypeScript rules](../arch/typescript-standards.md).

## Implementation and environment

One Receive button opens an inline review panel on the existing page. Thin `/api/offer` GET/POST handlers use the owning session's ready wallet binding and fixed `training` profile. A single current offer reference/deadline per visitor is stored in the existing SQLite file. No new service, dependency, background job, or configurable workflow was added.

Real services: pinned walt.id 1.2.1 Issuer2/Wallet2/Verifier2 and existing keys/profile/mounts from the [integration record](../../pocs/README.md). Host checks used Node 22.23.2, Next 16.4.5, React 19.3.1 and Chromium via Playwright 1.65.0. Source entry points: `src/server/core/offer-handler.ts`, `src/server/core/session.ts`, `src/lib/offer.ts`, `src/components/credential-offer.tsx`; new tests: `test/offer.test.ts` and `e2e/F2-create-and-review-credential-offer.spec.ts`.

Issuer2 creates an offer with our reserved `sessionId`, `profileId: training`, `authMethod: PRE_AUTHORIZED`, and a 300-second lifetime. Readback uses `GET /issuer2/sessions/{id}`. Availability probing uses `GET /.well-known/openid-credential-issuer/openid4vci`. The first browser run found an incorrect metadata path; correcting it against the pinned source resolved the failure, and all browser checks then passed.

The issuer session contains private signing material and a pre-authorized offer URI. The handler decodes and returns only the reference, expiry, credential label, issuer and offered fictional claims; it never forwards that raw session. The browser supplies neither wallet/profile IDs nor service URLs. Mutations reuse exact-origin/JSON protection, ownership checks, bounded requests and redacted errors.

## Observed results

| Criteria | Evidence and result |
|---|---|
| F2-AC01 | Real Issuer2 offer opened in Chromium. Panel displayed Northstar Learning, Training Certificate, Alex Morgan, Cloud Foundations and 2026-10-15 from the actual issuer session. |
| F2-AC02 | Real Wallet2 credential list remained empty before review, after review, after refresh/reopening, after lost-response retry and after requesting a replacement. No receive endpoint is called by F2. |
| F2-AC03 | Browser check stopped only this project's Issuer2 container: clear check/retry control, unchanged wallet/binding, no reserved offer from the failed availability probe. Restart and retry succeeded. Controlled backend timeout-after-create and browser response loss also had safe check paths. |
| F2-AC04 | Backend concurrent/repeated requests created once. Controlled timeout after upstream creation reconciled the reserved ID with no second creation. Missing upstream state remained pending. Browser double click sent one POST; a deliberately discarded successful response was recovered using the same real offer reference. |
| F2-AC05 | Backend checks covered issuer expiry, local expiry and superseded IDs. Browser expired the local reference using the store helper, refreshed into the expired state, then requested a different real offer for the same empty wallet. Foreign references/query/body inputs were rejected. Actual product reset and reset races remain F9/shared acceptance work. |

Backend fault cases use controlled responses; they are not cryptographic compatibility evidence. The successful browser offer and service-outage path use real local containers. The earlier full protocol proof remains separate from product acceptance.

Commands executed successfully:

```sh
npm run check
npm run test:e2e
npm audit --audit-level=low
```

`check`: environment validation, strict lint, **35 backend tests**, strict type checking, production build and private-artifact inspection passed. Browser suite: **7/7 passed** (four F1 regressions, three F2 checks). Dependency audit: zero vulnerabilities. No TypeScript/lint rules were weakened. Browser tests require host-app mode and temporarily stop/start this project's wallet/issuer services; see [local development](../plan/local-development.md).

Visual inspection of 1280-pixel desktop and 390 × 844 narrow viewport captures found readable claims/controls and no horizontal overflow. Automated keyboard checks confirmed Enter opens the review, the heading receives focus, and Back returns focus to Receive. Private reproducible screenshots are under `.local/evidence/F2-create-and-review-credential-offer-{desktop,mobile,error}.png`.

## Limits and next checkpoint

Issuer session state is temporary. If a dispatched create cannot be confirmed (including issuer restart), keep the known reference pending and check it; do not issue another create before its local five-minute deadline. A process failure between reservation and dispatch has the same bounded pending behavior. There is no automatic retry job. Closing the panel is navigation, not decline.

F1's existing persistent wallet storage is unchanged. F2's offer reference survives reopening the coordination store; this does not promise persistence of issuer sessions. Shared security/isolation/usability checks have F2-scoped coverage only; S-AC01–S-AC06 and S-AC08–S-AC10 retain their complete-demo release status. F3-accept-or-decline-credential is the next implementation checkpoint.

Local container follow-up: `docker compose build app` and `docker compose up -d app` succeeded, preserving volumes. A smoke check inside the rebuilt container created/reused a real offer, found no private issuer fields in the app response, and queried Wallet2 to confirm zero stored credentials. The app is available on `http://127.0.0.1:3000`. No VPS or unrelated containers were changed.

Source fingerprints (SHA-256, verified implementation):

- `src/server/core/offer-handler.ts`: `3d1dd5188288354c34d18699ca4b5220d4905e5162f56c21fef3a78f4eea216b`
- `src/components/credential-offer.tsx`: `6c5e47a93d15b80077a0ab7c75c5a8a506d1ad6296812dd7c8c1ff0ed4e7e10b`
- `package-lock.json`: `f7d186356350c600d978f3d5b52621a0f6076e83e6e581deb1f812637ed8dda1`

Local-address follow-up (2026-11-08): the owner requested localhost. Defaults, local environment, Compose origin and browser test configuration now use **http://localhost:3000**. Full checks and a focused real Chromium start/offer/refresh walkthrough passed after rebuilding the app; strict origin rejection remains intact. See the [origin fix](bugs/F1-start-and-resume-demo-session-localhost-origin.md). Earlier numeric-address results above are historical.

Credential preview follow-up (2026-11-08): refined the existing panel into an issuer-branded credential document and added a native expandable JSON disclosure. JSON contains only the actual offered `issuer_name`, `holder_name`, `completion_date` and `course` values already decoded by the server. The preview explicitly says “Offer · not issued”; no synthetic W3C body, signed token, issuer key or holder proof is displayed. Acceptance remains F3.

Strict lint, type checking, production build and private-artifact inspection passed after this UI change. Rebuilt the localhost app. A focused real Chromium walkthrough opened the JSON with Enter, checked its parsed content against the fictional scenario and API claim values, resumed after refresh, and confirmed no horizontal overflow at 390 × 844. Desktop (1280 × 1000) and mobile captures were generated under `.local/evidence/F2-credential-json-{desktop,mobile}.png`; mobile visual inspection confirmed the document and code remain readable. This was a focused UI check, not a rerun of the entire backend/browser suite. Earlier source fingerprints describe the original F2 baseline, before this refinement.
