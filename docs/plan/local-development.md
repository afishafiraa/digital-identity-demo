# Local development

Status: **F1–F7 implemented and verified locally**; later product features remain pending. The [F1 completion record](../workitem/F1-start-and-resume-demo-session-verification.md), [F2 verification](../workitem/F2-create-and-review-credential-offer-verification.md) and [F3 verification](../workitem/F3-accept-or-decline-credential-verification.md) own earlier acceptance evidence. See [F4 verification](../workitem/F4-list-and-inspect-stored-credentials-verification.md) for stored-card checks. The [integration record](../../pocs/README.md) owns versions/profile and protocol proof.

## Prerequisites

Node.js 22.23.2, npm 10+, Docker with a reachable daemon, and package/image registry access. Keep the pinned Node version: this project uses its experimental built-in SQLite and TypeScript stripping APIs.

All four services now use the root `compose.yaml` and project `diw-local`. The previous `infra/walt.compose.yaml` is retained only for migration/rollback; do not start both projects together. The existing wallet volume `diw-walt_wallet-data`, app volume `diw-local_coordination`, dedicated network `diw-walt_default` and issuer configuration/keys are reused.

For a **fresh Docker environment only**, create the dedicated external storage/network before first startup (skip this if they already exist):

```sh
docker volume create diw-walt_wallet-data
docker network create diw-walt_default
```

## Host app with container services

From the project root:

```sh
npm ci
cp .env.example .env.local
chmod 600 .env.local
npm run preflight
npm run walt:setup
npm run walt:up
npm run proof:integration
npm run check
npm run dev
```

Wait for service startup before the proof; retry the proof after startup if a service was not ready. Open **http://localhost:47831**. Start demo provisions a real isolated wallet. Receive sample credential opens a real offer for review. Accept stores one real credential after confirmation; Decline receives none. Stored credential cards expand inline to show actual claims and dates. Wallet (User) is the default tab. Issuer identifies Northstar Learning and can create a sample offer that opens wallet review. In the Verifier tab, Try verification prepares a real Harbor Works request for the stored training credential without sending a presentation. Review sharing in Wallet opens the whole-credential consent panel; Approve records request-specific consent and Cancel sends nothing. After approval, Send presentation uses only that reviewed credential and shows the actual verifier result. See [F7 evidence](../workitem/F7-present-and-show-verifier-result-verification.md). See [F6 evidence](../workitem/F6-review-and-approve-sharing-verification.md). See [F5 verification](../workitem/F5-create-verification-request-verification.md). See [F3 verification](../workitem/F3-accept-or-decline-credential-verification.md).

`.env.example` includes loopback service URLs for host mode. The browser origin must match `APP_ORIGIN` exactly, including host and port. Restart after environment changes. `localhost` and `127.0.0.1` are different origins. The local browser address is `http://localhost:47831`; both the host dev script and Docker port publication stay on loopback. Numeric service URLs and Docker health probes remain internal loopback addresses.

The actual lockfile exists. Use `npm ci` for reproducible installs; change dependencies deliberately and review the updated lockfile. `npm run check` includes strict lint/type checks, backend tests, build and artifact inspection. Run `npm audit` before release. See the [TypeScript rules](../arch/typescript-standards.md).

## Fully containerized local app

After `npm run walt:setup` and `npm run walt:up`:

```sh
docker compose up --build -d
```

Stop a host app already using port 47831 first. The app joins the dedicated `diw-walt_default` network and uses internal service names. It is an unprivileged development container, verified to create/resume a real wallet and preserve session state across restart. Production deployment configuration remains separate work.

To use another local port:

```sh
DIW_APP_PORT=47832 docker compose up -d app
```

The configured app origin follows that port. To return to host-app development, run `docker compose stop app`, then `npm run dev`; keep the service containers running.

Container mode stores coordination metadata in a named volume; host mode uses `.local/coordination.sqlite`. These are separate datasets. Do not switch modes expecting a cookie from one dataset to authorize the other. The explicit new-session path handles unavailable identities.

## Feature verification

