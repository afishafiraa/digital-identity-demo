# F4-list-and-inspect-stored-credentials — List and inspect stored credentials

Updated: 2026-11-08. Status: Complete locally; see [stored data, refresh, isolation and failure evidence](../../workitem/F4-list-and-inspect-stored-credentials-verification.md).

Source: [PRD](../prd.md), PRD sections 4–7 (F4), 9, and 10 checks 1, 6–7. Apply the shared rules in the [feature index](README.md).

## Small implementation

Show the sample credential as a simple card on the wallet page. Expand its details inline to show issuer, stored claims, dates and validity facts actually known. Show a useful Receive action when empty.

Read the current wallet through the existing server integration. No new credential database, separate details page, search, analytics, credential editor or revocation service. Do not infer “not revoked” from a successful read.

## Acceptance checks

| ID | When / condition | Required result |
|---|---|---|
| F4-AC01 | The wallet is empty | Show an explanation and Receive sample credential. |
| F4-AC02 | The visitor expands an accepted credential | Issuer, claims and dates match the stored credential in their wallet. |
| F4-AC03 | Issuance is pending or failed | Do not label that operation as a received credential. |
| F4-AC04 | The visitor refreshes | Read the same wallet and preserve a consistent credential card/details view. |
| F4-AC05 | A validity fact is unknown or a wallet read fails | Say what is unknown or unavailable; do not turn a read failure into an empty/valid wallet. |

## Reuse and verification

Depends on F1-start-and-resume-demo-session and F3-accept-or-decline-credential. Parse only the proved SD-JWT profile. F7 owns the presentation verdict.

Record actual outcomes in the [acceptance ledger](../../workitem/acceptance-results.md). Reuse one walkthrough or focused check for multiple criteria where appropriate; no separate test or evidence file is required for each row. Shared [acceptance rules](../acceptance.md) still apply.
