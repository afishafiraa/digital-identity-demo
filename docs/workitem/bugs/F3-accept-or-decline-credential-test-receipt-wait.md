# F3-accept-or-decline-credential — Await real receipt before UI assertion

Observed during F7 regression checks on 2026-11-09. Status: test synchronization fixed; results are recorded in the F7 evidence record.

After Wallet2 restarted, the acceptance API returned a real 200 receipt in 5.3 seconds. The browser check asserted the received-message UI within five seconds of clicking, so it failed while a successful protocol operation was still finishing. The screenshot showed Checking your credential offer rather than a false receipt or an API rejection.

The test now registers a response waiter before the double click, requires that receipt response to succeed, and then applies the existing UI assertion. Duplicate-POST counting, one-credential storage checks, refresh/replay and subsequent decline assertions remain intact. No test timeout, service deadline, compiler setting or resource cap changed. The real request must still finish within the existing test budget.

Source: `e2e/F3-accept-or-decline-credential.spec.ts`.
