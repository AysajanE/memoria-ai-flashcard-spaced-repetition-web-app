/**
 * @file simulate-webhook.test.ts
 * @description Tests for simulateWebhookAction
 * 
 * Test coverage:
 * - Authentication requirements
 * - Production environment restrictions  
 * - API key validation
 * - HMAC signature generation
 * - Successful webhook simulation
 * - Network error handling
 * - Response parsing
 */

import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { simulateWebhookAction } from '@/actions/ai/simulate-webhook';
import { auth } from '@clerk/nextjs';

// Mock crypto at the top level  
vi.mock('crypto', () => ({
  default: {
    createHmac: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('mock-digest-hex'),
    }),
  },
}));

// Mock dependencies
vi.mock('@clerk/nextjs');

const mockAuth = auth as MockedFunction<typeof auth>;

// Global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test constants
const TEST_USER_ID = 'user_test123';
const TEST_JOB_ID = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_API_KEY = 'test-internal-api-key';
const MOCK_HMAC_SECRET = 'test-hmac-secret';

// Mock environment variables
const originalEnv = process.env;

describe('simulateWebhookAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset environment
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      INTERNAL_API_KEY: MOCK_API_KEY,
      INTERNAL_WEBHOOK_HMAC_SECRET: MOCK_HMAC_SECRET,
    };

    // Default auth mock
    mockAuth.mockReturnValue({ userId: TEST_USER_ID });

    // Default successful fetch mock
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Success' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Authentication', () => {
    it('should require user authentication', async () => {
      mockAuth.mockReturnValue({ userId: null });

      const result = await simulateWebhookAction(TEST_JOB_ID);

      expect(result.ok).toBe(false);
      expect(result.message).toBe('Unauthorized');
    });

    it('should allow authenticated users', async () => {
      const result = await simulateWebhookAction(TEST_JOB_ID);

      expect(result.ok).toBe(true);
      expect(result.message).toBe('OK');
    });
  });

  describe('Environment Restrictions', () => {
    it('should be disabled in production environment', async () => {
      process.env.NODE_ENV = 'production';

      const result = await simulateWebhookAction(TEST_JOB_ID);

      expect(result.ok).toBe(false);
      expect(result.message).toBe('Disabled in production');
    });

    it('should work in development environment', async () => {
      process.env.NODE_ENV = 'development';

      const result = await simulateWebhookAction(TEST_JOB_ID);

      expect(result.ok).toBe(true);
      expect(result.message).toBe('OK');
    });

    it('should work in test environment', async () => {
      process.env.NODE_ENV = 'test';

      const result = await simulateWebhookAction(TEST_JOB_ID);

      expect(result.ok).toBe(true);
      expect(result.message).toBe('OK');
    });
  });

  describe('Configuration Validation', () => {
    it('should require INTERNAL_API_KEY', async () => {
      delete process.env.INTERNAL_API_KEY;

      const result = await simulateWebhookAction(TEST_JOB_ID);

      expect(result.ok).toBe(false);
      expect(result.message).toBe('Missing INTERNAL_API_KEY');
    });

    it('should work with valid API key', async () => {
      const result = await simulateWebhookAction(TEST_JOB_ID);

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/webhooks/ai-service-status',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-internal-api-key': MOCK_API_KEY,
          }),
        })
      );
    });
  });

  describe('Request Construction', () => {
    it('should send correct payload structure', async () => {
      await simulateWebhookAction(TEST_JOB_ID);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/webhooks/ai-service-status',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-internal-api-key': MOCK_API_KEY,
          }),
        })
      );

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body).toEqual({
        jobId: TEST_JOB_ID,
        status: 'completed',
        resultPayload: {
          cards: [
            { front: 'What is AI?', back: 'AI is intelligence demonstrated by machines.' },
            {
              front: 'Define SRS.',
              back: 'Spaced Repetition System optimizes review scheduling.',
            },
          ],
        },
      });
    });

    it('should include HMAC signature when secret is configured', async () => {
      await simulateWebhookAction(TEST_JOB_ID);

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers['x-webhook-timestamp']).toBeDefined();
      expect(headers['x-webhook-signature']).toBeDefined();
      expect(headers['x-webhook-signature']).toMatch(/^sha256=/);
    });

    it('should work without HMAC when secret is not configured', async () => {
      delete process.env.INTERNAL_WEBHOOK_HMAC_SECRET;

      await simulateWebhookAction(TEST_JOB_ID);

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers['x-webhook-timestamp']).toBeUndefined();
      expect(headers['x-webhook-signature']).toBeUndefined();
    });

    it('should use correct URL with custom base URL', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://custom-domain.com';

      await simulateWebhookAction(TEST_JOB_ID);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-domain.com/api/webhooks/ai-service-status',
        expect.any(Object)
      );
    });

    it('should fall back to localhost when base URL is not set', async () => {
      delete process.env.NEXT_PUBLIC_APP_URL;

      await simulateWebhookAction(TEST_JOB_ID);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/webhooks/ai-service-status',
        expect.any(Object)
      );
    });
  });

  describe('Response Handling', () => {
    it('should return success for 200 response', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ message: 'Status updated successfully' }), {
          status: 200,
        })
      );

      const result = await simulateWebhookAction(TEST_JOB_ID);

      expect(result.ok).toBe(true);
      expect(result.message).toBe('OK');
    });

    it('should handle 400 error responses', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: 'Invalid payload' }), {
          status: 400,
        })
      );

      const result = await simulateWebhookAction(TEST_JOB_ID);

      expect(result.ok).toBe(false);
      expect(result.message).toBe('Webhook failed: 400 Invalid payload');
    });

    it('should handle 401 unauthorized responses', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
        })
      );

      const result = await simulateWebhookAction(TEST_JOB_ID);

      expect(result.ok).toBe(false);
      expect(result.message).toBe('Webhook failed: 401 Unauthorized');
    });

    it('should handle 500 server error responses', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
        })
      );

      const result = await simulateWebhookAction(TEST_JOB_ID);

      expect(result.ok).toBe(false);
      expect(result.message).toBe('Webhook failed: 500 Internal server error');
    });

    it('should handle responses without JSON body', async () => {
      mockFetch.mockResolvedValue(
        new Response('Not JSON', {
          status: 400,
        })
      );

      const result = await simulateWebhookAction(TEST_JOB_ID);

      expect(result.ok).toBe(false);
      expect(result.message).toBe('Webhook failed: 400');
    });

    it('should throw on network errors (unhandled)', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(simulateWebhookAction(TEST_JOB_ID)).rejects.toThrow('Network error');
    });

    it('should throw on fetch timeouts (unhandled)', async () => {
      mockFetch.mockRejectedValue(new Error('Request timeout'));

      await expect(simulateWebhookAction(TEST_JOB_ID)).rejects.toThrow('Request timeout');
    });
  });

  describe('HMAC Signature Generation', () => {
    it('should generate consistent signatures', async () => {
      const crypto = await import('crypto');
      
      await simulateWebhookAction(TEST_JOB_ID);

      expect(crypto.default.createHmac).toHaveBeenCalledWith('sha256', MOCK_HMAC_SECRET);
    });

    it('should include timestamp in signature payload', async () => {
      const mockNow = 1234567890000;
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(mockNow);

      await simulateWebhookAction(TEST_JOB_ID);

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers['x-webhook-timestamp']).toBe(mockNow.toString());

      dateSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty jobId', async () => {
      const result = await simulateWebhookAction('');

      // Should still attempt the request with empty jobId
      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.jobId).toBe('');
    });

    it('should handle malformed job IDs', async () => {
      const result = await simulateWebhookAction('not-a-uuid');

      // Should still attempt the request - validation happens on the webhook endpoint
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle very long response error messages', async () => {
      const longErrorMessage = 'x'.repeat(1000);
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: longErrorMessage }), {
          status: 400,
        })
      );

      const result = await simulateWebhookAction(TEST_JOB_ID);

      expect(result.ok).toBe(false);
      expect(result.message).toContain(longErrorMessage);
    });
  });
});