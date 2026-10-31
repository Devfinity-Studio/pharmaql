# Deployment Workflow Guidelines

Strict adherence to the 3-stage promotion workflow is mandatory across all tasks:

```
[dev] (Active Development)
  │
  ▼ Verify on localhost (tests, typecheck, dev/build sanity)
[prod] (Preview Deployment on Vercel)
  │
  ▼ Verify preview deployment on Vercel
[deploymment] (Production Deployment on Vercel)
```

### Stage 1: Development (`dev`)
- Always make code modifications and write new features on the `dev` branch.
- Test and verify thoroughly on `localhost`:
  - Run unit test suite: `pnpm test`
  - Run typecheck: `pnpm exec tsc --noEmit`
  - Run production build check: `pnpm run build`
  - Test live interactions or local server as needed.

### Stage 2: Staging / Preview (`prod`)
- **Condition:** Only merge `dev` into `prod` after localhost checks pass cleanly.
- Pushing to `prod` triggers a Vercel preview deployment.
- Verify the live preview deployment URL and logs on Vercel.

### Stage 3: Production (`deploymment`)
- **Strict Rule:** **Only and only if** the Vercel preview deployment on `prod` works and verifies with zero errors, merge `prod` into `deploymment`.
- Pushing to `deploymment` initiates the public production deployment.
- Never commit directly to `deploymment`.
