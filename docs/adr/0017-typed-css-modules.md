# ADR-0017: Typed CSS modules through a generator

- Status: Accepted
- Date: 2026-11-05

## Context

CSS Modules are required (no CSS framework, no runtime CSS-in-JS). Vite types every module as an
index signature, so with `noUncheckedIndexedAccess` each class is `string | undefined` and a
misspelled class name silently renders unstyled.

## Decision

`scripts/css-module-types.mjs` generates a declaration `x.module.d.css.ts` next to every
`x.module.css` (TypeScript `allowArbitraryExtensions`), listing each class as a `string`. Class
names must be camelCase. `npm run css-types` writes them; `npm run lint` runs the generator with
`--check` and fails when a declaration is stale. Lightning CSS compiles the modules with the
pattern `[local]_[hash]`.

## Consequences

- Class-name typos fail the typecheck; no extra bundler plugin is needed.
- Declarations are committed and excluded from ESLint and Prettier.
