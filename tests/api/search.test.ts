import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config', () => ({
  config: {
    cribl: { baseUrl: 'http://test:9000', auth: { type: 'local', username: 'admin', password: 'pass' } },
    server: { name: 'test', version: '1.0.0' }
  }
}));

vi.mock('../../src/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
  handleApiError: vi.fn((err, ctx) => `Error during ${ctx}`)
}));

import { apiClient, handleApiError } from '../../src/api/client';
import { runSearch, getSearchResults } from '../../src/api/search';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;
const mockHandleApiError = handleApiError as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------- runSearch ----------
describe('runSearch', () => {
  it('returns search job on success (extracts items[0])', async () => {
    const job = { id: 'job123', status: 'running' };
    mockPost.mockResolvedValueOnce({ data: { items: [job] } });

    const result = await runSearch({ query: 'index=main' });

    expect(result).toEqual({ success: true, data: job });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/search/jobs', { query: 'index=main' });
  });

  it('returns search job on success (falls back to data)', async () => {
    const job = { id: 'job456', status: 'running' };
    mockPost.mockResolvedValueOnce({ data: job });

    const result = await runSearch({ query: 'index=main', earliest: '-1h', latest: 'now', dataset: 'myds' });

    expect(result).toEqual({ success: true, data: job });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/search/jobs', {
      query: 'index=main',
      earliest: '-1h',
      latest: 'now',
      dataset: 'myds',
    });
  });

  it('returns custom error on 404 about Cribl Cloud/Search', async () => {
    mockHandleApiError.mockReturnValueOnce('API Error (404) during runSearch');
    mockPost.mockRejectedValueOnce(new Error('not found'));

    const result = await runSearch({ query: 'index=main' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Search endpoint not available');
    expect(result.error).toContain('Cribl Cloud');
  });
});

// ---------- getSearchResults ----------
describe('getSearchResults', () => {
  it('returns search results on success', async () => {
    const data = { results: [{ _raw: 'event1' }] };
    mockGet.mockResolvedValueOnce({ data });

    const result = await getSearchResults('job123');

    expect(result).toEqual({ success: true, data });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/search/jobs/job123/results');
  });

  it('returns error when jobId is empty', async () => {
    const result = await getSearchResults('');

    expect(result).toEqual({ success: false, error: 'Job ID is required for getSearchResults.' });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns custom error on 404', async () => {
    mockHandleApiError.mockReturnValueOnce('API Error (404) during getSearchResults');
    mockGet.mockRejectedValueOnce(new Error('not found'));

    const result = await getSearchResults('job999');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Search results endpoint not available');
  });
});
