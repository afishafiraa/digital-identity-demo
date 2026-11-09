# F3-accept-or-decline-credential — Local verification

Date: 2026-11-08. Status: **complete locally**. At this historical F3 checkpoint, F4–F9 remained pending. F4 is now complete: see [F4 evidence](F4-list-and-inspect-stored-credentials-verification.md). Full shared acceptance and public deployment remain unverified.

Contract: [F3 guide](../spec/features/F3-accept-or-decline-credential.md), [shared criteria](../spec/acceptance.md), [architecture](../arch/system-design.md), [TypeScript rules](../arch/typescript-standards.md).

## Implementation

Accept and Decline use the existing review panel. `POST /api/offer/decision` accepts, `DELETE` declines, and `GET` checks a previous operation. Mutations require same-origin JSON `{}` and `X-Demo-Offer` matching the owning session's current review reference. Wallet IDs, credential payloads and service URLs are never taken from browser input.

A small `offer_decisions` table in the existing SQLite file records accepting/accepted/declined and the pre-receive credential IDs. A conditional insert reserves the decision before mutations. The app reuses an existing wallet key or asks Wallet2 to generate the proved P-256 key, then calls the proved `/wallet/{id}/credentials/receive` endpoint. The offer is reconstructed from the actual private issuer-session `credentialOffer` object; it is not exposed to the browser. Receipt is confirmed only when the returned single credential ID is present in Wallet2 storage.

An uncertain receive is never dispatched again. Check reads the same wallet and compares against the persisted baseline. Exactly one newly stored credential confirms receipt. This relies on the current private management boundary: this app's sole credential writer for this visitor wallet is the one reserved receive. New offers cannot replace an unresolved acceptance, even after offer expiry. Completed/declined offers allow a fresh offer; there is no global one-credential limit.

An outage before reservation can be checked and then retried. An interrupted mutation that leaves no stored credential stays unresolved with a bounded error/check response. There is no background job, automatic retry or claim of successful receipt. F9 will supply the product reset path; until then an unresolved operation may require an explicitly new visitor session after session expiry. Decline is local consent refusal and sends no receive call; it does not promise upstream offer revocation.

## Verification

Environment: Node 22.23.2, pinned Next 16.4.5/React 19.3.1, Playwright 1.65.0 Chromium, existing real walt.id 1.2.1 services/profile/keys. Browser runs used host-app mode at `http://localhost:3000` and isolated fictional wallets. Existing F1/F2 outage tests temporarily stopped/restarted only the project's Wallet2/Issuer2 containers.

| Criterion | Observed result |
|---|---|
| F3-AC01 | Real browser acceptance generated/used the wallet holder key, issued and stored exactly one credential. The page returned to the wallet with receipt confirmation only after storage readback. |
| F3-AC02 | Keyboard decline returned focus to Receive, stored zero credentials in an empty wallet, and persisted after refresh. Declining a second offer preserved the previously accepted credential. |
| F3-AC03 | Browser double click sent one accept POST; direct replay of the same review reference left one credential. Controlled concurrent backend accepts dispatched one receive. A later offer had a different reference. |
| F3-AC04 | Browser deliberately discarded a successful real server response, then Check receipt recovered confirmation with one stored credential and one accept POST. Controlled loss of the upstream receive response reconciled actual-shaped wallet metadata after reopening SQLite without another receive. A failure with no stored credential remained accepting/checkable, including after offer expiry. |
| F3-AC05 | Controlled service/malformed-response failures returned redacted errors without receipt success. A controlled replacement of the current offer during receive caused the old response to return 409 and left the new offer undecided. UI requests are aborted on unmount and ignore aborted results. Actual product reset is not implemented or claimed tested here: its end-to-end race coverage remains F9/S-AC04. |

Focused backend checks are fault injection, not cryptographic evidence. The browser accept/decline/storage checks use real services. Source tests: `test/offer-decision.test.ts` and `e2e/F3-accept-or-decline-credential.spec.ts`; prior useful tests remain in place.

Commands:

```sh
npm run check
npm run test:e2e
```

Results: full environment/lint/type/build/artifact checks passed, **41/41 backend tests** passed, and **10/10 browser tests** passed (four F1, three F2, three F3). Initial browser launch and Next dev attempts were blocked by macOS sandbox permissions; rerunning with approved host permissions resolved those runtime restrictions. They were not product passes until rerun.

Keyboard controls and focus return passed in the browser walkthrough. The 390 × 844 narrow viewport had no horizontal overflow; visual inspection found readable offer details and Accept/Decline/Back controls. Private captures: `.local/evidence/F3-accept-or-decline-credential-mobile.png` and `F3-accept-or-decline-credential-received.png`. Credential list/detail is intentionally the next F4 step; the receipt message is not a substitute for F4 acceptance.

F3-scoped ownership, secret-boundary, persistence and usability checks do not complete S-AC01–S-AC06/S-AC08–S-AC10. No VPS work occurred. Source fingerprints below identify the checked source; this workspace has no Git metadata.

- `src/server/core/offer-decision-handler.ts`: `4ba1b22dafa9f1c06451fa6b61fecf041aa9323eb5d74fe879c241b081cfe58c`
- `src/server/core/session.ts`: `7ac4a94636278e7fba91b6cc8a7109a0cef4de5089dd09fbe402aced3c7211ac`
- `src/components/credential-offer.tsx`: `f31978987eb7f744d120d4471445d6cbe2003d7f5a2a633a349f6ddfc779c809`
- `src/lib/offer.ts`: `6d3b3fbe3573b5075b78fe4586607b2be211a2a035b8ef3f3ad1a0df9eda5663`
- `package-lock.json`: `f7d186356350c600d978f3d5b52621a0f6076e83e6e581deb1f812637ed8dda1`

## Local container follow-up

`docker compose build app` and `docker compose up -d app` passed, preserving existing volumes and restoring the original container app mode at `http://localhost:3000`. The Buildx cache write required approved host permissions. Built app image: `sha256:1fe157b563169f95a787ea52f08de54e3930fc1b85759d730f5f66d6babe3088`.

A Node smoke check inside the rebuilt app container used same-origin requests to create an isolated session/wallet, create a real offer, accept it and replay acceptance with the same `X-Demo-Offer`. Both accept responses were confirmed; a direct Wallet2 credential-list read through that session's server-side binding found exactly one stored credential. No service keys, cookies or raw credentials were printed. Host dev was stopped before restoring container mode. No Compose configuration, unrelated services or VPS settings were changed.
