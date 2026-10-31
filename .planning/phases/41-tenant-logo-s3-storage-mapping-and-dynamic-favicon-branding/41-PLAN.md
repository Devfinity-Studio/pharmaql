# Phase 41 Plan: Tenant Logo S3 Storage Mapping & Dynamic Favicon Branding

## Overview
Connect tenant logo storage directly to the Neon S3-compatible object storage bucket configured via `.env` (`AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`), enforce `/devfinity.png` as the default platform logo and favicon fallback, and enable dynamic tenant branding across headers, stationery, auth pages, and browser favicons.

---

## 1. Objectives & Deliverables
1. **S3 Object Storage Verification & Integration**:
   - Verify connection and bucket access to `pharmaql-tenant-logos` via `@aws-sdk/client-s3`.
   - Maintain [`src/lib/storage-service.ts`](file:///e:/work/pharmaql/src/lib/storage-service.ts) and server action `uploadTenantLogoAction` in [`src/modules/control-plane/tenantActions.ts`](file:///e:/work/pharmaql/src/modules/control-plane/tenantActions.ts).
   - Ensure tenant logo deletion and updates clean up previous objects or replace keys safely.
2. **Platform Default Logo & Favicon Standardization**:
   - `public/logo.png` was deleted and replaced by `public/devfinity.png`.
   - All standard favicons (`public/favicon.ico`, `public/favicons/*`, `public/icons/*`) match `devfinity.png`.
   - Default fallback across [`src/app/layout.tsx`](file:///e:/work/pharmaql/src/app/layout.tsx), [`src/components/Header.tsx`](file:///e:/work/pharmaql/src/components/Header.tsx), [`src/app/login/page.tsx`](file:///e:/work/pharmaql/src/app/login/page.tsx), [`src/lib/tenant-context.tsx`](file:///e:/work/pharmaql/src/lib/tenant-context.tsx), and [`src/lib/pdf.ts`](file:///e:/work/pharmaql/src/lib/pdf.ts) is `/devfinity.png`.
3. **Dynamic Tenant Branding & Favicon Resolution**:
   - For tenants with an uploaded logo stored in Neon S3: the uploaded URL is served via edge headers (`x-tenant-logo`) and resolved in `layout.tsx` for `<link rel="icon">`, `<link rel="apple-touch-icon">`, and OpenGraph/metadata.
   - For tenants without an uploaded logo (or when accessing the Dev Portal): `/devfinity.png` is displayed and Devfinity icons are loaded.
4. **Neon Cloud DB Synchronization**:
   - Verified that the Asmee Pharma tenant in the Neon serverless PostgreSQL database (`tenants` table) is mapped to its active S3 logo: `https://br-misty-paper-azxerit1.storage.c-3.ap-southeast-1.aws.neon.tech/pharmaql-tenant-logos/logos/asmee-logo.png`.

---

## 2. Verification Steps
- [x] S3 bucket listing and access test with Neon credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).
- [x] Control Plane database tenant query & update test on Neon PostgreSQL.
- [x] Full TypeScript typecheck (`pnpm exec tsc --noEmit`).
- [x] Vitest suite execution (21 test files, 119 unit tests passing).
- [x] Next.js production build (`next build`).
