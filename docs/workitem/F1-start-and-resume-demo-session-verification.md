# F1-start-and-resume-demo-session — Implementation and verification

Updated: 2026-11-08. Status: **complete for local development**. At F1 completion, F2–F9 were unstarted; consult the [ledger](acceptance-results.md) for current progress. No VPS changes were made.

Source: [F1 guide](../spec/features/F1-start-and-resume-demo-session.md), [TypeScript standards](../arch/typescript-standards.md), and the completed [integration gate](../../pocs/README.md).

## Implemented behavior

Start demo establishes an HttpOnly coordination cookie first, then provisions a real walt.id wallet belonging to that session. Wallet IDs and store identities remain server-side. Refresh resumes and checks the same wallet; it does not allocate another wallet or accept a browser-supplied ID.

SQLite stores the session token hash, absolute expiry, random named-store allocation, provisioning phase and real wallet reference. A transactional claim permits one creation request per allocation. The phases are allocated → creating → ready. Named key/credential stores provide an exact correlation identity for reconciliation; matching does not rely on the difference between shared wallet lists.

An ambiguous creation result stays in creating. Retry looks for the wallet with exactly those persisted store identities and attaches it when found. If none is found yet, the UI offers a bounded manual check; it does not issue another create. Pre-creation store failures can retry the same allocation safely. This intentionally prioritizes avoiding duplicate wallets over guessing whether an unknown request completed.

The entry/empty-wallet UI explains fictional data and server-side custody. It covers checking, starting, connected, unavailable/expired, pending and retry states. Expired identities require explicit new-session intent. If the browser has already removed its expired cookie, the server sees an ordinary missing cookie and makes no recovery claim.

The metadata-only DELETE endpoint refuses to discard a wallet binding. Product Reset demo remains F9. Expired wallet mappings are retained for later scoped cleanup; public-release retention/rate controls remain required under S-AC10.

## Acceptance evidence

| Criterion | Result | Evidence |
|---|---|---|
| F1-AC01 | PASS | Real API starts an empty wallet; browser Start demo reaches Wallet connected; separate local container smoke also creates/resumes a real wallet |
| F1-AC02 | PASS | CLI fixture issues a real training credential into the owned wallet; GET, repeated start/provision and Wallet2 restart preserve its wallet ID and credential metadata. Browser refresh resumes the same persisted ID. Coordination reopening and app-container restart also preserve ownership. |
| F1-AC03 | PASS | Independent API/browser cookie contexts resolve distinct wallets. Foreign wallet-ID payloads, missing cookies and foreign origins are rejected. Snapshot responses contain no underlying wallet ID or other visitor's data. |
| F1-AC04 | PASS | Controlled tests and a real-service response-loss injection reconcile a completed create with no second create. A real browser observes an error while Wallet2 is stopped, then resumes the same allocation after it restarts. |

Verified source/configuration snapshot SHA256: `5d492a4bf335565a9b45d7eebce3c478cbd58c0c50524ca93302622a9e17381c`. Per-file hashes are retained in the private manifest.

## Reproducible checks

Use [local setup](../plan/local-development.md). In host-app mode at `http://127.0.0.1:3000`:

```sh
npm run check
npm run proof:integration
npm run test:f1
npm run test:e2e
npm audit
```

Observed on Node.js 22.23.2:

- `npm run check`: PASS — environment validation, strict type-aware lint, **29 backend tests**, strict TypeScript, production build and private-artifact scan.
- `npm run proof:integration`: PASS — actual issuer → wallet acceptance → presentation → verifier success using pinned walt.id 1.2.1.
- `npm run test:f1`: PASS — real API, accepted-credential resume, session isolation, injected lost creation response, Wallet2 restart and coordination reopening.
- `npm run test:e2e`: **4/4 PASS** in Chromium. The final UI copy/status-color adjustment was followed by a passing focused start/refresh/layout rerun.
- Desktop (1280px) and narrow (390px) screenshots were visually reviewed; keyboard start/skip-link/focus and narrow-screen overflow checks pass.
- `npm audit` and production-only audit: **0 reported vulnerabilities**. Toolchain versions are pinned; minimatch 11.0.5 overrides an affected transitive matcher and passed the lint/build/test checks.
- Docker app build with `npm ci`: PASS. App-container smoke tests on the private network: readiness, real wallet start/resume, and app restart with the original cookie PASS. The final local app runs on port 3000.

Private evidence lives in `.local/evidence/`: timestamped integration/F1 JSON, screenshots, and `source-manifest.json` with per-file hashes and a source/configuration snapshot digest. Playwright failures/traces are under ignored `.local/playwright-results/`; earlier sandbox launch failures are not counted as app acceptance failures or passes.

## Boundaries and remaining release work

Only F1 is enabled. The sample-credential action stays disabled until its own feature implementation. CLI fixtures are prerequisites/test data, not additional product feature completion.

Runtime blockers from earlier checkpoints were resolved after restarting the CLI with suitable access. Native macOS file watching, Chromium launch/cache installation and Docker Buildx cache writes required approved execution outside the restricted sandbox; no approval-bypass flag or compiler/lint suppression was introduced.

Shared criteria still cover the future complete journey. This record provides F1-scoped security/usability/persistence evidence, not a public-release security certification or proof that F2–F9 work. Online origin/routing, cleanup/quotas, full-journey cancellation/reset/failure checks, and nonce-based CSP hardening remain before publication. Full historical Codex-assisted project time was not consistently measured; no complete build-duration claim is made.

Next feature: **F2 — Create and review a credential offer**, in a separate implementation step.
