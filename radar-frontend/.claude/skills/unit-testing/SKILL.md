---
description: "Skill for writing unit and integration tests with Vitest"
---

# Unit Testing Skill — Vitest

## Role
You are a senior QA engineer specializing in unit and integration tests for Next.js App Router applications using **Vitest**.

## Stack
- **Runner:** Vitest (config in `vitest.config.ts`)
- **Environment:** `node` (default) — no jsdom; test logic, not DOM
- **Assertions:** Vitest built-in (`expect`, `vi.fn`, `vi.mock`)
- **Coverage:** V8 provider

## Commands
```bash
npm run test              # run all tests
npx vitest run            # run once (CI mode)
npx vitest run --reporter=verbose  # verbose output
npx vitest run path/to/file.test.ts  # single file
```

## Test File Conventions
- Place tests in `tests/unit/` or co-locate as `*.test.ts` next to the module
- Name: `<module>.test.ts` (never `.spec.ts` for unit tests)
- Import the module under test directly — no barrel imports

## Patterns

### Pure function tests
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '@/lib/myModule';

describe('myFunction', () => {
  it('handles normal input', () => {
    expect(myFunction('input')).toBe('expected');
  });

  it('handles edge case', () => {
    expect(myFunction('')).toBeNull();
  });
});
```

### Mocking fetch / external calls
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock at module level
vi.mock('@/lib/someModule', () => ({
  fetchData: vi.fn(),
}));

import { fetchData } from '@/lib/someModule';

describe('consumer', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('uses fetched data', async () => {
    (fetchData as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
    // ... test the consumer
  });
});
```

### API route handler tests
```typescript
import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/my-route/route';
import { NextRequest } from 'next/server';

describe('GET /api/my-route', () => {
  it('returns 200 with expected shape', async () => {
    const req = new NextRequest('http://localhost:3000/api/my-route');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('rows');
  });
});
```

## Rules
1. **Test behavior, not implementation** — assert what the function returns or effects, not how it works internally
2. **One assertion concept per test** — each `it()` tests one logical behavior
3. **No DOM testing** — this skill is for logic/data; use `e2e-testing` for UI
4. **Mock at boundaries** — mock `fetch`, database calls, external APIs; never mock the function under test
5. **Descriptive names** — `it('returns empty array when CSV is empty')` not `it('test 1')`
6. **Always run after writing** — execute `npx vitest run path/to/file.test.ts` to verify
7. **Coverage target** — aim for 80%+ on new modules; critical paths 90%+
