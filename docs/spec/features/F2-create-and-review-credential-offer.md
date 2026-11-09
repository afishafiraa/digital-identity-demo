# F2-create-and-review-credential-offer — Create and review a credential offer

Updated: 2026-11-08. Status: Complete locally; [verification evidence](../../workitem/F2-create-and-review-credential-offer-verification.md). F3 owns acceptance/decline.

Source: [PRD](../prd.md), PRD sections 4–7 (F2), 9, and 10 check 5. Apply the shared rules in the [feature index](README.md).

## Small implementation

One Receive sample credential button opens an offer-review panel on the wallet page. Show Northstar Learning, Training Certificate and the configured fictional claims before acceptance. Include an expandable JSON view of the offered claims using their actual field names; label this as an offer preview, not an issued or stored VC.

Use the existing training profile and a small server call to Issuer2. No issuer portal, editable claim form, arbitrary offer import, extra credential type or new service. F3 implements Accept/Decline; F2 must not pretend those actions have already received a credential.

## Acceptance checks

| ID | When / condition | Required result |
|---|---|---|
| F2-AC01 | Receive sample credential succeeds | Create a real offer for the current visitor and show the configured issuer and claims in the panel. |
| F2-AC02 | The offer is being reviewed | No credential is stored or shown as received before acceptance. Include an expandable JSON view of the offered claims using their actual field names; label this as an offer preview, not an issued or stored VC. |
| F2-AC03 | Offer creation fails or times out | Keep the wallet unchanged and show an understandable retry/check action. |
| F2-AC04 | The visitor clicks Receive repeatedly | Guard repeated submissions; check an uncertain earlier result before sending another create. |
| F2-AC05 | An offer is expired or belongs to an earlier/reset attempt | Do not treat it as the current valid offer; let the visitor request a fresh one. |

## Reuse and verification

Depends on F1-start-and-resume-demo-session. Reuse the [proved Issuer2 profile and offer operation](../../../pocs/README.md); verify only new details needed for the review. F3 owns acceptance.

Record actual outcomes in the [acceptance ledger](../../workitem/acceptance-results.md). Reuse one walkthrough or focused check for multiple criteria where appropriate; no separate test or evidence file is required for each row. Shared [acceptance rules](../acceptance.md) still apply.
