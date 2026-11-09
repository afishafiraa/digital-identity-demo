# Shared acceptance criteria and release gate

Updated: 2026-11-09. Status: F1–F7 and S-AC07 passed locally; later features and full release acceptance remain pending. See the [acceptance ledger](../workitem/acceptance-results.md).

Source: [PRD](prd.md) sections 2–4 and 8–10, with deployment constraints from the [system design](../arch/system-design.md) and the deployment step of the [demo plan](../plan/demo-plan.md). These criteria complement the [F1–F9 feature guides](features/README.md). They do not add optional product features.

## Shared criteria

| ID | Source | Acceptance condition | Required evidence |
|---|---|---|---|
| S-AC01 | PRD 2, 5, 10 | From a reset state, a visitor completes real issue → accept → view → approve → present → verify three consecutive times, with reset between runs. Every Verified state corresponds to that run's actual verifier success. | Three correlated run records, wallet/request references, observed result, reset evidence; no private tokens/keys |
| S-AC02 | PRD 7–10; architecture sessions | Separate visitor sessions cannot read, present with, or reset each other's wallet or retrieve each other's results. Ownership is enforced server-side even when foreign IDs are supplied. | Automated cross-session read/mutation/result checks for A/B; browser-isolated walkthrough |
| S-AC03 | PRD 8–9; architecture secrets | Application/service credentials and signing keys stay server-side and do not appear in browser bundles, responses, or logs. Browser authorization uses the owning session; mutation protection follows the architecture. | Targeted source/configuration review, response/bundle/log inspection, unauthorized and cross-origin mutation checks |
| S-AC04 | PRD 9–10; architecture storage | Refresh resumes wallet state, restart preserves required credential/key data and ownership, and reset invalidates stale operations. Lost/expired request state is handled explicitly without false success. | Refresh, app/service restart and reset race checks; documented persistence mounts and coordination store |
| S-AC05 | PRD 2, 6, 9 | A first-time visitor can follow the English flow without a presenter. Empty/loading/error/result states are readable; controls are labeled and keyboard-operable; statuses do not rely on color; desktop and narrow layouts remain usable. | Manual walkthrough with recorded viewport sizes, keyboard path, consent readability, and findings |
| S-AC06 | PRD 4, 7–8 | The fixed fictional scenario uses non-production keys and consistent issue/expiry dates. No client code/data is used. Custody, validity and disclosure claims match actual behavior; no unsupported revocation, MPC, or device-local key claims appear. | Scenario/configuration and UI/documentation review against actual payloads and verification policies |
| S-AC07 | PRD 8, 10; architecture integration gate | One compatible pinned stack/profile has a reproducible real exchange before custom UI work. Setup records versions/digests, protocol/profile, signing and holder proof, verification policies, endpoints and startup/exchange commands. | Completed architecture decision record and linked integration proof; fresh reproducibility check |
| S-AC08 | PRD 10 | Source setup is reproducible and README explains scenario, custody model, limitations and actual Codex-assisted build time. Our UI/coordination work is distinguished from walt.id functionality and original HCW contributions. | Setup check and documentation review; measured work record rather than estimated time presented as fact |
| S-AC09 | PRD 1; architecture deployment; plan deployment step | Existing VPS configuration is inspected before deployment changes. The demo uses its subdomain and HTTPS, exposes only app/required protocol routes, persists state, and preserves existing sites/services with a rollback procedure. | Inspection summary, route/volume map, deployment/rollback instructions, public real exchange and isolation checks, existing-site checks |
| S-AC10 | Architecture sessions/deployment | Before public release, session expiry, abandoned-state cleanup, resource limits and retention limitations are configured/documented; cleanup affects only its owning demo state. Private research is excluded from public/build artifacts. | Configuration review, scoped cleanup check, recorded retention limitations, artifact/build-context inspection |

S-AC09 and S-AC10 are online-release checks derived from the existing architecture/plan, not new wallet screens. They are not prerequisites for a first local integration experiment. S-AC07 has already passed for the selected service/profile baseline. Reuse that evidence; repeat the exchange when relevant integration details change, not as a prerequisite for every feature. S-AC01–S-AC08 apply to the stable core, with actual UI checks performed once UI exists.

## PRD coverage map

| PRD source | Detailed coverage |
|---|---|
| Section 2 success: independent walkthrough, real results, repeatability, non-success, ownership explanation | S-AC01, S-AC05, S-AC08; F3, F6–F8 |
| Sections 3–4 scope and fictional data | Feature guide boundaries, S-AC06; optional work stays in the demo plan |
| Sections 5–6 journey and minimum views | F1 entry/home; F2–F3 offer review; F4 list/detail; F5–F6 request/review; F7–F8 result; F9 reset |
| Section 7 F1–F9 | One corresponding guide per requirement in the feature index |
| Sections 8–9 technical ownership, reliability, usability | S-AC02–S-AC07, feature state/failure behavior; architecture remains owner of technical decisions |
| Section 10 check 1: three complete exchanges | S-AC01; F1–F7 and F9 |
| Section 10 check 2: decline and double acceptance | F3-AC02, F3-AC03 |
| Section 10 check 3: cancelled presentation | F6-AC03 |
| Section 10 check 4: missing/expired/invalid request | F5-AC02, F5-AC05, F6-AC05, F7-AC03, F8-AC02 |
| Section 10 check 5: service unavailability | F2-AC03, F3-AC04, F4-AC05, F5-AC04, F7-AC04, F8-AC01–F8-AC04 |
| Section 10 check 6: refresh and reset races | F1-AC02, F4-AC04, F8-AC05, F9-AC02, F9-AC04; S-AC04 |
| Section 10 check 7: two-session isolation | F1-AC03, F7-AC05, F9-AC03; S-AC02 |
| Section 10 setup and README definition of done | S-AC07–S-AC08 |

## Verification and evidence rules

Keep verification proportional to this small demo. An existing test run or walkthrough may cover several feature/shared acceptance IDs; link it once in the ledger instead of creating a test, evidence document, service or framework for each row. Reuse F1 and the completed integration proof. The deployment checks apply before publishing, not as extra infrastructure work before the next local UI step.

Automate the real exchange and important ownership/state rules. Use targeted fault injection or adapter responses for hard-to-trigger timeouts, races, and result mapping; identify these as controlled checks. They do not replace a real-service happy path or prove cryptographic compatibility. Keep layout/keyboard verification manual unless later evidence justifies more tooling. Do not write tests that merely mirror trivial UI code.

Record each criterion in [acceptance results](../workitem/acceptance-results.md) as not run, pass, fail, or blocked. Every pass requires a dated reproducible command or walkthrough, source/configuration version, observed outcome, and evidence link. A blocker records the missing capability/decision and its impact; it is not a pass or permission to skip the criterion. Redact keys, tokens, cookies and raw private records from evidence.

Feature completion requires its own criteria plus applicable shared criteria. Stable-core completion requires all F1–F9 criteria and S-AC01–S-AC08 to pass. Online release additionally requires S-AC09–S-AC10. Resolve failures in required behavior before claiming completion; no waiver or optional enhancement silently changes the PRD.
