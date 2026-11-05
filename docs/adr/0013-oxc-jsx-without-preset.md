# ADR-0013: Oxc JSX transform instead of @preact/preset-vite

- Status: Accepted
- Date: 2026-11-05

## Context

Vite 8 transforms TypeScript and JSX with Oxc. `@preact/preset-vite` adds a Babel pipeline,
Prefresh hot reloading and React aliasing, none of which the production build needs.

## Decision

Configure `oxc.jsx` with `runtime: 'automatic'` and `importSource: 'preact'` in `vite.config.ts`
and do not install `@preact/preset-vite` (and therefore no Babel).

## Consequences

- Fewer dependencies and a faster build; the same transform runs in Vitest.
- During development a code change reloads the page instead of hot-swapping components
  (no Prefresh). The persisted state makes this harmless.
