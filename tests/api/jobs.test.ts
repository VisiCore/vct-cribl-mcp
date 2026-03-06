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
import { getJobs, getCollectors, runCollectorJob } from '../../src/api/jobs';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;
const mockHandleApiError = handleApiError as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------- getJobs ----------
describe('getJobs', () => {
  it('returns jobs on success', async () => {
    const items = [{ id: 'job1', status: 'completed' }, { id: 'job2', status: 'running' }];
    mockGet.mockResolvedValueOnce({ data: { items } });

    const result = await getJobs('default');

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/jobs');
  });

  it('returns error when group name is empty', async () => {
    const result = await getJobs('');

    expect(result).toEqual({ success: false, error: 'Group name is required for getJobs.' });
    expect(mockGet).not.toHaveBeenCalled();
  });
});

// ---------- getCollectors ----------
describe('getCollectors', () => {
  it('returns collectors on success', async () => {
    const items = [{ id: 'collector1', type: 's3' }];
    mockGet.mockResolvedValueOnce({ data: { items } });

    const result = await getCollectors('default');

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/collectors');
  });

  it('returns error when group name is empty', async () => {
    const result = await getCollectors('');

    expect(result).toEqual({ success: false, error: 'Group name is required for getCollectors.' });
  });
});

// ---------- runCollectorJob ----------
describe('runCollectorJob', () => {
  it('returns job data on success', async () => {
    const jobData = { id: 'run1', status: 'started', collector: 'myCollector' };
    mockPost.mockResolvedValueOnce({ data: { items: [jobData] } });

    const result = await runCollectorJob('default', 'myCollector');

    expect(result).toEqual({ success: true, data: jobData });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/m/default/lib/jobs', {
      collector: 'myCollector',
      type: 'collection',
    });
  });

  it('passes configOverrides when provided', async () => {
    const jobData = { id: 'run2', status: 'started' };
    mockPost.mockResolvedValueOnce({ data: { items: [jobData] } });

    const overrides = { maxEvents: 100 };
    const result = await runCollectorJob('default', 'myCollector', overrides);

    expect(result).toEqual({ success: true, data: jobData });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/m/default/lib/jobs', {
      collector: 'myCollector',
      type: 'collection',
      configOverrides: overrides,
    });
  });

  it('returns custom error on 404', async () => {
    mockHandleApiError.mockReturnValueOnce('API Error (404) during runCollectorJob');
    mockPost.mockRejectedValueOnce(new Error('not found'));

    const result = await runCollectorJob('default', 'badCollector');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Collector job endpoint not available');
    expect(result.error).toContain('cribl_getJobs');
  });

  it('returns error when collectorId is empty', async () => {
    const result = await runCollectorJob('default', '');

    expect(result).toEqual({ success: false, error: 'Collector ID is required for runCollectorJob.' });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('returns error when group name is empty', async () => {
    const result = await runCollectorJob('', 'myCollector');

    expect(result).toEqual({ success: false, error: 'Group name is required for runCollectorJob.' });
    expect(mockPost).not.toHaveBeenCalled();
  });
});
