# F4-list-and-inspect-stored-credentials — Local verification

Date: 2026-11-08. Status: **complete locally**. F5–F9, full shared acceptance and public deployment remain pending.

Contract: [F4 guide](../spec/features/F4-list-and-inspect-stored-credentials.md), [shared criteria](../spec/acceptance.md), [architecture](../arch/system-design.md), [TypeScript rules](../arch/typescript-standards.md).

## Implementation

The existing wallet page now reads stored credentials on entry and refreshes the list after confirmed acceptance. Native expandable cards show the actual issuer name/identifier, holder, course, completion date, wallet receipt date, issuance, not-before and expiry dates. Dates use explicit UTC. Absent dates say “Not provided”; signature validity and revocation status explicitly remain unchecked in this view. No general Valid/Verified label is inferred from storage or dates.

`GET /api/credentials` uses only the cookie's ready wallet binding. It lists Wallet2 metadata and reads each returned credential ID through that same wallet's detail endpoint. Browser wallet/credential query parameters are rejected. The response permits only the proved `dc+sd-jwt` / `urn:diw:training:1` profile and returns a validated whitelist of display fields. It does not expose raw tokens, disclosures, signatures, holder-key bindings, arbitrary metadata or service credentials. The session/binding is checked again after upstream reads, and responses are private/no-store.

No credential database, new dependency, service, separate details route or workflow was added. Reads have a 12-second overall deadline, the existing transport byte/per-call bounds, and a 100-record response safety bound; exceeding a bound is an error rather than a truncated/empty wallet. A missing, unsupported or malformed detail fails the read explicitly. This is a small-demo read path, not pagination or a credential quota.

The UI distinguishes loading, confirmed empty and read failure. Failure hides the unavailable list and offers Retry wallet read. It never reports an empty wallet because of a failed read. Requests are aborted on unmount/revision change and aborted results are ignored. Only Wallet2 records become cards; offer/acceptance state is not a substitute for stored data.

## Observed acceptance results

Environment: Node 22.23.2, Next 16.4.5, React 19.3.1, Playwright 1.65.0 Chromium, existing real pinned walt.id 1.2.1 services/profile/keys. Host browser checks used `http://localhost:3000` with isolated fictional visitors. Source/configuration fingerprints appear below; this workspace has no Git metadata.

| Criterion | Observed outcome |
|---|---|
| F4-AC01 | A newly provisioned real wallet showed “No credentials received yet” with review/accept guidance and an enabled Receive sample credential control. |
| F4-AC02 | Real acceptance automatically produced one card. The API fields were compared with the owning Wallet2 detail record: issuer, issuer identifier, holder, course, completion date and every timestamp matched. Keyboard Enter opened the native details; the card showed the stored claims and dates. |
| F4-AC03 | A controlled pending browser acceptance showed Check receipt and no received card. A backend fixture with accepting metadata but no Wallet2 credentials also returned an empty list. No synthetic receipt/card was generated from operation state. |
| F4-AC04 | Browser reload read the same wallet and credential ID with identical API claims/dates; reopening the details showed the same stored data. Native details start collapsed on a document reload; expansion is not persisted in client storage. |
| F4-AC05 | Controlled unavailable service and missing detail returned errors rather than `[]`; retry restored the record. A browser-injected 502 displayed unavailable contents/validity and Retry wallet read, with neither an empty-state message nor a card. A controlled absent expiry displayed “Not provided”. The UI explicitly says signature validity and revocation are unchecked. |

Additional focused checks rejected anonymous/foreign-selection requests, duplicate metadata IDs, mismatched detail IDs, malformed claims and unsupported formats. A second isolated real browser visitor saw no first-visitor card; supplying the first credential ID in a query was rejected. Response inspection confirmed raw-token/key/metadata sentinel values were absent.

Real happy-path reads/acceptance/isolation use local services. Pending, absent-date and failure cases are explicitly controlled fault injection; they are not new cryptographic proof or a real service-outage claim. The existing integration gate remains the protocol compatibility evidence. Full reset races, presentation verdicts and release-wide S-AC criteria remain pending under their own feature/shared checks.

Commands executed:

```sh
npm run check
npm run test:e2e -- e2e/F4-list-and-inspect-stored-credentials.spec.ts
npm run test:e2e
```

Results: full environment validation, strict lint, **45/45 backend tests**, strict typecheck, production build and artifact scan passed. Focused F4 Chromium checks **3/3 passed**; full browser suite **13/13 passed** (four F1, three F2, three F3, three F4). No TypeScript/lint configuration was weakened. Host Next dev and Chromium ran with the previously required macOS host permissions. The full browser suite's existing F1/F2 outage checks temporarily stop/restart only this project's wallet/issuer services.

Visual inspection of 1280 × 720 desktop and 390 × 844 narrow full-page captures found readable cards, dates and wrapped issuer identifiers, with no horizontal overflow. Keyboard Enter opened details. Private screenshots: `.local/evidence/F4-list-and-inspect-stored-credentials-{desktop,mobile}.png`.

Source entry points: `src/server/core/credentials-handler.ts`, `src/app/api/credentials/route.ts`, `src/lib/credentials.ts`, `src/components/stored-credentials.tsx`. Focused tests: `test/credentials.test.ts`, `e2e/F4-list-and-inspect-stored-credentials.spec.ts`.

SHA-256 fingerprints:

- `src/server/core/credentials-handler.ts`: `49a9326055da7f0fc687347a67ea5a122b43ba305755659b33e6b0b0b28e7ca1`
- `src/lib/credentials.ts`: `2f7eaa7e8e9b723901c69dc913d6616a4811f5764bd36f9780f02ab771297955`
- `src/components/stored-credentials.tsx`: `857158a86cdbadccc3c5fdc82d895bb8a108399d8d29ff454a38ed938c139129`
- `src/components/credential-offer.tsx`: `5542572206558b44eced7ce51538f9955b918d0ce0e9420b821cf36dd96b00c9`
- `package-lock.json`: `f7d186356350c600d978f3d5b52621a0f6076e83e6e581deb1f812637ed8dda1`

## Local container follow-up

`docker compose build app` and `docker compose up -d app` succeeded, preserving existing volumes and restoring the original container app mode at `http://localhost:3000`. Buildx cache writes required approved host permissions. App image: `sha256:04704d62354f5d83bd0f05ae60a60eac71b6eb08eb0bdda1efcaaa8788a2faed`.

A Node smoke check inside the rebuilt container created an isolated session/wallet, read an empty credential list, accepted one real offer, and read exactly one credential with the stored issuer/holder and issuance/expiry dates. A repeated API read returned identical data. Response inspection found no signed-token, holder-key-binding, signature or `cnf` fields. The app health check passed. Host dev was stopped; no Compose configuration, existing volumes, unrelated services or VPS settings were changed.

## Wallet interface follow-up

The owner requested a more interactive visual design and a fix for the moving side panel. The [alignment/interface fix](bugs/F4-list-and-inspect-stored-credentials-panel-alignment.md) records the redesigned UI, current source fingerprints, full 45-backend/13-browser rerun and desktop/mobile/keyboard measurements. Earlier screenshots/fingerprints above describe the original F4 layout. Product scope remains F1–F4.
