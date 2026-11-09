# Acceptance results

Updated: 2026-11-09. Status: F1–F7 and the real integration gate passed locally. F9 reset is implemented and verified on the public Vercel demo at the owner’s request; F8 and complete-journey release acceptance remain unverified. See [F1 evidence](F1-start-and-resume-demo-session-verification.md), [F2 evidence](F2-create-and-review-credential-offer-verification.md), [F3 evidence](F3-accept-or-decline-credential-verification.md), [F4 evidence](F4-list-and-inspect-stored-credentials-verification.md), [F5 evidence](F5-create-verification-request-verification.md), [F6 evidence](F6-review-and-approve-sharing-verification.md) and [F7 evidence](F7-present-and-show-verifier-result-verification.md).

Use the [feature guides](../spec/features/README.md) and [shared acceptance criteria](../spec/acceptance.md) as the verification contract. This ledger tracks evidence, not additional requirements. The implementation checklist tracks stages; a checked stage must be consistent with these results.

## Recording a result

Allowed statuses: **not run**, **pass**, **fail**, **blocked**. For each executed check, link an evidence record containing date, source/configuration version, environment, command or walkthrough, expected/observed outcomes, and any defect reference. For blocked checks, record the blocker and next resolution step. For the three-run check, record all three runs separately in the linked evidence. Keep secrets out of records.

Evidence can be stored alongside the work under `docs/workitem/` or root `pocs/` once experiments exist. Do not create empty proof files or mark an outcome based only on a planned test. A scoped change reopens affected results for verification; previous evidence remains history.

## Criterion ledger

