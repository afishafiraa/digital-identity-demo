# F1-start-and-resume-demo-session — Start and resume a demo session

Updated: 2026-11-08. Status: Complete and verified locally; reuse the working implementation.

Source: [PRD](../prd.md), PRD sections 5–7 (F1), 9, and 10 checks 6–7. Apply the shared rules in the [feature index](README.md).

## Small implementation

The entry state and connected/empty-wallet state on the same wallet page. Start demo creates an isolated real wallet; refresh resumes it. Show clear progress, expiry and retry text.

Keep the existing cookie, ownership lookup and provisioning checks. Add no login, account settings, new session service or general recovery framework. This guide does not request a rewrite of tested F1 code.

## Acceptance checks

| ID | When / condition | Required result |
|---|---|---|
| F1-AC01 | Start demo succeeds for a new visitor | Their real wallet is created and the wallet page shows a useful connected/empty state. |
| F1-AC02 | The same visitor refreshes or repeats Start demo | The same wallet and any accepted credential remain; no second wallet is silently created. |
| F1-AC03 | Two visitor sessions use the app | They have separate wallets; one cannot access or change the other through supplied IDs. |
| F1-AC04 | A start request fails or its result is uncertain | Explain the failure and check the existing allocation before creating again; show a retry/check action without claiming success. |

## Reuse and verification

Reuse the [completed F1 evidence](../../workitem/F1-start-and-resume-demo-session-verification.md). F4 adds credential display and F9 adds reset; do not implement them as part of F1.

Record actual outcomes in the [acceptance ledger](../../workitem/acceptance-results.md). Reuse one walkthrough or focused check for multiple criteria where appropriate; no separate test or evidence file is required for each row. Shared [acceptance rules](../acceptance.md) still apply.