With the **host app** running and local services ready:

```sh
npm run test:f1
npx playwright install chromium
npm run test:e2e
```

The live F1/browser checks inspect the host coordination database, so run them against host-app mode. They use isolated fictional fixtures. `test:f1` restarts only the project's Wallet2 container; the browser failure tests temporarily stop/start Wallet2 and Issuer2. Do not run these checks alongside visitor walkthroughs. Browser caches, native file watching and Buildx cache writes may require approval in restricted agent sessions; these exact restrictions were observed during verification.

## Current API boundary

| Method and route | Behavior |
|---|---|
| `GET /api/health/live` | Process can serve requests |
| `GET /api/health/ready` | Wallet service probe; 200 identifies implemented F1 readiness, not completion of the future full journey |
| `GET /api/session` | Current owned snapshot only; never creates a wallet |
| `POST /api/session` | Create/resume coordination cookie with same-origin JSON `{}`; unavailable cookies return 409 unless explicit new-session intent is supplied |
| `POST /api/session/wallet` | Provision/reconcile/resume the cookie's real wallet; accepts only `{}`; no browser wallet IDs/URLs; pending is 202 |
| `GET /api/profile` | Read the owning wallet ID/key references and public issuer/holder identity from a stored credential; no key export, private keys or browser selectors |
| `GET /api/credentials` | Read the owning wallet’s stored credential claims/dates; no query IDs; failure is unavailable rather than empty |
| `GET /api/offer` | Read only the owning current offer; no creation; missing upstream state is pending, local/service expiry is explicit |
| `POST /api/offer` | Create/reconcile the fixed training offer; accepts only same-origin JSON `{}`; never receives a credential; pending is 202 |
| `POST /api/offer/decision` | Accept the owning current offer once; same-origin JSON `{}` plus matching `X-Demo-Offer` review reference |
| `DELETE /api/offer/decision` | Decline the same owned reference without receiving; same mutation protection |
| `GET /api/offer/decision` | Check a reserved acceptance against wallet storage; never repeats receive |
| `GET /api/verification` | Read the owning current request; unused real-service state only; no creation or presentation |
| `POST /api/verification` | Check stored training credential and create/reuse the owning real verifier request; exact-origin JSON `{}`; no browser IDs/URLs or presentation |
| `GET /api/sharing` | Restore only the current owned review/approval; validate live credential/request before returning consent |
| `POST /api/sharing` | Review the current request with same-origin JSON `{}` and `X-Demo-Verification`; show actual whole claims |
| `POST /api/sharing/decision` | Approve matching `X-Demo-Review` once after rechecking the exact credential/request digest; no presentation dispatch |
| `DELETE /api/sharing/decision` | Cancel the reviewed reference locally, including while services are offline; sends no presentation |
| `POST /api/presentation` | Send the current approved credential once with same-origin JSON `{}` and `X-Demo-Review`; build/send only through the owning Wallet2 wallet |
| `GET /api/presentation` | Inspect the current owned verifier result without resending; Verified requires correlated success, policy success and exact approved claims |
| `DELETE /api/session` | Metadata-only revoke; refuses sessions with wallet bindings. Product reset remains F9. |

Snapshots distinguish not-started, expired, awaiting-integration (metadata-only), provisioning, and active. The expired-session UI uses `X-Demo-New-Session: true` with exact-origin protection to request a fresh coordination session while retaining the old mapping for scoped cleanup. It never claims recovery.

## Data and stopping services

Generated service keys/configuration stay in ignored `.local/walt-config/` with restrictive permissions. Wallet data persists in `diw-walt_wallet-data`; container app metadata persists in `diw-local_coordination`. Standard walt.id keys are custodial. No client source/data or personal documents are used.

```sh
docker compose down
```

These commands retain named volumes. Do not add `--volumes` unless deliberately discarding this project's demo data. Do not prune shared resources. Private research, runtime files, environment files, databases and issuer keys are excluded from build contexts and standalone artifacts; the artifact check verifies that boundary. These local service management ports are not the future public deployment route map.
