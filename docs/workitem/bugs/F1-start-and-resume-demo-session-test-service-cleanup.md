# F1-start-and-resume-demo-session — Outage-test service cleanup

Observed during F7 regression verification on 2026-11-09. Status: cleanup assertion placement fixed; verification follows the F7 evidence record.

The F1 browser outage test called `docker compose stop wallet`, then asserted success before entering its try/finally. During a loaded local run the CLI returned 130 after stopping the service. The assertion exited before restart cleanup, leaving Wallet2 stopped and causing subsequent session/receipt tests to fail against an unavailable service.

The stop-result assertion now runs inside the existing try/finally, so the test still fails for a nonzero stop result and always attempts the original scoped restart. No timeout, resource cap, assertion or application configuration was weakened. Wallet2 was explicitly restored after the failed run. This is test cleanup, not a new product recovery feature or an assertion that Docker never fails.

Source: `e2e/f1.spec.ts`. This defect was found by the existing full-suite and targeted rerun; there is no new framework or separate mirrored test.
