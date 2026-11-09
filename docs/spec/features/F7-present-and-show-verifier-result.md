# F7-present-and-show-verifier-result — Present and show the verifier result

Updated: 2026-11-09. Status: Complete locally; [verification evidence](../../workitem/F7-present-and-show-verifier-result-verification.md). F8–F9 and release-wide acceptance remain pending.

Source: [PRD](../prd.md), PRD sections 5–7 (F7), 9, and 10 checks 1, 3–5, 7. Apply the shared rules in the [feature index](README.md).

## Small implementation

After approval, ask Wallet2 to present and display progress followed by the real verifier result on the wallet page. A short result panel is sufficient; no additional result dashboard is needed.

Reuse walt.id presentation and verification with the proved holder binding. No custom cryptography, hardcoded success, client-only verdict or extra credential formats. Submission success alone is not verification success.

## Acceptance checks

| ID | When / condition | Required result |
|---|---|---|
| F7-AC01 | A valid approved presentation passes real verification | Use the correct holder proof and show Verified only for success of that same verifier request. |
| F7-AC02 | Delivery succeeded but the verifier is still processing | Show pending, not Verified. |
| F7-AC03 | The verifier rejects the presentation | Show Verification failed and an available safe reason. |
| F7-AC04 | The service cannot be reached or the result is inconclusive | Show service/timeout feedback distinct from verification rejection and success. |
| F7-AC05 | A result belongs to another visitor or an earlier attempt | Do not reveal it or use it to mark the current attempt Verified. |

## Reuse and verification

Depends on F5 request and F6 approval. Use the [existing proof’s verifier result mapping](../../../pocs/README.md) and a bounded check of the current request. F8 finishes consistent error behavior; no background poller service is needed.

Record actual outcomes in the [acceptance ledger](../../workitem/acceptance-results.md). Reuse one walkthrough or focused check for multiple criteria where appropriate; no separate test or evidence file is required for each row. Shared [acceptance rules](../acceptance.md) still apply.
