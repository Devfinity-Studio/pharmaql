# Code Conventions & Engineering Standards

**Date Mapped:** 2026-10-23  
**Project:** PharmaQL (B2B Medicine Supplier Portal)

---

## 1. Code Style, Formatting & Linting

PharmaQL utilizes **Biome** (`biome.jsonc`) as its unified linter and formatter, replacing ESLint and Prettier.

- **Execution Commands:**
  - Check only: `pnpm check` (`biome check .`)
  - Auto-fix safe: `pnpm check:write` (`biome check --write .`)
  - Auto-fix aggressive/unsafe: `pnpm check:unsafe` (`biome check --write --unsafe .`)
- **Key Formatting Rules:**
  - **Indentation:** Tabs (standard Biome configuration).
  - **Imports:** Automated import organization (`organizeImports: "on"`). Grouping and sorting are strictly enforced.
  - **Attributes:** Sorted JSX/HTML attributes (`useSortedAttributes: "on"`).
  - **CSS / Tailwind:** Automated Tailwind class sorting enabled (`nursery.useSortedClasses: "warn"` on `clsx`, `cva`, and `cn`).
  - **Accessibility:** Selective a11y rule overrides for custom dashboard widgets (`a11y: { recommended: false }`, `suspicious: { noArrayIndexKey: "off" }`).

---

## 2. TypeScript & Type Safety Standards

- **Strict Type Checking:** `pnpm typecheck` (`tsc --noEmit`) validates all files across the repository.
- **Environment Safety:** All runtime environment variables must be registered and validated in `src/env.js` using `@t3-oss/env-nextjs` and `zod`. Direct access to `process.env` in client components is prohibited.
- **Component Prop Typing:** Explicit TypeScript `interface` or `type` definitions for all component props.
- **Discriminated Unions:** Used extensively for domain models (e.g., `MROverdueStatusType = "CLEAN" | "WARNING" | "DIRECT_BLOCKED" | "DIVISION_BLOCKED" | "MANUAL_BLOCKED"`).

---

## 3. Server Actions & BFF Patterns

- **Server-Only Code Isolation:**
  - Files containing sensitive secrets, internal network calls, or direct filesystem access must include `import "server-only";` at the very top (e.g., `src/lib/api-client.ts`).
- **Server Actions Convention:**
  - Server action modules must declare `"use server";` as the first line.
  - Must return a standardized response structure:
    ```typescript
    interface ServerActionResult<T = any> {
      success: boolean;
      data?: T;
      error?: string;
      message?: string;
    }
    ```
  - Never throw unhandled exceptions to the client; all server actions wrap logic in `try ... catch` blocks, log the error with contextual metadata, and return `{ success: false, error: err.message }`.
- **Stateless Session Access:**
  - In server actions and route handlers, sessions must be fetched via `getSession()` from `src/server/auth.ts`.
  - Cookie mutations must use the asynchronous Next.js cookie store (`const cookieStore = await cookies()`).

---

## 4. Database Access & Stored Procedure Conventions

All database interactions executed through `api-server` must strictly adhere to the following connection lifecycle:

```typescript
// Canonical api-server database query pattern
let conn;
try {
  conn = await dbPool.getConnection();
  await conn.query("SET sql_mode = ''"); // Necessary for legacy stored procedures

  const [rows] = await conn.query(sql, params);
  const data = (rows as any)?.[0] || [];
  res.json({ success: true, data });
} catch (error: any) {
  console.error("[Reports API Error]:", error);
  res.status(500).json({ success: false, error: error.message });
} finally {
  if (conn) conn.release(); // CRITICAL: Always release connection back to pool
}
```

- **Date Formatting:** Dates passed into MySQL stored procedures must be converted to ODBC format (`YYYY-MM-DD`) using `formatDateToOdbc()`.
- **Company Code Resolution:** Company parameters must be sanitized and formatted using `resolveCompanyCodeParam()` to handle comma-delimited or string-wrapped legacy inputs.

---

## 5. Resilient Application Storage (`data/`)

To guarantee compatibility with serverless environments (Vercel, AWS Lambda) where the root filesystem is read-only (`EROFS`):

- **Rule:** **NEVER** use `fs.writeFile` or `fs.writeFileSync` directly on paths in `data/`.
- **Standard:** Always read and write application state via `src/lib/server-storage.ts`:
  ```typescript
  import { readServerJson, writeServerJson } from "@/lib/server-storage";

  // Read with safe fallback if file does not exist
  const data = await readServerJson<T>("filename.json", defaultFallback);

  // Write with automatic fallback to os.tmpdir() on EROFS
  await writeServerJson<T>("filename.json", updatedData);
  ```

---

## 6. Client-Side Data & UI Conventions

- **Component File Naming:** Kebab-case for filenames (`stock-report-view.tsx`, `mr-dashboard-content.tsx`), PascalCase for React component function names (`export function StockReportView()`).
- **Styling Standards:**
  - Tailwind utility classes for all styling.
  - Dynamic classes must be combined using the `cn(...)` helper (`clsx` + `tailwind-merge`).
  - Dark mode styles must be declared using the `dark:` prefix.
- **Reporting & Downloads:**
  - Binary reports must provide both **Excel** (`.xlsx` via `exceljs`) and **PDF** (`.pdf` via `jspdf` and `jspdf-autotable`) download formats.
  - Printable reports must include the standardized stationery header (`<ReportStationeryHeader />`).
- **Security & Audit:**
  - Critical actions (login, OTP dispatch, unblock, rate limit exceeded, export downloads) must trigger `recordAuditEvent()` from `src/lib/audit-logger.ts`.
