# Repository Guidelines

## Project Structure & Module Organization

DraftPort is a pnpm/Turbo monorepo. `apps/web` contains the React + Vite editor UI, including component, hook, service, storage, and bootstrap tests under `apps/web/src/__tests__`. `apps/electron` contains the desktop shell and Node test files beside the relevant source modules. `apps/server` is a NestJS image upload service with unit tests in `src` and e2e tests in `test`. Shared Markdown parsing, theme, and rendering logic lives in `packages/core`. Theme templates live in `templates`; release and automation files live in `.github`.

## Build, Test, and Development Commands

- `pnpm install`: install workspace dependencies with pnpm 9.
- `pnpm dev:web`: start the Vite web app.
- `pnpm dev:desktop`: start the desktop development flow.
- `pnpm build`: run all package builds through Turbo.
- `pnpm lint`: run workspace lint tasks through Turbo.
- `pnpm format`: run Prettier on TypeScript, TSX, and Markdown files.
- `pnpm --filter @draftport/web test`: run web Vitest tests.
- `pnpm --filter @draftport/core test`: run core Vitest tests.
- `pnpm --filter @draftport/server test`: run server Jest tests.
- `pnpm --filter draftport-electron test`: compile and run Electron Node tests.

## Coding Style & Naming Conventions

Use TypeScript for application and package code. Follow existing local style: React components use `PascalCase`, hooks use `useCamelCase`, services and utilities use descriptive `camelCase` names, and tests mirror the feature name. ESLint is configured at the root and per server package; Prettier is the formatter. Avoid broad utility modules when a feature-owned module is clearer.

## Testing Guidelines

Prefer focused tests near the affected domain. Web and core tests use Vitest and usually live in `src/__tests__` with `*.test.ts` or `*.test.tsx`. Server unit tests use `*.spec.ts`; server e2e tests use `*.e2e-spec.ts`. Electron tests use `*.test.ts` and run after TypeScript compilation. Add regression tests for behavioral fixes before changing implementation when feasible.

## Commit & Pull Request Guidelines

Recent history uses short imperative subjects, often Conventional Commit prefixes such as `feat:`, `fix:`, `fix(web):`, `test:`, and `chore:`. Keep commits scoped to one change. Pull requests should describe the user-facing change, list validation commands run, link relevant issues, and include screenshots or recordings for visible UI changes.

## Agent-Specific Instructions

Before editing, inspect the relevant module and keep the change surface narrow. Do not overwrite unrelated local changes. Validate with the smallest meaningful command first, then broader checks when the change affects shared behavior.
