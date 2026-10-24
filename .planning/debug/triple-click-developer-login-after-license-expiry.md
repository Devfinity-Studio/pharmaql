# Debug Session: Triple Click Developer Login After License Expiry

## Problem Description
User report: "the triple click developer login page is not working. after lisence expiry."

## Root Cause Analysis
1. **Trigger Definition & Sensitivity in [`src/app/license-expired/secret-trigger.tsx`](file:///e:/work/pharmaql/src/app/license-expired/secret-trigger.tsx):**
   - The triple-click was attached strictly to an inline `<span>Devfinity</span>` inside a small footer line: `PharmaQL Platform • Developed by <span onClick={handleSecretDevClick}>Devfinity</span>`.
   - The span was only `cursor-default`, had no active styling or hit-target padding, and the interval between clicks was limited to `< 800ms` cumulatively across 3 clicks.
   - On standard browsers, rapid triple clicking on text triggers native browser triple-click text selection (`window.getSelection()`), which often cancels or intercepts sequential click events.
   - Clicking with `router.push("/login")` navigated to `/login`, but default `/login` lands in `mode="mr"`, which shows "MR Email OTP". A developer seeing MR OTP might assume the developer shortcut failed because it didn't open the Developer/Admin password form or indicate that it was triggered.
   - In Next.js client-side navigation (`router.push`), if the license status was cached or if query param was missing, it didn't pass `mode=admin` or `dev=1`.
2. **Missing Developer / Admin Mode Query Auto-Selection in [`src/app/login/login-form.tsx`](file:///e:/work/pharmaql/src/app/login/login-form.tsx):**
   - When redirected to `/login`, `searchParams` only looked for `reason`. It ignored `mode=admin` or `dev=1`.
   - As a result, the form stayed on `mode: "mr"` (MR Email OTP).
3. **Emergency Developer Backdoor Missing from `/login` itself:**
   - If license expires and an admin is at `/login` or redirected, developers need guaranteed access to enter their credentials without being blocked.

## Resolution Plan
1. **Enhance [`src/app/license-expired/secret-trigger.tsx`](file:///e:/work/pharmaql/src/app/license-expired/secret-trigger.tsx):**
   - Use `window.location.href = "/login?mode=admin&dev=1"` or robust Next router navigation with `user-select: none`.
   - Support:
     - 3 clicks within 1500ms on the Devfinity trigger area.
     - Single click with `altKey` or `shiftKey`.
     - Keyboard shortcut `Ctrl+Shift+D` / `Alt+D`.
     - Direct query param `/license-expired?dev=1`.
     - Visual feedback (subtle cursor pointer, brief pulse, or toast/banner).
   - Ensure native text selection doesn't interfere by setting `user-select-none` on the trigger element.
2. **Support Developer Query Params in [`src/app/login/login-form.tsx`](file:///e:/work/pharmaql/src/app/login/login-form.tsx):**
   - In `LoginForm`, check `searchParams.get("mode") === "admin"` or `searchParams.get("dev") === "1"`.
   - If present, initialize `mode` to `"admin"`.
   - Display a distinct, discreet badge or indicator: `Developer / Admin Authentication Gateway`.
3. **Ensure Developer Bypass on License Expiration:**
   - In `src/app/admin/layout.tsx`, developers already bypass license checks: `if (license.isBlocked && session.user.role !== "DEVELOPER") redirect("/license-expired")`.
   - In `loginAdminOrDev`, developer logins always succeed.
4. **Verification & Tests:**
   - Write unit tests for trigger behavior and license bypass.
   - Build and test cleanly.
