# ADR-0003: TypeScript 6.0

- Status: Accepted
- Date: 2026-11-05

## Context

The brief requires TypeScript strict mode and ESLint with typescript-eslint `strictTypeChecked`.
TypeScript 7 (the native port, 7.0.2 at build time) does not expose the JavaScript compiler API
that typed linting relies on, and typescript-eslint 8.72 declares the peer range
`typescript >= 4.8.4 < 6.1.0`.

## Decision

Pin `typescript@6.0.3`, the latest release inside the supported range. Both `tsconfig.json` (app)
and `tsconfig.node.json` (configs, scripts, E2E) set every option explicitly instead of relying on
the changed TypeScript 6 defaults: `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`,
`verbatimModuleSyntax`, `moduleResolution: bundler`.

## Consequences

- Typed linting and `tsc --noEmit` share one compiler.
- Moving to TypeScript 7 waits for typescript-eslint support and is a toolchain-only change.
