# F9-reset-current-demo — Verification

Date: 2026-11-09. Implemented after the owner explicitly requested GitHub publication, Vercel deployment and then reset for today's demo. This changes the usual sequence only for F9; F8 and full shared release acceptance remain pending.

## Behavior and retention

**Reset demo** calls the same-origin, cookie-owned `POST /api/session/reset` with exactly `{}`. One atomic SQLite update expires only that session; the response clears its cookie. The UI immediately unmounts all wallet panels, aborting their reads and preventing late old responses from reaching a new wallet. **Start demo** creates a new isolated identity and empty wallet. Reset needs no service restart, volume deletion or Docker rebuild.

Old coordination bindings, credentials and keys remain in the existing private Docker volumes; reset retires access rather than claiming physical erasure. Issuer/verifier in-memory records retain their existing service lifecycle. Sessions last 24 hours with a 100-active-session cap. Retired wallet/key data has no automatic purge; repeated resets grow retained storage. This is a temporary presentation deployment, not completion of S-AC10's abandoned-state cleanup/release gate. No unrelated visitor state is deleted.

An uncertain reset reply shows **Reset not confirmed** and permits a read-only status check, never automatic replay. Confirmed retirement permits an explicit fresh start. A definite failed operation can be inspected by reloading the same session; no premature completion is shown.

## Actual results

- Strict lint and TypeScript checks passed after the final test edits.
- Backend suite: **61/61 passed**, including origin/body/query rejection, repeated reset, other-owner preservation, retirement across store restart, old-operation rejection and released active-session capacity.
- Vercel production build succeeded with Next.js 16.4.5, Node 22 and `/api/session/reset` present. Public UI: **https://digital-identity-demo.vercel.app**. Existing Docker app image updated once to install the feature; subsequent resets in the checks made no Docker changes.
- Two focused Chromium checks passed against the public domain. The first completed real issue → accept → approve → present → Verified for visitors A and B, held A's actual old result response, reset A with two immediate button clicks (one POST), then released the old response. No old Verified state returned. Refresh preserved retirement; a new wallet ID had zero credentials and completed a fresh real verified exchange. B retained its wallet ID, exact credential response and Verified result. A 390 × 844 viewport had no horizontal overflow; screenshot retained privately under `.local/evidence/F9-reset-current-demo-mobile.png`.
- The second controlled browser check returned a reset error without mutating, confirmed no completion or extra POST, then executed a real reset while dropping its browser reply. Read-only reconciliation detected retirement and a fresh wallet could start. The controlled error/lost reply is not claimed as a simulated successful verifier exchange.
- The first browser-check attempt exposed a test route-release race: removing the route handler before fulfillment caused “Route is already handled.” Fixed the fixture to await delivery before removal and corrected the empty-list assertion to the API's array contract. Only that failed check was rerun; the passing failure/reconciliation check was not repeated.

F9-AC01–F9-AC05 pass from the above evidence. Three consecutive reset-separated walkthroughs (S-AC01), F8, complete accessibility review, VPS release and automatic abandoned-state cleanup remain unverified.
