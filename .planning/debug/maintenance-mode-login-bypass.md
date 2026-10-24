# Debug Session: Maintenance Mode Bypass & Toggle UX

## Symptoms
1. "turning on the maintainance mode doesnt do anything all the mrs and admins are able to login."
2. "also instead of just save maintainesnce settings button make it turn on maintainance mode and if on make turn off"

## Initial Findings & Hypotheses
1. `authActions.ts` has zero checks for `isUnderMaintenance()` during login (`requestMrOtp`, `verifyMrOtp`, `loginAdminOrDev`).
2. When maintenance mode is active (`mode: "MRS_ONLY"` or `mode: "ALL_USERS"`), users can still request OTPs, verify OTPs, and login with password, receiving full session cookies.
3. Once logged in, `MRLayout` (`src/app/(mr)/layout.tsx`) and `AdminLayout` (`src/app/admin/layout.tsx`) check `isUnderMaintenance(session.user.role)`:
   - But if a user is logging in, they are not stopped at `/login`, and if `mode` is `MRS_ONLY`, Admins are not stopped.
   - If `mode` is `ALL_USERS`, MRs and Admins should see the maintenance screen if layout re-renders. BUT in Next.js App Router, layout or route caching may not re-check dynamically unless `dynamic = "force-dynamic"` or storage revalidation happens.
   - Also, `authActions.ts` (the login actions) allows login to proceed and succeed completely!
4. UI Improvement:
   - In `dev-control-center.tsx`, the button is currently a static "Save Maintenance Settings" button with a separate select dropdown for `mode`.
   - The user wants a direct Turn On / Turn Off toggle button:
     - When maintenance is OFF (`mode === "DISABLED"`): clicking "Turn On Maintenance Mode" sets mode (e.g. to configured audience or ALL_USERS/MRS_ONLY) and activates it.
     - When maintenance is ON (`mode !== "DISABLED"`): clicking "Turn Off Maintenance Mode" sets mode to "DISABLED".
     - Real-time feedback and dynamic label reflecting the status.

## Root Cause Identified
1. **Zero Maintenance Check in Auth Actions:**
   - In `src/server/actions/authActions.ts`, `requestMrOtp` and `verifyMrOtp` never called `isUnderMaintenance("MR")`. MRs could request OTPs, complete OTP verification, and receive valid 7-day session cookies even with maintenance enabled.
   - In `loginAdminOrDev`, standard Admins were never checked against `isUnderMaintenance("ADMIN")`, allowing password logins to succeed during `ALL_USERS` maintenance.
2. **Missing Route Cache Invalidation:**
   - In `src/server/actions/devDiagnostics.ts`, `saveMaintenanceConfigAction` did not trigger `revalidatePath` across layouts and auth routes, so active sessions or cached pages could retain previous state.
3. **UX Gap in Dev Control Center:**
   - The UI only presented a static "Save Maintenance Settings" button with a select dropdown, without a direct "Turn On / Turn Off Maintenance Mode" toggle button.

## Resolution
1. **Auth Actions Enforcement (`src/server/actions/authActions.ts`):**
   - Added `isUnderMaintenance("MR")` check to `requestMrOtp` and `verifyMrOtp`. Both immediately fail with the configured maintenance message when maintenance is active for MRs.
   - Added `isUnderMaintenance("ADMIN")` check to `loginAdminOrDev` for `ADMIN` role. Developers (`role: "DEVELOPER"`) always bypass maintenance mode.
2. **Cache Invalidation (`src/server/actions/devDiagnostics.ts`):**
   - Added revalidation for `"/"` layout, `"/login"`, `"/dashboard"`, `"/admin/dashboard"`, and `"/admin/dev"` whenever maintenance configuration changes.
3. **Dynamic Toggle UI (`src/components/dev-control-center.tsx`):**
   - Implemented dynamic toggle action `handleToggleMaintenance`:
     - When OFF (`mode === "DISABLED"`): Renders a **"Turn On Maintenance Mode"** button (rose button with power icon and confirmation prompt) that activates maintenance.
     - When ON (`mode !== "DISABLED"`): Renders a **"Turn Off Maintenance Mode"** button (emerald button with power icon) that resets `mode: "DISABLED"`.
     - Preserved a secondary **"Save Maintenance Details"** button for updating audience, completion time, reason, or public message without toggling.
     - Added real-time current status indicator tag.
4. **Automated Unit Tests (`src/lib/__tests__/maintenance.test.ts`):**
   - Added tests verifying `isUnderMaintenance` for `DISABLED`, `MRS_ONLY`, and `ALL_USERS`, confirming MR and Admin blocking while asserting Developer bypass.

## Verification
- `pnpm test`: All 8 test suites and 39 tests passed (100% green).
- `pnpm build`: Next.js production build succeeded with zero type or lint errors.
