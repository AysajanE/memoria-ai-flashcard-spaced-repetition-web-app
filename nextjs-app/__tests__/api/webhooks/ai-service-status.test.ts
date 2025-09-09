/**
 * @file ai-service-status.test.ts
 * @description Comprehensive tests for AI service status webhook endpoint
 * 
 * Test coverage:
 * - Valid requests with proper authentication
 * - Invalid API keys and missing authentication
 * - HMAC signature validation (valid and invalid)
 * - Expired timestamps
 * - Malformed payloads and JSON parsing errors
 * - State transitions (legal and illegal)
 * - Job not found scenarios
 * - Database transaction handling
 * - Error handling and response codes
 */

import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { POST } from '@/app/api/webhooks/ai-service-status/route';
import { db } from '@/db';
import * as jobState from '@/lib/job-state';
import crypto from 'crypto';
import { NextResponse } from 'next/server';

// Mock dependencies
vi.mock('@/db');
vi.mock('@/lib/job-state');
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

const mockDb = db as any;
const mockIsLegalTransition = jobState.isLegalTransition as MockedFunction<typeof jobState.isLegalTransition>;
const mockIsTerminal = jobState.isTerminal as MockedFunction<typeof jobState.isTerminal>;

// Test constants
const VALID_API_KEY = 'test-api-key';
const VALID_HMAC_SECRET = 'test-hmac-secret';
const TEST_JOB_ID = '550e8400-e29b-41d4-a716-446655440000';

// Mock environment variables
const originalEnv = process.env;

