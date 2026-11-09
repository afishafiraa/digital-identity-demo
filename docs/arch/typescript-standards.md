# TypeScript implementation rules

These rules apply to app code, server code, scripts, and tests. They implement the owner's request for strict, clean TypeScript and are part of the project's implementation contract.

## Compiler enforcement

`tsconfig.json` enables `strict`, including implicit-any prevention, strict null checks, strict function typing, and unknown catch variables. It also enables:

- `noUncheckedIndexedAccess` and `noPropertyAccessFromIndexSignature`: indexed or environment values must be checked explicitly.
- `exactOptionalPropertyTypes`: omission and explicitly passing `undefined` are distinct contracts.
- `noUnusedLocals`, `noUnusedParameters`, and `noImplicitReturns`: remove dead code and cover return paths.
- `noImplicitOverride`, `noFallthroughCasesInSwitch`, and `forceConsistentCasingInFileNames`: make overrides, control flow, and import names explicit.
- `verbatimModuleSyntax`: separate runtime imports from `import type` dependencies.

`skipLibCheck` skips checking the internal consistency of third-party declaration files. It does not exclude our source, tests, or scripts from checking. Generated Next.js declarations remain in the compiler inputs; generated outputs are excluded from linting.

## Lint enforcement

TypeScript's `noImplicitAny` does not prohibit writing explicit `any`. The type-aware ESLint configuration therefore separately rejects:

- Explicit `any` and unsafe assignments, arguments, calls, member access, or returns involving `any`.
- Non-null assertions and unchecked type assertions, including double assertions. Literal `as const` inference remains allowed.
- TypeScript suppression comments, including `@ts-ignore`, `@ts-nocheck`, and `@ts-expect-error`.
- Unhandled promises and promises used in incompatible callback positions.
- Inline ESLint configuration that could bypass these rules.

Use `unknown` at JSON/service/database boundaries, then narrow or validate it. Keep validation focused on the actual contract. Tests must also decode response payloads rather than relying on the library's `any` JSON return type. Use guards or assertion functions for required values rather than postfix `!`.

## Required checks

Run `npm run lint` and `npm run typecheck`; `npm run check` includes both, backend tests, environment validation, and the app build. Lint exits unsuccessfully on warnings. Fix the underlying code instead of disabling a rule or loosening the compiler.

Dependencies are installed and the full type-aware lint, strict compiler, backend tests and production build pass. Earlier offline compatibility checks are historical evidence only; they no longer substitute for installed-dependency validation. See the [F1 completion record](../workitem/F1-start-and-resume-demo-session-verification.md).

The configuration uses the standard [typescript-eslint typed rules](https://typescript-eslint.io/users/configs/) with selected safety rules; it introduces no custom lint engine.
