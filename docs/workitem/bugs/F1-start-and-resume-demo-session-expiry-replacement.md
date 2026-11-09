# F1-start-and-resume-demo-session — Expired-session replacement defect

Status: fixed for coordination metadata; full wallet behavior remains pending F1 integration.

## Reproduction

Create metadata with a known expiry, retain its cookie, advance beyond expiry, then POST `/api/session` with that cookie. The original `SessionStore.start` path also reproduced the issue when called directly with an expired token.

## Expected behavior

Explain that the session is unavailable and require an explicit fresh start. Do not silently create another identity as if the old session resumed.

## Actual behavior

The original implementation treated a missing lookup result as a new visitor and returned newly created metadata. Malformed or duplicate cookies were also reduced to a missing token, permitting replacement.

## Fix

Keep missing, invalid and present cookie states distinct. Reject stale identities transactionally in the store, reject invalid cookies in the handler, and expose explicit read states. Preserve the original session's absolute expiry during valid resume. No new wallet logic or UI was added.

## Verification

The F1 regression checks in `test/session.test.ts` and `test/session-handler.test.ts` cover expiry, malformed/duplicate/unknown cookie rejection, read states and independent-handle resume. All 22 backend tests and the offline structural typecheck pass. See the [F1 checkpoint](../F1-start-and-resume-demo-session-verification.md) for integration limits.
