# Small wallet feature guide

Updated: 2026-11-09. F1-start-and-resume-demo-session, F2-create-and-review-credential-offer, F3-accept-or-decline-credential, F4-list-and-inspect-stored-credentials, F5-create-verification-request, F6-review-and-approve-sharing and F7-present-and-show-verifier-result are complete locally; **F8-handle-pending-expiry-and-failures is next**. Later product features remain unimplemented. The [real integration proof](../../../pocs/README.md) has passed.

These guides follow the [PRD](../prd.md) and [small architecture](../../arch/system-design.md): one basic wallet page, one Next.js app, and the existing walt.id Issuer2/Wallet2/Verifier2 services. No additional service, account system, admin portal or general recovery framework is required by a feature.

## Where the visitor sees each feature

- **Entry/wallet state:** F1 starts/resumes; F4 shows a credential card and inline details; F9 resets the current demo.
- **Receive panel:** F2 reviews the offer; F3 accepts or declines it.
- **Sharing panel and inline result:** F5 prepares the request, F6 asks for consent, F7 submits and shows the actual verdict.
- **Existing status text:** F8 makes loading, expiry, errors and retry consistent across those steps.

These are checkpoints within one small flow, not separate applications or required pages. Implement and verify them one at a time; a guide's criteria are outcomes, not a request for new infrastructure.

## Feature specifications

| PRD requirement | Feature guide | Acceptance IDs |
|---|---|---|
| F1 | [Start and resume a demo session](F1-start-and-resume-demo-session.md) | F1-AC01–F1-AC04 |
| F2 | [Create and review a credential offer](F2-create-and-review-credential-offer.md) | F2-AC01–F2-AC05 |
| F3 | [Accept or decline a credential](F3-accept-or-decline-credential.md) | F3-AC01–F3-AC05 |
| F4 | [List and inspect stored credentials](F4-list-and-inspect-stored-credentials.md) | F4-AC01–F4-AC05 |
| F5 | [Create a verification request](F5-create-verification-request.md) | F5-AC01–F5-AC05 |
| F6 | [Review and approve sharing](F6-review-and-approve-sharing.md) | F6-AC01–F6-AC05 |
| F7 | [Present and show the actual verifier result](F7-present-and-show-verifier-result.md) | F7-AC01–F7-AC05 |
| F8 | [Handle pending, expiry, and failures](F8-handle-pending-expiry-and-failures.md) | F8-AC01–F8-AC05 |
| F9 | [Reset the current demo safely](F9-reset-current-demo.md) | F9-AC01–F9-AC05 |

## Shared implementation rules

1. Reuse the completed service/profile proof and working F1 code. Verify new endpoints only when the current step needs them; do not start another integration research project.
2. Use small server calls and the current visitor's references. Keep keys/service credentials server-side, guard ownership and repeated submissions, and never turn pending/unknown into success.
3. Use the existing loading/error helpers. Check known state before retrying an uncertain mutation; do not add automatic retry jobs or a generic recovery engine.
4. Keep the fixed fictional scenario, English interface, whole-credential disclosure, and proved holder-bound SD-JWT profile. MPC, product Backup & Recovery, selective disclosure, extra scenarios, QR and the landing page stay out of this build.
5. Reuse useful tests and the real exchange fixture. One walkthrough/check can cover multiple acceptance IDs; a separate automated test, evidence file or framework per row is unnecessary. Use manual keyboard/mobile review for layout. Apply shared [acceptance criteria](../acceptance.md) once to the complete demo and public deployment as appropriate.
6. Record only actual outcomes in the existing [acceptance ledger](../../workitem/acceptance-results.md). F1's pass evidence remains valid; rewriting specifications does not pass later features.

Use `F<number>-<descriptive-feature-name>.md` for specifications and the same prefix plus a purpose suffix for related documents. Keep acceptance IDs such as `F1-AC01` stable. Do not add planning documents for routine utilities.
