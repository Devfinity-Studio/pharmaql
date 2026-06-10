# Architecture

**Date Mapped:** 2026-06-07

## Overview

The application follows the Create T3 App architecture, utilizing Next.js App Router for the frontend and server-side rendering, and tRPC for end-to-end typesafe API communication.

## Key Layers

1. **Presentation Layer (Frontend):**
   - Next.js App Router (`src/app/`)
   - React Server Components by default, with Client Components where interactivity is needed.
   - Styling handled by Tailwind CSS v4.

2. **API Layer:**
   - tRPC server setup (`src/server/api/`)
   - Endpoints defined in routers and exposed via a unified AppRouter.

3. **Data Access Layer:**
   - Drizzle ORM (`src/server/db/`)
   - PostgreSQL adapter for database connections.

4. **Authentication:**
   - Integrated with `better-auth` handling user sessions securely.
