# Local foundation checkpoint — historical record

Updated: 2026-11-08 (JST). Historical status below describes the earlier restricted session. **Current:** access was restored, the real integration proof passed, and F1–F4 are complete; see the [current ledger](acceptance-results.md).

## Scope and implementation

This work follows F1/F8/F9 ownership and failure-handling constraints and S-AC02–S-AC04 groundwork. It does **not** satisfy those wallet acceptance criteria by itself. F2–F7 require a real walt.id exchange and remain unimplemented. The current authorization covers local implementation; no VPS work occurred.

| Layer | Current behavior |
|---|---|
| App | Next.js App Router, React, TypeScript, Tailwind source; one accessible foundation screen with an explicitly unavailable Start demo action |
| Liveness | `GET /api/health/live` returns 200 when the app can serve requests |
| Readiness | `GET /api/health/ready` deliberately returns 503 `integration-not-proved`; service configuration cannot switch this to success |
| Session metadata | `GET /api/session` inspects the cookie's coordination session; `POST` creates/resumes it; `DELETE` revokes only that coordination session |
| Persistence | SQLite metadata under `DEMO_DATA_DIR`, with hashed session tokens, absolute expiry, active-session cap, prepared statements, private filesystem modes, and transactional creation |
| Service transport | Server-only integration boundary with configured service origins, bounded reads/deadlines, rejected redirects, schema decoder, redacted errors, and no automatic mutation retries |
| Local container preparation | Development Dockerfile/Compose for the app, loopback-only published port, named metadata volume, unprivileged process, resource controls; syntax checked, containers not run |

The session API always returns `wallet: null` and `integration: not-proved`. It creates no walt.id wallet, credentials, or holder keys. Revoking a coordination session is not F9's complete wallet reset. No endpoint accepts a browser-provided wallet ID, credential payload, or service URL. No credentials or secret-bearing client storage have been introduced.

## Verification evidence

Checks performed on Node.js 22.23.2 on this host:

| Check | Result and limit |
|---|---|
| `npm test` | PASS: 17 backend tests using Node's built-in runner and TypeScript stripping; no npm dependencies needed |
| `npm run check:env` | PASS with development defaults; no services configured; does not prove reachability |
| Backend strict typecheck | PASS using a locally available public TypeScript 5.7.2 compiler and Node 22.10.1 declarations; includes core, scripts, and tests |
| Offline structural app typecheck | PASS using the same compiler and locally available public Next 15 / React 19 declarations; only a compatibility check, not validation against the pinned Next 16 dependency set |
| `docker compose config --quiet` | PASS: Compose syntax; no daemon used |
| `npm install --package-lock-only --ignore-scripts --fetch-retries=0 --fetch-timeout=10000` | BLOCKED: `ENOTFOUND registry.npmjs.org`; no lockfile fabricated |
| `npm run preflight` | npm registry BLOCKED; Docker daemon BLOCKED; Docker Compose CLI PASS |
| `npm run typecheck`, `npm run build` | BLOCKED: dependencies absent (`tsc`/`next` not found) |
| Browser QA and real-service exchange | NOT RUN: no app runtime or walt.id containers available |

The offline checks read only installed public dependency tooling/type declarations; no other project's application source or client material was reused. No old Next runtime was launched as a substitute for the pinned version.

The tests cover configuration rejection, origin/content-type/body validation, stream size and read deadlines, metadata persistence across reopening, expiry/capacity, isolated revocation, cookie attributes/ambiguity, error redaction, fixed service URLs, unexpected upstream responses, and timeouts without retries. Controlled transport responses are fault-injection checks, not cryptographic integration evidence.

The SQLite result-typing issue found by the offline compiler was fixed; see [defect record](bugs/sqlite-result-typing.md).

## Environment blockers and next actions

1. npm registry DNS lookup fails in the execution environment. Once registry access works, install the pinned packages, generate/review the real lockfile, run the full typecheck/build, and inspect dependency audit findings before release.
2. Docker CLI is installed, but access to `/Users/gaogao/.docker/run/docker.sock` is denied in this session. Once daemon access is available, select/pin compatible upstream services and prove the real exchange before adding the wallet journey.
3. Run the app at `http://127.0.0.1:3000`, check HTTP routes and browser behavior, and exercise container persistence once runtime access permits. The canonical origin must match exactly; do not silently use another port.
4. Configure walt.id authentication/persistence and origin routing from the selected release, record exact versions/policies/profile, then implement F1–F9 against those proved capabilities. Do not add speculative service configs or publicly hosted credentials to bypass these blockers.

The app Compose file intentionally contains no guessed walt.id images or storage paths. It is a development foundation, not the promised complete stack or a VPS deployment configuration.

## Security and release limits

The browser gets only session metadata and an HttpOnly session cookie; tokens are hashed at rest. Request mutations require the configured exact Origin, suitable fetch metadata, JSON, an empty object, and bounded bytes/read time. HTTPS cookies use Secure and the `__Host-` prefix. Responses are non-cacheable and redact internal errors. The container build context is an allowlist that excludes environment files, private research, runtime databases, and unrelated files.

This is not a security certification or a public-release build. The initial Next CSP permits inline scripts for framework bootstrap; review nonce-based CSP during runtime hardening. Node 22's built-in SQLite remains experimental and is version-pinned here. Per-visitor wallet authorization, pending-operation reconciliation, holder-key persistence, wallet cleanup, rate limiting for public traffic, production routing, dependency auditing, and the full S-AC criteria still require implementation/verification.

## Time record

The observed implementation/check interval began at 2026-11-07 16:06:31 UTC. Earlier environment inspection was not fully timed; total Codex-assisted build time remains incomplete and must not be reported as a measured end-to-end build duration.

## Strict TypeScript follow-up — 2026-11-08

Enabled exact optional properties, checked index access/property syntax, complete returns, unused-code checks, explicit override checks, casing consistency and type-only imports. Added standard type-aware ESLint rules for explicit/unsafe `any`, non-null and type assertions, suppression comments, and unhandled promises; inline lint overrides are disallowed. The full check command now includes lint.

Replaced unchecked SQLite result casts with runtime integer decoding, removed non-null assertions from source/tests, validated test JSON as unknown, and removed the configuration parser's dependency on Next.js's ambient ProcessEnv augmentation. Updated project working rules in root AGENTS.md.

Verification: all **18 backend tests pass**, including the new invalid-database-row check. Offline structural typechecking passes with the stricter project flags across app/server/scripts/tests. AST/scanner inspection passes for all 23 owned TypeScript files: no explicit-any nodes, non-null assertions, disallowed type assertions, or suppression comments. `npm run lint` is blocked (`eslint: command not found`) because the new pinned packages cannot be installed while registry access is unavailable. Full lint, pinned-dependency typechecking and the Next.js build remain unverified; no compiler/lint bypass was used to claim success.
