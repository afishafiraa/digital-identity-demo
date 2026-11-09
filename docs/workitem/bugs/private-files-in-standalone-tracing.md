# Private files included by broad standalone tracing

Status: fixed and verified locally. Discovered during the first real Next.js production build on 2026-11-08.

## Reproduction

Build with the initial dynamically resolved storage path. Turbopack reports that the filesystem access traces the entire project, which can pull private project directories into a standalone artifact.

## Expected / actual

Expected: runtime packaging includes application dependencies only. Actual: tracing was broad enough to include unrelated project files, creating a risk of packaging private research/runtime state.

## Fix

Avoid an unnecessary dynamic `path.resolve` in configuration. Explicitly exclude private/runtime/research/test/PoC directories from standalone tracing. Keep the Docker context as an allowlist. Add a post-build artifact check that fails on private research/runtime roots, environment files, databases or issuer signing-profile configuration.

These packaging exclusions do not exclude project TypeScript from compiler/lint checks.

## Verification

The final production build passes without the broad-tracing warning. `npm run check:artifact` passes against its real standalone output. The local Docker build uses only the allowlisted context and succeeds with `npm ci`. See [F1 evidence](../F1-start-and-resume-demo-session-verification.md).
