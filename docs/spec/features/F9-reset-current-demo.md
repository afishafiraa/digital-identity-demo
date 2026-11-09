# F9-reset-current-demo — Reset the current demo

Updated: 2026-11-08. Status: Pending; product implementation and acceptance checks not run.

Source: [PRD](../prd.md), PRD sections 5–7 (F9), 9, and 10 checks 1, 6–7. Apply the shared rules in the [feature index](README.md).

## Small implementation

One Reset demo action returns the current visitor to an empty, repeatable wallet state on the same page. Clear their old offer/request/result and prevent old responses from restoring them.

Use the existing session ownership lookup and supported wallet operations. Add no account-deletion wizard, global reset, shared-volume deletion, issuer-key rotation or recovery service. A small current-attempt guard/request cancellation is sufficient if it enforces the behavior below.

## Acceptance checks

| ID | When / condition | Required result |
|---|---|---|
| F9-AC01 | Reset succeeds after a credential/result exists | Clear/replace only this visitor’s wallet to an empty scenario and remove their old result from the page. |
| F9-AC02 | An earlier issuance/result response arrives after reset | It cannot repopulate the current wallet UI or show Verified for the new attempt. |
| F9-AC03 | Visitor A resets while visitor B has a wallet | B’s wallet, credential and result remain unchanged. |
| F9-AC04 | The visitor refreshes after reset and repeats the walkthrough | The reset state persists and a fresh real exchange can complete. |
| F9-AC05 | Reset fails partway or is clicked repeatedly | Do not report completion prematurely, affect unrelated data or blindly repeat an uncertain mutation. |

## Reuse and verification

Depends on F1 ownership and the existing credential/request references. Use the smallest supported clear-or-replace approach. Record actual retention/cleanup behavior for public deployment; do not claim physical deletion unless it is verified.

Record actual outcomes in the [acceptance ledger](../../workitem/acceptance-results.md). Reuse one walkthrough or focused check for multiple criteria where appropriate; no separate test or evidence file is required for each row. Shared [acceptance rules](../acceptance.md) still apply.
