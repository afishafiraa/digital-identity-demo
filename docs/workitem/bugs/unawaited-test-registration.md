# Unawaited Node test registrations

Status: fixed and verified locally. Discovered when dependency access restored full type-aware linting on 2026-11-08.

## Reproduction

Install the project dependencies and run `npm run lint` on the earlier Node test files.

## Expected / actual

Expected: every promise follows the project's no-floating-promises rule. Actual: top-level `node:test` registrations returned unhandled promises and lint reported errors.

## Fix

Await Node test registration at the top level. Do not suppress the rule or use an unchecked assertion. Browser test registration uses Playwright's separate synchronous API.

## Verification

Strict lint and all 29 Node backend tests pass. The full project check also passes. See [F1 evidence](../F1-start-and-resume-demo-session-verification.md).
