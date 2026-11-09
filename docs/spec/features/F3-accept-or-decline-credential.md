# F3-accept-or-decline-credential — Accept or decline a credential

Updated: 2026-11-08. Status: Complete locally; see [real receipt/decline and controlled failure evidence](../../workitem/F3-accept-or-decline-credential-verification.md). Product reset races remain F9/shared acceptance work.

Source: [PRD](../prd.md), PRD sections 5–7 (F3), 9, and 10 checks 1–2, 5–6. Apply the shared rules in the [feature index](README.md).

## Small implementation

Wire Accept and Decline in the existing offer panel. Accept receives the real credential into the current wallet, then returns to the wallet page. Decline closes the offer without receiving it.

Reuse the proved wallet receive operation and walt.id-managed holder key. No new key-management UI, custom cryptography, batch issuing or recovery subsystem. Guard one offer at a time; do not invent a global credential limit.

## Acceptance checks

| ID | When / condition | Required result |
|---|---|---|
| F3-AC01 | Accept succeeds for the current offer | Store one real issued credential in the visitor’s wallet and confirm receipt only after storage is known. |
| F3-AC02 | The visitor selects Decline | Return to the wallet with no credential received from that offer. |
| F3-AC03 | Accept is clicked repeatedly or again after completion | The same offer does not produce duplicate acceptance or duplicate stored credentials. |
| F3-AC04 | Acceptance might have completed before the response was lost | Check the wallet/known operation before retrying; an uncertain result stays an error/check state rather than another blind acceptance. |
| F3-AC05 | Acceptance fails or an old result arrives after reset | Explain the failure and do not show it as a newly received credential in the current wallet. |

## Reuse and verification

Depends on F2-create-and-review-credential-offer and F1 ownership. F4 supplies the display after confirmed receipt. Use supported wallet reads to check an uncertain outcome; no new idempotency framework is required.

Record actual outcomes in the [acceptance ledger](../../workitem/acceptance-results.md). Reuse one walkthrough or focused check for multiple criteria where appropriate; no separate test or evidence file is required for each row. Shared [acceptance rules](../acceptance.md) still apply.
