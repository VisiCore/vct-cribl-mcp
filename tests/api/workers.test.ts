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
import { listWorkerGroups, getWorkers, restartWorkerGroup } from '../../src/api/workers';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>;
const mockHandleApiError = handleApiError as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// listWorkerGroups
// ---------------------------------------------------------------------------
describe('listWorkerGroups', () => {
  it('should return worker groups on success', async () => {
    const items = [
      { id: 'group1', name: 'Default Group' },
      { id: 'group2', name: 'Production' },
    ];
    mockGet.mockResolvedValue({ data: { items } });

    const result = await listWorkerGroups();

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/master/groups');
  });

  it('should return an error on failure', async () => {
    const error = new Error('Network error');
    mockGet.mockRejectedValue(error);
    mockHandleApiError.mockReturnValue('Error during listWorkerGroups');

    const result = await listWorkerGroups();

    expect(result).toEqual({ success: false, error: 'Error during listWorkerGroups' });
    expect(mockHandleApiError).toHaveBeenCalledWith(error, 'listWorkerGroups');
  });
});

// ---------------------------------------------------------------------------
// getWorkers
// ---------------------------------------------------------------------------
describe('getWorkers', () => {
  it('should return workers on success', async () => {
    const items = [
      { id: 'worker1', hostname: 'node-1' },
      { id: 'worker2', hostname: 'node-2' },
    ];
    mockGet.mockResolvedValue({ data: { items } });

    const result = await getWorkers();

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/master/workers');
  });
});

// ---------------------------------------------------------------------------
// restartWorkerGroup
// ---------------------------------------------------------------------------
describe('restartWorkerGroup', () => {
  it('should return a success message on restart', async () => {
    mockPatch.mockResolvedValue({ status: 200 });

    const result = await restartWorkerGroup();

    expect(result).toEqual({
      success: true,
      data: { message: 'Successfully initiated worker restart. Response status: 200' },
    });
    expect(mockPatch).toHaveBeenCalledWith('/api/v1/master/workers/restart');
  });

  it('should return an error on failure', async () => {
    const error = new Error('Service unavailable');
    mockPatch.mockRejectedValue(error);
    mockHandleApiError.mockReturnValue('Error during restartWorkerGroup');

    const result = await restartWorkerGroup();

    expect(result).toEqual({ success: false, error: 'Error during restartWorkerGroup' });
    expect(mockHandleApiError).toHaveBeenCalledWith(error, 'restartWorkerGroup');
  });
});
