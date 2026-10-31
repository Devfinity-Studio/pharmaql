# Phase 41: Tenant Logo S3 Storage Mapping & Dynamic Favicon Branding - Context

## Objectives
1. Map tenant logo URLs to the Neon S3-compatible object storage bucket using the credentials configured in `.env` (`AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).
2. Implement server actions / API endpoints to upload, update, and retrieve tenant logos from the S3 bucket directly or via presigned upload/public URLs.
3. Make `devfinity.png` the default platform logo and update default favicons across the application to match `devfinity.png`.
4. Implement dynamic logo and favicon resolution:
   - For tenants with an uploaded logo: their uploaded logo is used as their primary header/portal logo and dynamic browser favicon.
   - For tenants without an uploaded logo (or on the developer portal): `devfinity.png` and Devfinity favicons are loaded by default.
