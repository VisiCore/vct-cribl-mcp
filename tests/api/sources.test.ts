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
import { getSources, createSource, updateSource, deleteSource } from '../../src/api/sources';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>;
const mockDelete = apiClient.delete as ReturnType<typeof vi.fn>;
const mockHandleApiError = handleApiError as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSources', () => {
  it('should return sources on success', async () => {
    const items = [{ id: 'src1', type: 'syslog' }, { id: 'src2', type: 'http' }];
    mockGet.mockResolvedValue({ data: { items } });

    const result = await getSources('default');

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/system/inputs');
  });

  it('should return error when group name is empty', async () => {
    const result = await getSources('');

    expect(result).toEqual({ success: false, error: 'Group name is required for getSources.' });
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('createSource', () => {
  it('should create a source and extract items[0] from response', async () => {
    const newSource = { id: 'src1', type: 'syslog' };
    mockPost.mockResolvedValue({ data: { items: [newSource] } });

    const result = await createSource('default', newSource);

    expect(result).toEqual({ success: true, data: newSource });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/m/default/system/inputs', newSource);
  });

  it('should fall back to response.data when items is not present', async () => {
    const newSource = { id: 'src1', type: 'syslog' };
    const responseData = { id: 'src1', type: 'syslog', status: 'created' };
    mockPost.mockResolvedValue({ data: responseData });

    const result = await createSource('default', newSource);

    expect(result).toEqual({ success: true, data: responseData });
  });
});

describe('updateSource', () => {
  it('should update a source on success', async () => {
    const updated = { id: 'src1', type: 'syslog', disabled: true };
    mockPatch.mockResolvedValue({ data: { items: [updated] } });

    const result = await updateSource('default', 'src1', { disabled: true });

    expect(result).toEqual({ success: true, data: updated });
    expect(mockPatch).toHaveBeenCalledWith(
      '/api/v1/m/default/system/inputs/src1',
      { disabled: true }
    );
  });

  it('should return custom error when source is not found (404)', async () => {
    const error = new Error('Not Found');
    mockPatch.mockRejectedValue(error);
    mockHandleApiError.mockReturnValue('API Error (404) during updateSource (Group: default, ID: missing): Not Found');

    const result = await updateSource('default', 'missing', { disabled: true });

    expect(result).toEqual({
      success: false,
      error: "Source 'missing' not found. Use cribl_getSources to list available sources."
    });
  });
});

describe('deleteSource', () => {
  it('should delete a source on success', async () => {
    mockDelete.mockResolvedValue({ data: { items: [] } });

    const result = await deleteSource('default', 'src1');

    expect(result).toEqual({ success: true, data: { items: [] } });
    expect(mockDelete).toHaveBeenCalledWith('/api/v1/m/default/system/inputs/src1');
  });

  it('should return custom error when source is not found (404)', async () => {
    const error = new Error('Not Found');
    mockDelete.mockRejectedValue(error);
    mockHandleApiError.mockReturnValue('API Error (404) during deleteSource (Group: default, ID: gone): Not Found');

    const result = await deleteSource('default', 'gone');

    expect(result).toEqual({
      success: false,
      error: "Source 'gone' not found. Use cribl_getSources to list available sources."
    });
  });
});
