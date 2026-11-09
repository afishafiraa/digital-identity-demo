# F6-review-and-approve-sharing — Local verification

Date: 2026-11-09 (JST). Status: **complete locally**. Product presentation/result handling (F7), full failure/reset behavior (F8–F9), shared release acceptance and VPS publication remain pending.

Contract: [F6 guide](../spec/features/F6-review-and-approve-sharing.md), [PRD](../spec/prd.md), [shared acceptance](../spec/acceptance.md), [architecture](../arch/system-design.md) and [TypeScript standards](../arch/typescript-standards.md).

## Result and boundaries

Verifier prepares the existing Harbor Works request. Review sharing in Wallet switches to Wallet (User), focuses the review heading and shows recipient, purpose, actual stored Training Certificate, holder/course/completion date and an explicit **whole credential** disclosure notice. Expandable JSON includes every decoded claim in the supported credential, including issuer DID, credential ID/type, dates, public holder JWK and its public `kid` annotation. The signed credential/issuer signature and a fresh holder proof are explained; no raw signed token, private key, protocol request URL or cookie is returned by the sharing endpoints.

Approve records consent for that exact request/credential. The UI says approval is recorded and **no presentation has been sent**. Cancel closes review, records cancellation and submits nothing. F7 is responsible for presentation dispatch and actual verifier results. No product presentation endpoint or Verified state was introduced by this work.

The server validates the owning cookie/binding, current attempt and reviewed reference. Before approval it rereads wallet storage and the actual unused verifier session, checks the fixed training query and Harbor Works metadata, and compares a canonical SHA-256 digest over credential ID, signed credential (including signed-with-disclosures when present), complete claims and the full authorization request. A changed credential, nonce, audience/request, expired/replaced attempt or missing/used session cannot reuse approval. A fresh explicit review after cancellation has a different review ID. Approval is idempotent; client duplicate clicks dispatch one decision. Lost browser responses use GET reconciliation rather than repeating approval.

The existing SQLite file stores only attempt/review IDs, a digest and reviewing/approved/cancelled state. It does not store another copy of the credential, keys or claims. Mutation requests require the exact configured origin, JSON `{}`, no query parameters and the matching review/attempt header. Browser-supplied wallet IDs, credential IDs, payloads or service URLs are rejected. Cancellation uses only local owned metadata and works while upstream services are offline. The existing transport bounds and a 12-second overall read/approval deadline apply; the browser uses 15 seconds and suppresses stale/aborted results. Initial restore handles development remounts and ignores earlier reads superseded by a user action.

## Actual acceptance evidence

Environment: Node 22.23.2, Next 16.4.5, React 19.3.1, Playwright 1.65.0 Chromium, pinned real walt.id 1.2.1 services. Origin: **http://localhost:47831**. Host browser tests used isolated metadata `.local/F6-sharing-qa-20261109`. This workspace has no Git metadata; source fingerprints below identify the implementation.

| Criterion | Observed result |
|---|---|
| F6-AC01 | Real issuance/request creation led from Verifier to Wallet review. The recipient was Harbor Works, purpose was evidence of completed training, and displayed claims matched the actual selected Wallet2 record. Keyboard focus moved to Review sharing before approval. |
| F6-AC02 | The notice explicitly said the whole credential would be shared. The JSON matched the entire stored `credentialData`, including public `cnf.jwk.kid`; it was not a hand-written claims preview. |
| F6-AC03 | Keyboard cancellation closed the panel and displayed No presentation was sent. Direct real Verifier2 inspection still reported `attempted: false`. Controlled cancellation while services were offline made no upstream calls. |
| F6-AC04 | Double-click approval produced one browser POST, one durable approved reference and an unchanged unused real verifier session. Refresh restored approval. A **test-only integration exchange**, after the UI approval, used the existing Wallet2 presentation fixture against that exact request. Verifier2 reported SUCCESSFUL and its one `presented_credentials.training` record contained exactly the reviewed claims. This validates F6 disclosure compatibility; it does not implement or pass F7's product submission/result UI. |
| F6-AC05 | Controlled expiry before approval produced a stale-review message and no approval control; the real verifier was still unattempted. A new request rejected the prior review ID. Backend checks rejected replacement during upstream reads, changed token/claims/nonce, foreign request identity, lost/used sessions, private-key data and unsupported hidden claims. Current-reference replacement models invalidation; F9's actual reset operation remains unimplemented and unclaimed. |

Focused tests: `test/sharing.test.ts` and `e2e/F6-review-and-approve-sharing.spec.ts`. The existing F1–F5 tests were reused. Real happy-path/whole-disclosure evidence uses real services. Offline, lost browser response, mutated payloads and stale-reference cases are explicitly controlled fault injection.

