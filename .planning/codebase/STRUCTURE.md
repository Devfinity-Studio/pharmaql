# Structure

**Date Mapped:** 2026-06-07

## Directory Layout

- `src/app/`: Next.js App Router pages and layouts.
- `src/server/`: Backend server logic.
  - `src/server/api/`: tRPC routers and context setup.
  - `src/server/db/`: Drizzle ORM schema, migrations, and database connection instance.
- `src/trpc/`: tRPC client setup and React Query integration for the frontend.
- `src/styles/`: Global CSS and Tailwind directives.

## Configuration Files

- `package.json`: Project dependencies and scripts.
- `biome.jsonc`: Biome formatting and linting rules.
- `drizzle.config.ts`: Drizzle Kit configuration for migrations and studio.
- `next.config.js`: Next.js specific configuration.
- `src/env.js`: Environment variables schema validation.
