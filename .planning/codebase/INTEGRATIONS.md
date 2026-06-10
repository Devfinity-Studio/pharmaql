# Integrations

**Date Mapped:** 2026-06-07

## External Services

- **Database:** PostgreSQL Database
- **Authentication:** GitHub OAuth (via `better-auth`)

## Environment Variables Configuration

Configured in `.env` and typed via `@t3-oss/env-nextjs` in `src/env.js`:

- `DATABASE_URL`: PostgreSQL connection string
- `BETTER_AUTH_SECRET`: Secret for Better Auth
- `BETTER_AUTH_GITHUB_CLIENT_ID`: GitHub OAuth Client ID
- `BETTER_AUTH_GITHUB_CLIENT_SECRET`: GitHub OAuth Client Secret
