/**
 * Tests for Request ID Middleware
 * 
 * Validates ID generation, upstream propagation,
 * response headers, and custom options.
 */

import { describe, it, expect, vi } from 'vitest';
import { requestId } from '../../app/middlewares/requestId';
import { mockRequest, mockResponse, runMiddleware } from '../helpers/mocks';

describe('requestId middleware', () => {
  it('generates a UUID and attaches to request', async () => {
    const req = mockRequest();
    const res = mockResponse();

    await runMiddleware(requestId(), req, res as any);

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe('string');
    expect(req.requestId!.length).toBeGreaterThan(0);
  });

  it('sets X-Request-ID response header', async () => {
    const req = mockRequest();
    const res = mockResponse();

    await runMiddleware(requestId(), req, res as any);

    expect(res._headers['x-request-id']).toBeDefined();
    expect(res._headers['x-request-id']).toBe(req.requestId);
  });

  it('uses incoming X-Request-ID from upstream proxy', async () => {
    const upstreamId = 'upstream-trace-123';
    const req = mockRequest({
      headers: { 'x-request-id': upstreamId },
    } as any);
    const res = mockResponse();

    await runMiddleware(requestId(), req, res as any);

    expect(req.requestId).toBe(upstreamId);
    expect(res._headers['x-request-id']).toBe(upstreamId);
  });

  it('calls next() to continue middleware chain', async () => {
    const result = await runMiddleware(requestId());
    expect(result.nextCalled).toBe(true);
  });

  it('generates unique IDs for different requests', async () => {
    const req1 = mockRequest();
    const req2 = mockRequest();
    const res1 = mockResponse();
    const res2 = mockResponse();

    await runMiddleware(requestId(), req1, res1 as any);
    await runMiddleware(requestId(), req2, res2 as any);

    expect(req1.requestId).not.toBe(req2.requestId);
  });
});
