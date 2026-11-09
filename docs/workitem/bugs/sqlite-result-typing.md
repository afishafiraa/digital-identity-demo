# SQLite query result typing

Status: fixed; offline strict typecheck and backend regression tests pass. Discovered: 2026-11-08 JST.

## Reproduction

Run a strict TypeScript check of `src/server/core/session.ts` with TypeScript 5.7.2 and the locally available Node 22.10.1 declarations.

## Expected behavior

The owned SQLite queries should typecheck without weakening strict mode.

## Actual behavior

`StatementSync.get()` returned an untyped object in those declarations. Access to `expires_at` and `count` produced TS2339 errors.

## Fix

Decode both query results from unknown using runtime object/integer guards. The strict TypeScript follow-up replaced the initial shape assertions. Keep expiry and count as validated safe non-negative integers; do not disable strict checking or use `any`.

## Verification

The same strict backend typecheck passes. The 18 backend tests pass, including metadata expiry, capacity, isolation and persistence. Full installed-dependency validation is still blocked as described in the [foundation checkpoint](../local-foundation.md).
