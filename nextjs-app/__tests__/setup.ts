/**
 * @file setup.ts
 * @description Test setup file for vitest
 * Sets up mocks and environment variables needed for tests
 */

import { vi } from 'vitest';

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.CLERK_SECRET_KEY = 'sk_test_123';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
process.env.WEBHOOK_SECRET = 'whsec_test123';
process.env.INTERNAL_API_KEY = 'test-internal-api-key';
process.env.INTERNAL_WEBHOOK_HMAC_SECRET = 'test-hmac-secret';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Mock dotenv/config
vi.mock('dotenv/config', () => ({}));

// Mock the database connection to prevent actual DB calls
vi.mock('@/db', () => ({
  db: {
    query: {},
    transaction: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
  },
}));

// Mock Next.js APIs
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init) => {
      const response = new Response(JSON.stringify(data), {
        status: init?.status || 200,
        headers: {
          'content-type': 'application/json',
          ...(init?.headers || {}),
        },
      });
      return response;
    }),
  },
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

// Global test utilities
global.beforeEach = global.beforeEach || vi.beforeEach;
global.afterEach = global.afterEach || vi.afterEach;
global.describe = global.describe || vi.describe;
global.it = global.it || vi.it;
global.expect = global.expect || vi.expect;