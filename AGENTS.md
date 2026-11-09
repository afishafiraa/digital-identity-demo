# Project working rules

Read the PRD, relevant feature guide, shared acceptance criteria, and architecture before implementation. Keep changes within the documented wallet MVP. Local implementation is authorized; the real walt.id integration gate and runtime blockers remain recorded in `docs/workitem/local-foundation.md`. Do not claim simulated results or incomplete acceptance criteria have passed.

Implement features one at a time in F1–F9 order. Complete and verify the current feature before moving to the next; if blocked, keep the current feature open and record the blocker rather than starting another. Prerequisite integration evidence is not permission to implement multiple product features together.

Favor the smallest working demo: one wallet page, thin server calls to the existing walt.id services, and no extra service or general workflow/recovery framework. Reuse working integration/session code and useful tests. Finish the current user-visible step before adding infrastructure or abstractions. The revised architecture and demo plan govern further work.

Name feature documents with `F<number>-<descriptive-feature-name>` and a purpose suffix for related work (for example `F1-start-and-resume-demo-session-verification.md`). Include the feature name alongside its ID in titles and progress updates; preserve existing acceptance IDs.

Follow `docs/arch/typescript-standards.md`, `tsconfig.json`, and `eslint.config.mjs` for every change, including tests and scripts:

- No explicit `any`, non-null assertions, unchecked type assertions, TypeScript suppression comments, or inline lint disables. `as const` is allowed for literal inference.
- Treat JSON, external responses, database rows, and caught errors as `unknown` until narrowed or decoded. A type assertion is not validation.
- Handle promises and failures explicitly; keep credentials and keys server-side.
- Do not weaken configuration or add exclusions to make a check pass. Fix the code and record genuine environment blockers.
- Run the applicable checks and keep verification evidence accurate. Do not claim full lint/build success from offline compatibility checks.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
