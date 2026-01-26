# Frontend Analysis Report

## STEP 1 — FRONTEND ANALYSIS

### Pages/Routes Overview

**Public Routes:**
- `/` - Landing page
- `/login` - Login page
- `/register` - Registration page
- `/public-library` - Public content library
- `/test` - Public test view

**Protected Dashboard Routes:**
- `/dashboard` - Main dashboard
- `/dashboard/tests` - Tests list
- `/dashboard/tests/[testId]/results` - Test results
- `/dashboard/tests/[testId]/submission` - Test submission
- `/dashboard/assignments` - Assignments list
- `/dashboard/assignments/[assignmentId]` - Assignment detail
- `/dashboard/classrooms` - Classrooms (not implemented)
- `/dashboard/library` - Content library
- `/dashboard/results` - Results overview
- `/dashboard/analytics` - Analytics
- `/dashboard/settings` - Settings
- `/select-organization` - Organization switcher

**Other:**
- `/org/[orgId]/tests/[testId]` - Org-scoped test view
- `/qa/rbac-check` - QA tool

### Key UI Flows

1. **Authentication Flow:**
   - Login → `/auth/login` → `useAuth().login()` → `syncProfile()` → redirect to dashboard
   - Registration → `/auth/register` → `syncProfile()` → redirect
   - Session refresh handled in `httpClient` via `/auth/refresh`
   - Auth state persisted in Zustand store with localStorage

2. **Dashboard Flow:**
   - Protected by `GuardBoundary` → checks auth status → loads data
   - Dashboard fetches `/tests` endpoint conditionally based on permissions
   - Tests page fetches `/tests` unconditionally

3. **Data Fetching:**
   - Uses `httpClient` (wrapper around `fetchWithAuth`)
   - All API calls go through `/lib/http/client.ts`
   - Handles 401 → refresh → retry logic
   - Supports `ApiEnvelope<T>` or raw `T` responses

4. **State Management:**
   - Zustand store for auth (`use-auth-store.ts`)
   - Local component state for data (useState)
   - No global data cache (no React Query/SWR)

### Data Fetching Patterns

**Where data fetching happens:**
- `useAuth()` hook - `/auth/me` endpoint
- Dashboard pages - direct `httpClient.get()` calls in `useEffect`
- Components - inline `fetchWithAuth()` calls

**Common patterns:**
```typescript
// Pattern 1: Conditional fetch with permission check
useEffect(() => {
  if (!canSeeTests) return;
  httpClient.get<TestSummary[]>("/tests").then(setTests);
}, [canSeeTests]);

// Pattern 2: Unconditional fetch
useEffect(() => {
  fetchWithAuth<TestSummary[]>("GET", "/tests")
    .then((data) => setTests(data ?? []));
}, []);

// Pattern 3: With error handling
fetchWithAuth<any[]>("GET", "/tests")
  .then((data) => setChartData((data ?? []).map(...)))
  .catch((e) => setError(e?.message ?? "Error"));
```

### Red Flags Identified

#### 🔴 CRITICAL ISSUES

1. **Login Form Test Failure**
   - Test expects button text `/sign in/i` (English)
   - Actual button text: "Přihlásit se" (Czech)
   - Location: `tests/fe-policy/components/LoginForm.test.tsx:21`
   - Impact: Test suite fails, CI/CD broken

2. **Unsafe Array Operations**
   - `dashboard/page.tsx:55`: `if (data?.length) setTests(data);` - only sets if length > 0, but doesn't handle null/undefined properly
   - `assignments/[assignmentId]/page.tsx:260`: `test.questions.map()` - no null check on `test` or `test.questions`
   - `dashboard/tests/[testId]/results/page.tsx:34`: `results.map()` - no check if `results` is array

3. **Missing Null Checks**
   - `dashboard/page.tsx:55`: `data?.length` check but `data` could be `null` or `undefined`
   - `dashboard/tests/page.tsx:36`: `data ?? []` is good, but used inconsistently
   - `assignments/[assignmentId]/page.tsx:75`: `assignmentData.testId` accessed without null check

4. **Type Safety Issues**
   - `dashboard/results/page.tsx:17`: `fetchWithAuth<any[]>` - using `any` type
   - `dashboard/tests/[testId]/results/page.tsx:26`: `catch((e: any) => ...)` - using `any`
   - `noUncheckedIndexedAccess` enabled but not consistently handled

5. **Race Conditions**
   - `dashboard/page.tsx:44-64`: `useEffect` with cleanup, but `setTests` could be called after unmount if promise resolves late
   - Multiple pages don't check `cancelled` flag before state updates

6. **Error State Handling**
   - `dashboard/tests/page.tsx`: No error state, only loading
   - `dashboard/results/page.tsx`: Has error state but doesn't display it properly
   - Many pages catch errors but don't show user feedback

7. **Loading State Issues**
   - `dashboard/tests/page.tsx:74-77`: Shows loading spinner AND data table with `loading={loading}` - redundant
   - `dashboard/page.tsx:122-130`: Loading state handled, but empty state not shown

8. **Hydration/SSR Issues**
   - `use-auth-store.ts`: Uses `persist` middleware with localStorage - potential hydration mismatch
   - `httpClient`: Accesses `window.localStorage` and `document.cookie` without guards in some places

#### 🟡 MEDIUM PRIORITY

9. **Inconsistent Data Handling**
   - Some pages use `data ?? []`, others use `data?.length` checks
   - No standard pattern for empty states

10. **Missing Error Boundaries**
    - Only root-level `AppErrorBoundary` exists
    - Page-level errors could crash entire app

11. **Accessibility Issues**
    - Form validation errors not properly associated with inputs
    - Missing ARIA labels in some components

### Summary

**Total Issues Found:** 11 (7 critical, 4 medium)

**Most Critical:**
1. Login form test failure (immediate blocker)
2. Unsafe array operations (runtime crashes)
3. Missing null checks (TypeScript strict mode violations)
4. Race conditions in data fetching (state updates after unmount)

**Architecture Notes:**
- No data fetching library (React Query/SWR) - all manual `useEffect` + `fetch`
- Auth state management is solid (Zustand + persistence)
- HTTP client has good retry/refresh logic
- Type safety is partially enforced but not consistently
