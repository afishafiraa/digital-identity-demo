# F6-review-and-approve-sharing — Review and approve sharing

Updated: 2026-11-09. Status: Complete locally; [verification evidence](../../workitem/F6-review-and-approve-sharing-verification.md). Product presentation/result handling remains F7.

Source: [PRD](../prd.md), PRD sections 5–7 (F6), 9, and 10 checks 3–4. Apply the shared rules in the [feature index](README.md).

## Small implementation

A small sharing panel shows Harbor Works, the purpose, the Training Certificate and exactly what will be shared. Provide Approve and Cancel. The selected demo shares the whole configured credential; say so plainly.

No consent dashboard, claim picker, saved-consent system, automatic approval or selective-disclosure feature. Approval belongs only to this reviewed request. F7 performs the actual presentation after approval.

## Acceptance checks

| ID | When / condition | Required result |
|---|---|---|
| F6-AC01 | The sharing panel opens | Show verifier, purpose, credential and actual disclosure scope before the visitor can approve. |
| F6-AC02 | The current demo shares the whole credential | Explicitly state that the whole credential is shared. |
| F6-AC03 | The visitor selects Cancel | Close the panel without submitting a presentation or showing Verified. |
| F6-AC04 | The visitor approves | The submitted credential/disclosure matches the reviewed request; repeated clicks do not submit again. |
| F6-AC05 | The request expires or reset occurs before approval | Do not submit using stale consent; require a fresh current request/review. |

## Reuse and verification

Depends on F5-create-verification-request. The [proved profile](../../../pocs/README.md) is fixed; compare the consent text with the actual payload rather than adding disclosure customization.

Record actual outcomes in the [acceptance ledger](../../workitem/acceptance-results.md). Reuse one walkthrough or focused check for multiple criteria where appropriate; no separate test or evidence file is required for each row. Shared [acceptance rules](../acceptance.md) still apply.