| Criterion | Specification | Status | Evidence / blocker |
|---|---|---|---|
| F1-AC01 | [Guide](../spec/features/F1-start-and-resume-demo-session.md) | pass | [Live API, browser and fault/restart evidence](F1-start-and-resume-demo-session-verification.md) |
| F1-AC02 | [Guide](../spec/features/F1-start-and-resume-demo-session.md) | pass | [Live API, browser and fault/restart evidence](F1-start-and-resume-demo-session-verification.md) |
| F1-AC03 | [Guide](../spec/features/F1-start-and-resume-demo-session.md) | pass | [Live API, browser and fault/restart evidence](F1-start-and-resume-demo-session-verification.md) |
| F1-AC04 | [Guide](../spec/features/F1-start-and-resume-demo-session.md) | pass | [Live API, browser and fault/restart evidence](F1-start-and-resume-demo-session-verification.md) |
| F2-AC01 | [Guide](../spec/features/F2-create-and-review-credential-offer.md) | pass | [Real offer review, failures and focused checks](F2-create-and-review-credential-offer-verification.md) |
| F2-AC02 | [Guide](../spec/features/F2-create-and-review-credential-offer.md) | pass | [Real offer review, failures and focused checks](F2-create-and-review-credential-offer-verification.md) |
| F2-AC03 | [Guide](../spec/features/F2-create-and-review-credential-offer.md) | pass | [Real offer review, failures and focused checks](F2-create-and-review-credential-offer-verification.md) |
| F2-AC04 | [Guide](../spec/features/F2-create-and-review-credential-offer.md) | pass | [Real offer review, failures and focused checks](F2-create-and-review-credential-offer-verification.md) |
| F2-AC05 | [Guide](../spec/features/F2-create-and-review-credential-offer.md) | pass | [Real offer review, failures and focused checks](F2-create-and-review-credential-offer-verification.md) |
| F3-AC01 | [Guide](../spec/features/F3-accept-or-decline-credential.md) | pass | [Real receipt/decline and controlled failure/stale-reference checks](F3-accept-or-decline-credential-verification.md) |
| F3-AC02 | [Guide](../spec/features/F3-accept-or-decline-credential.md) | pass | [Real receipt/decline and controlled failure/stale-reference checks](F3-accept-or-decline-credential-verification.md) |
| F3-AC03 | [Guide](../spec/features/F3-accept-or-decline-credential.md) | pass | [Real receipt/decline and controlled failure/stale-reference checks](F3-accept-or-decline-credential-verification.md) |
| F3-AC04 | [Guide](../spec/features/F3-accept-or-decline-credential.md) | pass | [Real receipt/decline and controlled failure/stale-reference checks](F3-accept-or-decline-credential-verification.md) |
| F3-AC05 | [Guide](../spec/features/F3-accept-or-decline-credential.md) | pass | [Real receipt/decline and controlled failure/stale-reference checks](F3-accept-or-decline-credential-verification.md) |
| F4-AC01 | [Guide](../spec/features/F4-list-and-inspect-stored-credentials.md) | pass | [Real stored data/refresh/isolation and controlled failure checks](F4-list-and-inspect-stored-credentials-verification.md) |
| F4-AC02 | [Guide](../spec/features/F4-list-and-inspect-stored-credentials.md) | pass | [Real stored data/refresh/isolation and controlled failure checks](F4-list-and-inspect-stored-credentials-verification.md) |
| F4-AC03 | [Guide](../spec/features/F4-list-and-inspect-stored-credentials.md) | pass | [Real stored data/refresh/isolation and controlled failure checks](F4-list-and-inspect-stored-credentials-verification.md) |
| F4-AC04 | [Guide](../spec/features/F4-list-and-inspect-stored-credentials.md) | pass | [Real stored data/refresh/isolation and controlled failure checks](F4-list-and-inspect-stored-credentials-verification.md) |
| F4-AC05 | [Guide](../spec/features/F4-list-and-inspect-stored-credentials.md) | pass | [Real stored data/refresh/isolation and controlled failure checks](F4-list-and-inspect-stored-credentials-verification.md) |
| F5-AC01 | [Guide](../spec/features/F5-create-verification-request.md) | pass | [Real request/no-submission/isolation and controlled expiry/failure checks](F5-create-verification-request-verification.md) |
| F5-AC02 | [Guide](../spec/features/F5-create-verification-request.md) | pass | [Real request/no-submission/isolation and controlled expiry/failure checks](F5-create-verification-request-verification.md) |
| F5-AC03 | [Guide](../spec/features/F5-create-verification-request.md) | pass | [Real request/no-submission/isolation and controlled expiry/failure checks](F5-create-verification-request-verification.md) |
| F5-AC04 | [Guide](../spec/features/F5-create-verification-request.md) | pass | [Real request/no-submission/isolation and controlled expiry/failure checks](F5-create-verification-request-verification.md) |
| F5-AC05 | [Guide](../spec/features/F5-create-verification-request.md) | pass | [Real request/no-submission/isolation and controlled expiry/failure checks](F5-create-verification-request-verification.md) |
| F6-AC01 | [Guide](../spec/features/F6-review-and-approve-sharing.md) | pass | [Real consent/cancel, exact-disclosure fixture and controlled stale-reference checks](F6-review-and-approve-sharing-verification.md) |
| F6-AC02 | [Guide](../spec/features/F6-review-and-approve-sharing.md) | pass | [Real consent/cancel, exact-disclosure fixture and controlled stale-reference checks](F6-review-and-approve-sharing-verification.md) |
| F6-AC03 | [Guide](../spec/features/F6-review-and-approve-sharing.md) | pass | [Real consent/cancel, exact-disclosure fixture and controlled stale-reference checks](F6-review-and-approve-sharing-verification.md) |
| F6-AC04 | [Guide](../spec/features/F6-review-and-approve-sharing.md) | pass | [Real consent/cancel, exact-disclosure fixture and controlled stale-reference checks](F6-review-and-approve-sharing-verification.md) |
| F6-AC05 | [Guide](../spec/features/F6-review-and-approve-sharing.md) | pass | [Real consent/cancel, exact-disclosure fixture and controlled stale-reference checks](F6-review-and-approve-sharing-verification.md) |
| F7-AC01 | [Guide](../spec/features/F7-present-and-show-verifier-result.md) | pass | [Actual verified/rejected exchanges, isolation and controlled pending/failure checks](F7-present-and-show-verifier-result-verification.md) |
| F7-AC02 | [Guide](../spec/features/F7-present-and-show-verifier-result.md) | pass | [Actual verified/rejected exchanges, isolation and controlled pending/failure checks](F7-present-and-show-verifier-result-verification.md) |
| F7-AC03 | [Guide](../spec/features/F7-present-and-show-verifier-result.md) | pass | [Actual verified/rejected exchanges, isolation and controlled pending/failure checks](F7-present-and-show-verifier-result-verification.md) |
| F7-AC04 | [Guide](../spec/features/F7-present-and-show-verifier-result.md) | pass | [Actual verified/rejected exchanges, isolation and controlled pending/failure checks](F7-present-and-show-verifier-result-verification.md) |
| F7-AC05 | [Guide](../spec/features/F7-present-and-show-verifier-result.md) | pass | [Actual verified/rejected exchanges, isolation and controlled pending/failure checks](F7-present-and-show-verifier-result-verification.md) |
| F8-AC01 | [Guide](../spec/features/F8-handle-pending-expiry-and-failures.md) | not run | — |
| F8-AC02 | [Guide](../spec/features/F8-handle-pending-expiry-and-failures.md) | not run | — |
| F8-AC03 | [Guide](../spec/features/F8-handle-pending-expiry-and-failures.md) | not run | — |
| F8-AC04 | [Guide](../spec/features/F8-handle-pending-expiry-and-failures.md) | not run | — |
| F8-AC05 | [Guide](../spec/features/F8-handle-pending-expiry-and-failures.md) | not run | — |
| F9-AC01 | [Guide](../spec/features/F9-reset-current-demo.md) | pass | [Public real reset, isolation, stale response and lost-reply checks](F9-reset-current-demo-verification.md) |
| F9-AC02 | [Guide](../spec/features/F9-reset-current-demo.md) | pass | [Public real reset, isolation, stale response and lost-reply checks](F9-reset-current-demo-verification.md) |
| F9-AC03 | [Guide](../spec/features/F9-reset-current-demo.md) | pass | [Public real reset, isolation, stale response and lost-reply checks](F9-reset-current-demo-verification.md) |
| F9-AC04 | [Guide](../spec/features/F9-reset-current-demo.md) | pass | [Public real reset, isolation, stale response and lost-reply checks](F9-reset-current-demo-verification.md) |
| F9-AC05 | [Guide](../spec/features/F9-reset-current-demo.md) | pass | [Public real reset, isolation, stale response and lost-reply checks](F9-reset-current-demo-verification.md) |
| S-AC01 | [Guide](../spec/acceptance.md) | not run | — |
| S-AC02 | [Guide](../spec/acceptance.md) | not run | — |
| S-AC03 | [Guide](../spec/acceptance.md) | not run | — |
| S-AC04 | [Guide](../spec/acceptance.md) | not run | — |
| S-AC05 | [Guide](../spec/acceptance.md) | not run | — |
| S-AC06 | [Guide](../spec/acceptance.md) | not run | — |
| S-AC07 | [Guide](../spec/acceptance.md) | pass | [Pinned real exchange and reproducible setup](../../pocs/README.md) |
| S-AC08 | [Guide](../spec/acceptance.md) | not run | — |
| S-AC09 | [Guide](../spec/acceptance.md) | not run | — |
| S-AC10 | [Guide](../spec/acceptance.md) | not run | — |
