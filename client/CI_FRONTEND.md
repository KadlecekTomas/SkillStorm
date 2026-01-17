# Frontend CI Quality Gate

## Overview

The Frontend CI Quality Gate ensures that broken UI code never reaches the `main` branch. Every pull request and push to `main` must pass all quality checks before merging.

## What CI Checks

The CI pipeline runs the following checks **in order**:

1. **🔍 Lint** (`npm run lint`)
   - ESLint rules enforcement
   - TypeScript-specific linting
   - Code style consistency

2. **🔎 Type Check** (`npm run typecheck`)
   - TypeScript compilation without emitting files
   - Catches type errors before runtime
   - Validates type safety across the codebase

3. **🧪 Unit/Component Tests** (`npm run test:unit`)
   - Vitest unit tests
   - React Testing Library component tests
   - All tests must pass

4. **🎬 E2E Tests** (`npm run test:e2e`)
   - Playwright end-to-end tests
   - Runs in headless Chromium
   - Tests critical user flows

5. **🏗️ Build** (`npm run build`)
   - Next.js production build
   - Validates that the app can be built successfully
   - Catches build-time errors

## Running Checks Locally

Before pushing code, run all checks locally:

```bash
cd client

# Run all checks in sequence
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

Or run them all at once:

```bash
npm run lint && npm run typecheck && npm run test:unit && npm run test:e2e && npm run build
```

## Debugging CI Failures

### Lint Failures

**Error**: `Error: Missing return type on function`

**Fix**: Add explicit return types to functions:
```typescript
// ❌ Bad
export default function MyPage() { ... }

// ✅ Good
export default function MyPage(): JSX.Element { ... }
```

**Error**: `Error: Unexpected any. Specify a different type.`

**Fix**: Replace `any` with proper types:
```typescript
// ❌ Bad
const data: any = await fetchData();

// ✅ Good
const data: MyDataType = await fetchData();
// or
const data: unknown = await fetchData();
```

### Type Check Failures

**Error**: `error TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'`

**Fix**: 
1. Check the type definitions
2. Ensure types match expected interfaces
3. Use type assertions only when necessary and safe

**Error**: `error TS2741: Property 'X' is missing in type`

**Fix**: Add missing required properties to objects:
```typescript
// ❌ Bad
const user: User = { id: "1" };

// ✅ Good
const user: User = { id: "1", name: "John" };
```

### Test Failures

**Unit/Component Tests**:
- Check test output for specific failing assertions
- Ensure mocks are properly configured
- Verify test data matches expected types

**E2E Tests**:
- Check Playwright trace files (generated on failure)
- Verify test selectors are still valid
- Ensure test environment matches CI (headless mode)

### Build Failures

**Error**: Build fails with module resolution errors

**Fix**: 
- Check import paths use `@/` alias correctly
- Verify all dependencies are installed
- Ensure TypeScript config is correct

## Why Each Step Exists

### Lint
- **Purpose**: Enforces code quality and consistency
- **Why**: Prevents common bugs, improves readability, maintains team standards
- **Failure Impact**: Code style violations, potential bugs from lint rules

### Type Check
- **Purpose**: Validates TypeScript types without building
- **Why**: Faster than full build, catches type errors early
- **Failure Impact**: Type safety violations, runtime errors

### Unit/Component Tests
- **Purpose**: Validates component behavior and utilities
- **Why**: Catches regressions in isolated components
- **Failure Impact**: Broken UI components, utility function bugs

### E2E Tests
- **Purpose**: Validates complete user flows
- **Why**: Ensures the app works end-to-end, not just in isolation
- **Failure Impact**: Broken user workflows, integration issues

### Build
- **Purpose**: Validates production build succeeds
- **Why**: Ensures the app can be deployed
- **Failure Impact**: Deployment failures, production bugs

## CI Configuration

The CI workflow is defined in `.github/workflows/frontend-ci.yml`.

**Key Settings**:
- Runs on Ubuntu latest
- Uses Node.js 20 LTS
- Caches `node_modules` for faster runs
- Timeout: 15 minutes
- All steps run sequentially (no parallelization)

## Common Issues

### "CI passes but local fails"
- Ensure you're using the same Node.js version (20)
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm ci`
- Check for environment-specific issues

### "Tests pass locally but fail in CI"
- Ensure tests are deterministic (no random data)
- Check for timezone/date issues
- Verify all dependencies are in `package.json` (not just `package-lock.json`)

### "Build works locally but fails in CI"
- Check for environment variables that might be missing
- Verify all files are committed (no `.env.local` dependencies)
- Ensure build output is deterministic

## Best Practices

1. **Run checks before pushing**: Always run `lint` and `typecheck` before committing
2. **Fix errors immediately**: Don't let errors accumulate
3. **Write tests for new features**: New code should have corresponding tests
4. **Keep CI green**: Never merge code that fails CI
5. **Review CI logs**: If CI fails, read the full error message

## Getting Help

If CI fails and you can't fix it:
1. Read the full error message in GitHub Actions
2. Check this documentation
3. Run the failing command locally
4. Ask for help in code review

**Remember**: CI failures block merges. Fix them before requesting review.
