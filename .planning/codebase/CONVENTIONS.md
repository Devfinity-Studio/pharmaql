# Conventions

**Date Mapped:** 2026-06-07

## Code Style & Linting

- **Formatter/Linter:** Biome (`biome check .`) is used for all code formatting and linting, replacing Prettier/ESLint.
- **TypeScript:** Strict type checking is enabled.
- **Environment Variables:** Must be defined and validated in `src/env.js` using `zod` and `@t3-oss/env-nextjs`.

## API Patterns

- **tRPC:** All new API endpoints should be defined as tRPC procedures in `src/server/api/routers/` to ensure end-to-end type safety.

## Database

- **Migrations:** Managed through Drizzle Kit (`drizzle-kit generate` / `migrate`).
- **Schema:** Defined in TypeScript inside `src/server/db/schema.ts` (or similar).