// Helper to create HMAC signature
function createHmacSignature(timestamp: string, payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${timestamp}.${payload}`);
  return `sha256=${hmac.digest('hex')}`;
}

// Helper to create mock request
function createMockRequest(
  payload: any,
  headers: Record<string, string> = {}
): Request {
  const body = JSON.stringify(payload);
  const defaultHeaders = {
    'content-type': 'application/json',
    'x-internal-api-key': VALID_API_KEY,
    ...headers,
  };

  return new Request('http://localhost:3000/api/webhooks/ai-service-status', {
    method: 'POST',
    headers: defaultHeaders,
    body,
  });
}

// Helper to create valid payload
const createValidPayload = (overrides: any = {}) => ({
  jobId: TEST_JOB_ID,
  status: 'completed' as const,
  resultPayload: {
    cards: [
      { front: 'Test Question', back: 'Test Answer' },
    ],
  },
  ...overrides,
});

describe('AI Service Status Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variables
    process.env.INTERNAL_API_KEY = VALID_API_KEY;
    process.env.INTERNAL_WEBHOOK_HMAC_SECRET = VALID_HMAC_SECRET;

    // Set up default mocks
    mockIsLegalTransition.mockReturnValue(true);
    mockIsTerminal.mockReturnValue(false);

    // Mock database
    mockDb.query = {
      processingJobs: {
        findFirst: vi.fn(),
      },
    };

    mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
      const mockTx = {
        query: {
          processingJobs: {
            findFirst: vi.fn().mockResolvedValue({ status: 'processing' }),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: TEST_JOB_ID }]),
            }),
          }),
        }),
      };
      return await callback(mockTx);
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Authentication - API Key', () => {
    it('should accept requests with valid API key', async () => {
      const request = createMockRequest(createValidPayload());
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Status updated successfully');
    });

    it('should reject requests without API key', async () => {
      const request = createMockRequest(createValidPayload(), {
        'x-internal-api-key': '',
      });
      
      const response = await POST(request);
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
      expect(data.errorCode).toBe('INVALID_API_KEY');
    });

    it('should reject requests with invalid API key', async () => {
      const request = createMockRequest(createValidPayload(), {
        'x-internal-api-key': 'invalid-key',
      });
      
      const response = await POST(request);
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
      expect(data.errorCode).toBe('INVALID_API_KEY');
    });
  });

  describe('HMAC Signature Validation', () => {
    it('should accept requests with valid HMAC signature', async () => {
      const payload = createValidPayload();
      const timestamp = Date.now().toString();
      const payloadString = JSON.stringify(payload);
      const signature = createHmacSignature(timestamp, payloadString, VALID_HMAC_SECRET);

      const request = createMockRequest(payload, {
        'x-webhook-timestamp': timestamp,
        'x-webhook-signature': signature,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should reject requests with missing signature headers', async () => {
      const request = createMockRequest(createValidPayload());
      
      const response = await POST(request);
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toBe('Missing signature headers');
      expect(data.errorCode).toBe('MISSING_SIGNATURE');
    });

    it('should reject requests with invalid HMAC signature', async () => {
      const payload = createValidPayload();
      const timestamp = Date.now().toString();

      const request = createMockRequest(payload, {
        'x-webhook-timestamp': timestamp,
        'x-webhook-signature': 'sha256=invalid-signature',
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toBe('Invalid signature');
      expect(data.errorCode).toBe('INVALID_SIGNATURE');
    });

    it('should reject requests with expired timestamps', async () => {
      const payload = createValidPayload();
      const expiredTimestamp = (Date.now() - (6 * 60 * 1000)).toString(); // 6 minutes ago
      const payloadString = JSON.stringify(payload);
      const signature = createHmacSignature(expiredTimestamp, payloadString, VALID_HMAC_SECRET);

      const request = createMockRequest(payload, {
        'x-webhook-timestamp': expiredTimestamp,
        'x-webhook-signature': signature,
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toBe('Signature timestamp expired');
      expect(data.errorCode).toBe('TIMESTAMP_EXPIRED');
    });

    it('should reject requests with invalid timestamp format', async () => {
      const payload = createValidPayload();

      const request = createMockRequest(payload, {
        'x-webhook-timestamp': 'invalid-timestamp',
        'x-webhook-signature': 'sha256=some-signature',
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toBe('Signature timestamp expired');
      expect(data.errorCode).toBe('TIMESTAMP_EXPIRED');
    });

    it('should work without HMAC when secret is not configured', async () => {
      // Remove HMAC secret
      delete process.env.INTERNAL_WEBHOOK_HMAC_SECRET;
      
      const request = createMockRequest(createValidPayload());
      const response = await POST(request);
      
      expect(response.status).toBe(200);
    });
  });

  describe('Payload Validation', () => {
    it('should accept valid completed status payload', async () => {
      const payload = createValidPayload({
        status: 'completed',
        resultPayload: {
          cards: [
            { front: 'Question 1', back: 'Answer 1' },
            { front: 'Question 2', back: 'Answer 2' },
          ],
        },
      });

      const request = createMockRequest(payload);
      const response = await POST(request);
      
      expect(response.status).toBe(200);
    });

    it('should accept valid failed status payload', async () => {
      const payload = createValidPayload({
        status: 'failed',
        errorDetail: {
          message: 'Processing failed',
          category: 'ai_model_error',
          retryable: true,
        },
      });

      const request = createMockRequest(payload);
      const response = await POST(request);
      
      expect(response.status).toBe(200);
    });

    it('should reject payload with invalid jobId format', async () => {
      const payload = createValidPayload({
        jobId: 'invalid-uuid',
      });

      const request = createMockRequest(payload);
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid payload');
      expect(data.errorCode).toBe('INVALID_PAYLOAD');
    });

    it('should reject payload with invalid status', async () => {
      const payload = createValidPayload({
        status: 'invalid-status',
      });

      const request = createMockRequest(payload);
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid payload');
      expect(data.errorCode).toBe('INVALID_PAYLOAD');
    });

    it('should reject malformed JSON', async () => {
      const request = new Request('http://localhost:3000/api/webhooks/ai-service-status', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-api-key': VALID_API_KEY,
        },
        body: 'invalid-json{',
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
      expect(data.errorCode).toBe('INTERNAL_ERROR');
    });
  });

  describe('Job State Management', () => {
    it('should update job status for valid transition', async () => {
      mockIsLegalTransition.mockReturnValue(true);
      mockIsTerminal.mockReturnValue(false);

      const request = createMockRequest(createValidPayload());
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(mockIsLegalTransition).toHaveBeenCalledWith('processing', 'completed');
    });

    it('should reject illegal state transitions', async () => {
      mockIsLegalTransition.mockReturnValue(false);
      
      // Mock transaction to return the illegal transition response
      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            processingJobs: {
              findFirst: vi.fn().mockResolvedValue({ status: 'completed' }),
            },
          },
        };
        return await callback(mockTx);
      });

      const request = createMockRequest(createValidPayload());
      const response = await POST(request);
      
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe('Illegal transition');
      expect(data.errorCode).toBe('ILLEGAL_TRANSITION');
    });

    it('should handle already finalized jobs idempotently', async () => {
      mockIsTerminal.mockReturnValue(true);
      
      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            processingJobs: {
              findFirst: vi.fn().mockResolvedValue({ status: 'completed' }),
            },
          },
        };
        return await callback(mockTx);
      });

      const request = createMockRequest(createValidPayload());
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Already finalized');
    });

    it('should return 404 for non-existent jobs', async () => {
      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            processingJobs: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
        };
        return await callback(mockTx);
      });

      const request = createMockRequest(createValidPayload());
      const response = await POST(request);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Job not found');
      expect(data.errorCode).toBe('JOB_NOT_FOUND');
    });
  });

  describe('Database Operations', () => {
    it('should handle database transaction failures', async () => {
      mockDb.transaction = vi.fn().mockRejectedValue(new Error('Database error'));

      const request = createMockRequest(createValidPayload());
      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
      expect(data.errorCode).toBe('INTERNAL_ERROR');
    });

    it('should handle update failures', async () => {
      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            processingJobs: {
              findFirst: vi.fn().mockResolvedValue({ status: 'processing' }),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([]), // No rows returned
              }),
            }),
          }),
        };
        return await callback(mockTx);
      });

      const request = createMockRequest(createValidPayload());
      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to update job');
      expect(data.errorCode).toBe('UPDATE_FAILED');
    });

    it('should properly set all fields on successful update', async () => {
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: TEST_JOB_ID }]),
        }),
      });

      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            processingJobs: {
              findFirst: vi.fn().mockResolvedValue({ status: 'processing' }),
            },
          },
          update: vi.fn().mockReturnValue({ set: mockSet }),
        };
        return await callback(mockTx);
      });

      const payload = createValidPayload({
        status: 'failed',
        errorDetail: {
          message: 'AI processing failed',
          category: 'ai_model_error',
          retryable: true,
        },
      });

      const request = createMockRequest(payload);
      await POST(request);

      expect(mockSet).toHaveBeenCalledWith({
        status: 'failed',
        resultPayload: payload.resultPayload,
        errorMessage: 'AI processing failed',
        errorDetail: payload.errorDetail,
        completedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('Error Detail Handling', () => {
    it('should handle detailed error information', async () => {
      const errorDetail = {
        message: 'Token limit exceeded',
        category: 'token_limit' as const,
        code: 'TL001',
        context: { 
          tokensUsed: 4000,
          tokensLimit: 3000,
        },
        retryable: false,
        suggestedAction: 'Reduce input size',
      };

      const payload = createValidPayload({
        status: 'failed',
        errorDetail,
      });

      const request = createMockRequest(payload);
      const response = await POST(request);
      
      expect(response.status).toBe(200);
    });

    it('should fall back to errorMessage for backward compatibility', async () => {
      const payload = createValidPayload({
        status: 'failed',
        errorMessage: 'Legacy error message',
      });

      const request = createMockRequest(payload);
      const response = await POST(request);
      
      expect(response.status).toBe(200);
    });
  });

  describe('Cache Revalidation', () => {
    it('should continue processing if cache revalidation fails', async () => {
      const { revalidateTag } = await import('next/cache');
      (revalidateTag as any).mockImplementation(() => {
        throw new Error('Cache revalidation failed');
      });

      const request = createMockRequest(createValidPayload());
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(revalidateTag).toHaveBeenCalledWith(`job:${TEST_JOB_ID}`);
    });
  });
});