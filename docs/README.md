# Documentation index

Start with the [PRD](spec/prd.md) and [short demo plan](plan/demo-plan.md). During implementation, read the current [feature guide](spec/features/README.md) and the compact [architecture](arch/system-design.md); consult acceptance details as needed. The documents below are references, not separate delivery projects.

| Location | Purpose |
|---|---|
| `spec/prd.md` | Product goals, features, and acceptance criteria; source of truth for scope |
| `spec/features/` | F1–F9 behavior, scope boundaries, states, acceptance IDs, and required evidence |
| `spec/acceptance.md` | Shared criteria, PRD traceability, and release gates |
| `workitem/acceptance-results.md` | Per-criterion verification status and evidence |
| `arch/typescript-standards.md` | Strict compiler/lint policy and validation boundaries |
| `arch/system-design.md` | Stack, integration decisions, sessions, storage, and VPS approach |
| `plan/local-development.md` | Local setup, commands, API boundaries and container preparation |
| `workitem/F1-start-and-resume-demo-session-verification.md` | Completed F1 acceptance evidence and remaining release boundaries |
| `workitem/F2-create-and-review-credential-offer-verification.md` | Completed F2 offer-review evidence and current limits |
| `workitem/F3-accept-or-decline-credential-verification.md` | Completed F3 real receipt/decline and controlled failure evidence |
| `workitem/F4-list-and-inspect-stored-credentials-verification.md` | Completed F4 stored-card/detail, refresh and failure evidence |
| `workitem/F5-create-verification-request-verification.md` | Completed F5 real request, no-submission, ownership and expiry evidence |
| `workitem/F6-review-and-approve-sharing-verification.md` | Completed F6 consent, whole-disclosure comparison, cancellation and stale-reference evidence |
| `workitem/F7-present-and-show-verifier-result-verification.md` | Completed F7 real presentation/result, exact-credential selection and isolation evidence |
| `workitem/local-foundation.md` | Historical foundation/setup record; superseded by current F1 evidence |
| `plan/demo-plan.md` | Milestones, optional features, and deferred work |
| `workitem/implementation.md` | Execution checklist and validation evidence |
| `workitem/bugs/` | Actual defects with reproduction steps, expected/actual behavior, fix, and verification |
| `../research/` | Private background; excluded from public repositories and deployment artifacts |

Root [design notes](../design/F1-start-and-resume-demo-session-interface.md) now describe the F1 interface, and the [integration proof](../pocs/README.md) records the real exchange. Record technical decisions in the architecture document and link supporting evidence instead of duplicating requirements.

For an observed defect, create `workitem/bugs/<short-name>.md` with status, affected versions, reproduction steps, expected behavior, actual behavior, fix, and verification evidence. Do not create speculative bug reports.

[Project overview](../README.md)
