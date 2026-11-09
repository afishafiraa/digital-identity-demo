# F8-handle-pending-expiry-and-failures — Handle pending, expiry and failures

Updated: 2026-11-08. Status: Pending final cross-flow check; basic handling is added within each feature.

Source: [PRD](../prd.md), PRD section 7 (F8), section 9, and section 10 checks 4–6. Apply the shared rules in the [feature index](README.md).

## Small implementation

Use the existing wallet page’s loading/status/error text and a clear Retry or Check again action. Distinguish pending, rejected, expired and unavailable outcomes. Apply this during each feature, then check consistency here.

Reuse current request limits and error helpers. No separate error page, retry worker, monitoring dashboard, generalized recovery framework or new service. Keep timeout settings in configuration/code rather than adding another management interface.

## Acceptance checks

| ID | When / condition | Required result |
|---|---|---|
| F8-AC01 | Verification remains pending past the configured deadline | Stop waiting and show a usable check/retry action without claiming success or rejection. |
| F8-AC02 | Validation fails, a request expires or a service is unavailable | Use distinct readable status text and a sensible next action. |
| F8-AC03 | Issuer2, Wallet2 or Verifier2 is unavailable | Bound waiting, retain accepted credentials and never replace the real result with success. |
| F8-AC04 | A mutation may already have completed | Check its known service/wallet state before another submission; keep uncertainty explicit if it cannot be resolved. |
| F8-AC05 | Reset or a new attempt replaces an in-flight operation | Stop/ignore obsolete work so it cannot overwrite the current result. |

## Reuse and verification

Applies across F1–F7 and F9. Reuse existing tests and request handling. A targeted fault check may exercise several criteria; it does not require a new test framework or a large failure matrix per feature.

Record actual outcomes in the [acceptance ledger](../../workitem/acceptance-results.md). Reuse one walkthrough or focused check for multiple criteria where appropriate; no separate test or evidence file is required for each row. Shared [acceptance rules](../acceptance.md) still apply.
