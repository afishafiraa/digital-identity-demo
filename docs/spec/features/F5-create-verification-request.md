# F5-create-verification-request — Create a verification request

Updated: 2026-11-09. Status: Complete locally; [verification evidence](../../workitem/F5-create-verification-request-verification.md). F6 consent and F7 submission remain pending.

Source: [PRD](../prd.md), PRD sections 5–7 (F5), 9, and 10 checks 1, 4–5. Apply the shared rules in the [feature index](README.md).

## Small implementation

The Verifier tab identifies Harbor Works and contains one Try verification button that creates the Harbor Works request for the sample training credential. Prepare the sharing panel on the same wallet page; send no presentation yet.

Use the existing Verifier2 service and proved credential profile. No verifier portal, query builder, arbitrary request import, QR scanner or second device. F6 owns consent and F7 owns submission/result.

## Acceptance checks

| ID | When / condition | Required result |
|---|---|---|
| F5-AC01 | Try verification succeeds with the sample credential present | Create a real request for the supported training profile and associate it with the current visitor/attempt. |
| F5-AC02 | No matching credential is stored | Block sharing and point to Receive sample credential. |
| F5-AC03 | The request exists but approval has not occurred | Send no presentation and show no Verified result. |
| F5-AC04 | Request creation fails | Keep the credential intact and show a bounded error/retry action. |
| F5-AC05 | A request is expired, replaced or belongs to another session | Do not use it as the current authorized request. |

## Reuse and verification

Depends on F1 ownership and F4 credential access. Reuse the [proved Verifier2 request](../../../pocs/README.md). Keep only the current request reference; add no general request-management subsystem.

Record actual outcomes in the [acceptance ledger](../../workitem/acceptance-results.md). Reuse one walkthrough or focused check for multiple criteria where appropriate; no separate test or evidence file is required for each row. Shared [acceptance rules](../acceptance.md) still apply.
