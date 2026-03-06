import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosError, AxiosHeaders } from 'axios';

// Mock axios before importing the module under test
vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(() => ({
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      })),
      isAxiosError: actual.default.isAxiosError,
    },
  };
});

// Mock config so the module can load without .env
vi.mock('../../src/config', () => ({
  config: {
    cribl: { baseUrl: 'http://test:9000', auth: { type: 'local', username: 'admin', password: 'pass' } },
    server: { name: 'test', version: '1.0.0' },
  },
}));

import { handleApiError, acquireToken } from '../../src/api/client';

// Helper to build an AxiosError with a response
function makeAxiosErrorWithResponse(
  status: number,
  data: unknown,
  message = 'Request failed'
): AxiosError {
  const headers = new AxiosHeaders();
  const config = { headers } as any;
  const error = new AxiosError(message, 'ERR_BAD_REQUEST', config, {}, {
    status,
    statusText: 'Bad Request',
    headers: {},
    config,
    data,
  } as any);
  return error;
}

// Helper to build an AxiosError with only a request (no response)
function makeAxiosErrorWithRequest(message = 'Network Error'): AxiosError {
  const headers = new AxiosHeaders();
  const config = { headers } as any;
  const error = new AxiosError(message, 'ERR_NETWORK', config, { /* request object */ });
  // Ensure there is no response property
  delete (error as any).response;
  return error;
}

describe('handleApiError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should handle AxiosError with response containing an object with message', () => {
    const error = makeAxiosErrorWithResponse(400, { message: 'Invalid input' });
    const result = handleApiError(error, 'testContext');
    expect(result).toBe('API Error (400) during testContext: Invalid input');
  });

  it('should handle AxiosError with response containing string data', () => {
    const error = makeAxiosErrorWithResponse(500, 'Internal Server Error');
    const result = handleApiError(error, 'fetchData');
    expect(result).toBe('API Error (500) during fetchData: Internal Server Error');
  });

  it('should handle AxiosError with no response (request only)', () => {
    const error = makeAxiosErrorWithRequest('Network Error');
    const result = handleApiError(error, 'connectApi');
    expect(result).toBe('API Error during connectApi: No response received from server.');
  });

  it('should handle a generic Error', () => {
    const error = new Error('Something went wrong');
    const result = handleApiError(error, 'processData');
    expect(result).toBe('Error during processData: Something went wrong');
  });

  it('should handle an unknown error type (string)', () => {
    const result = handleApiError('unexpected failure', 'unknownOp');
    expect(result).toBe('Unknown error type during unknownOp: unexpected failure');
  });
});

describe('acquireToken', () => {
  let authClientPost: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Access the authClient mock created by axios.create()
    const mockCreate = axios.create as unknown as ReturnType<typeof vi.fn>;
    // The first call to axios.create() in client.ts creates authClient
    // The second call creates apiClient
    // We need to get the mock returned by the first call
    const authClientMock = mockCreate.mock.results[0]?.value;
    if (authClientMock) {
      authClientPost = authClientMock.post;
    }
  });

  it('should acquire a token for local auth', async () => {
    authClientPost.mockResolvedValueOnce({
      data: { token: 'Bearer my-test-token' },
    });

    await expect(acquireToken()).resolves.toBeUndefined();
    expect(authClientPost).toHaveBeenCalledWith(
      'http://test:9000/api/v1/auth/login',
      { username: 'admin', password: 'pass' },
      { headers: { 'Content-Type': 'application/json' } }
    );
  });

  it('should throw when auth fails', async () => {
    const networkError = makeAxiosErrorWithRequest('Connection refused');
    authClientPost.mockRejectedValueOnce(networkError);

    await expect(acquireToken()).rejects.toThrow('Failed to acquire Cribl token');
  });
});
