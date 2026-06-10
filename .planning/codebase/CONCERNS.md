# Concerns

**Date Mapped:** 2026-06-07

## Technical Debt & Known Issues

- **Testing:** The project currently lacks automated unit or integration tests. Adding Vitest or Playwright would improve reliability.
- **Empty State:** As a freshly initialized Create T3 App, there are no immediate structural concerns, but custom business logic needs to be layered carefully to maintain the clean architecture.

## Security

- Authentication relies on GitHub OAuth via `better-auth`. Ensure environment variables (`BETTER_AUTH_SECRET`, etc.) are properly secured in production environments.
