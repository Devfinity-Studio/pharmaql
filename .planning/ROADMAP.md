# Roadmap

## Phase 1: Database Schema & Authentication

- Set up Drizzle schema for Users, Roles, Products, Sales, and Orders.
- Implement Better Auth with credential support for MR authentication.
- Create initial Admin user via seeding or script.

## Phase 2: Admin Data Ingestion

- Build API routes for parsing CSVs from Technomax.
- Implement business logic to populate Stock, Sales, and Free Schemes data into the DB.

## Phase 3: MR Dashboard & Order Placement

- Build the MR portal UI (responsive for mobile/desktop) using Stitch MCP.
- Implement row-level or query-level data isolation for MR sales views.
- Build form and server actions for MRs to create/edit sales and place orders.

## Phase 4: Admin Global Dashboard & Order Management

- Build Admin reporting UI (per-company, per-MR).
- Implement order management dashboard for Admins to view and complete orders.
