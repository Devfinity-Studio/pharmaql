# Requirements

## Epic: Core B2B Medical Supplier Portal

### User Stories

1. **As an Admin,** I want to upload CSV files from Technomax so that the system is populated with the latest sales, stock, and free scheme data.
2. **As an Admin,** I want to create accounts for Medical Representatives (MRs) so they can log in.
3. **As an Admin,** I want to view global reports for stock, free schemes, per-company, and per-MR data so I can manage my business.
4. **As an Admin,** I want to view and update the status of incoming orders so I can fulfill them.
5. **As an MR,** I want to log in using my username and password so I can access my dashboard securely.
6. **As an MR,** I want to view my isolated sales reports so I can track my performance.
7. **As an MR,** I want to create and edit my sales data directly in the system.
8. **As an MR,** I want to view available products (stock and free schemes) and place new orders.

### Acceptance Criteria

- **Data Isolation:** An MR must NEVER be able to query, access, or view data that belongs to another MR. This must be enforced at the Drizzle ORM query level.
- **Admin Ingestion:** The system must accept CSV uploads and correctly parse/insert data into the database for stock, sales, and free schemes.
- **Better Auth Integration:** Roles (Admin and MR) must be fully implemented, and routes/APIs must be protected based on these roles.
- **Responsive UI:** The dashboard must be fully usable on both mobile and desktop views, utilizing Tailwind CSS.
- **MCP Usage:** The design and layout should leverage the Stitch MCP to generate screens or design systems where appropriate.

## Definition of Done

- Drizzle schema is implemented and migrations are run.
- Better Auth is configured.
- CSV ingestion endpoint is built.
- Admin dashboard pages are built.
- MR dashboard pages are built.
- Order creation and status updating flows are functional.
- All code is functional with NO placeholders.