Commands/results observed:

- `npm run check`: environment validation, typed lint, **56/56 backend tests**, strict typecheck, production build and standalone artifact scan passed before live checks; final rerun after the public-kid and restore fixes is recorded below.
- `DEMO_DATA_DIR=.local/F6-sharing-qa-20261109 npm run test:e2e -- e2e/F6-review-and-approve-sharing.spec.ts`: **2/2 passed**, including the real exact-disclosure fixture.
- `DEMO_DATA_DIR=.local/F6-sharing-qa-20261109 npm run test:e2e`: **17/17 passed**, including F1–F5 regressions and existing brief Wallet2/Issuer2 stop/restart checks using the unified Compose project.
- An additional focused real-review rerun passed **1/1** while capturing the consent panel directly at narrow width after one full-page capture had a transient clipped paint. Subsequent full-page and panel captures showed the content correctly.

Visual inspection: 1280 × 720 desktop and 390 × 844 narrow viewport captures show readable consent text, wrapped claims/identifiers and visible Approve/Cancel controls with no horizontal overflow. Public JSON is expandable; the normal concise review does not require opening it. Keyboard cancellation and heading/status focus were exercised. Private captures: `.local/evidence/F6-review-and-approve-sharing-{desktop,mobile,mobile-panel}.png`.

## Port and Compose migration

The owner requested a port other than 3000. Port **47831** had no listener at selection. Host dev/start, container dev/EXPOSE/health check/publication, APP_ORIGIN defaults/examples/local environment, Playwright, test origins and current setup documentation now use 47831. Alternate container publication remains configurable through `DIW_APP_PORT`. Historical verification records retain the origins used when they ran.

The root Compose project `diw-local` now defines all four services. The existing pinned issuer/wallet/verifier images and configuration files were reused. Legacy `diw-walt` services and the old app binding were stopped, then the three services were started in `diw-local`. The persistent `diw-walt_wallet-data` volume, `diw-local_coordination` volume and `diw-walt_default` network were preserved; no volume deletion, key rotation, database rewrite or VPS change occurred. Legacy stopped containers/configuration remain available for rollback, and must not be started alongside the active services. Issuer/verifier in-memory outstanding exchanges are lost on restart; new offers/requests are required. Persistent wallets/keys/credentials remain on their existing volume.

Root startup is `npm run walt:up` for host-app mode or `docker compose up --build -d` for all containers. Fresh-environment external volume/network creation is documented in [local development](../plan/local-development.md). Test restart commands now target root Compose. Normal rollback is to stop the unified app/services before using the retained legacy service configuration; never run both copies against the shared wallet database.

## Final build and source identification

The final `npm run check` rerun passed: environment validation, strict typed lint, **56/56 backend tests**, strict typecheck, production build and standalone artifact scan. `docker compose build app` succeeded and `docker compose up -d app` restored the normal runtime at port 47831. App image: `sha256:46d88ca7beb46b1c095293623d6e296209b9a9993ae363a9cfb34698e5bedb3c`. Host QA dev was stopped; all active services belong to `diw-local`.

SHA-256 fingerprints:

- `src/server/core/sharing-handler.ts`: `6af6debaca1db14212bf59687e298f5cb2e559a7fc8a771e605253d106087f1b`
- `src/server/core/session.ts`: `e76f271af9d2df5306181ff7780d520d93f9e9485274fdfdfa69da913ed39150`
- `src/lib/sharing.ts`: `98b947aa166244d5b0814fd6440bcf75b00e2179f4f26c4f573a6ba8b4cad489`
- `src/components/sharing-review.tsx`: `a5a0b89a1641b264707ba24863a479f3be271f16c9c9438019e391af9164148e`
- `compose.yaml`: `22a713ccfdd958924d18ce8aa9b72f1b9f6ca903e25af814e6a8f8dc53f204f6`
- `package.json`: `ccd95317802295da13b5798d9e8e33926f4e6a867d192676f52f6911269255f4`

Final container smoke passed on port 47831. Five pre-existing ready wallet bindings from the retained coordination database still resolved to the same Wallet2 wallet IDs after migration. A fresh fictional visitor completed real issuance, whole-credential review, local cancel, fresh review and approval. GET/repeated approval returned the same consent, and credential storage was unchanged. `docker compose ps` showed exactly the app, issuer, verifier and wallet running in the root project; the app published `127.0.0.1:47831->47831/tcp`, with no demo port-3000 binding.
