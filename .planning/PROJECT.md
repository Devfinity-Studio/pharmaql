# Project Context: B2B Medicine Supplier Portal

## What This Is
A B2B portal for a medicine supplier to manage Medical Representatives (MRs), inventory, and sales data. 

**Core User Roles:**
1. **Admin (Supplier):** Global visibility. Can upload data from "Technomax" (CSV), create MR accounts, view global reports, stock, free schemes, and manage incoming orders.
2. **Medical Representative (MR):** Isolated visibility. Can log in to view their specific reports, view stock, edit/create their sales data, and place orders for products. 

**Key Technical Requirements:**
- **Framework:** Next.js App Router
- **Database/ORM:** PostgreSQL + Drizzle ORM
- **Auth/RBAC:** Better Auth (username/password for MRs)
- **Styling:** Tailwind CSS (Responsive: Mobile and Desktop)
- **Data Isolation:** Strict row-level or query-level data isolation for MRs.
- **Design:** Utilize Stitch MCP for UI design and layout.

## Requirements

### Validated
- ✓ Next.js App Router structure initialized
- ✓ Drizzle ORM configured
- ✓ Tailwind CSS configured

### Active
- [ ] Implement Drizzle Schema (Users, Products, Sales, Orders)
- [ ] Configure Better Auth for Admin and MR roles (username/password)
- [ ] Build Admin Data Ingestion API (Technomax CSV upload for sales, stock, schemes)
- [ ] Build MR Dashboard (isolated sales view, create/edit sales, place orders)
- [ ] Build Admin Global Dashboard (global reports, order management)
- [ ] Ensure mobile and desktop responsive layouts

### Out of Scope
- [ ] Payment Processing — The system handles orders but no actual payments.
- [ ] Automated Free Scheme Calculation — Free schemes are currently treated as display data imported from Technomax.

## Key Decisions
| Decision | Rationale | Outcome |
|----------|-----------|---------|
| MR Account Creation | Admins create accounts (username/password) for MRs. | Easier onboarding control for the supplier |
| Data Isolation | Enforced at the Drizzle query level. | Maximum security to ensure MRs don't see each other's data |
| Free Schemes | Imported as raw data from Technomax for now. | Simplifies initial scope, can add calculation engine later |

---
*Last updated: 2026-06-07 after initialization*

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
