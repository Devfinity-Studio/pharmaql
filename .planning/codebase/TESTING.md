# Testing

**Date Mapped:** 2026-06-07

## Current State
- No formal testing framework (e.g., Jest, Vitest, Playwright) is currently configured in `package.json`.

## Static Analysis
- **Type Checking:** `pnpm typecheck` (`tsc --noEmit`)
- **Linting:** `pnpm check` (`biome check .`) ensures code quality and catches syntax/formatting issues before runtime.
