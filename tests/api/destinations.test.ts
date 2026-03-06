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
import { getDestinations, createDestination, updateDestination, deleteDestination } from '../../src/api/destinations';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>;
const mockDelete = apiClient.delete as ReturnType<typeof vi.fn>;
const mockHandleApiError = handleApiError as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getDestinations', () => {
  it('should return destinations on success', async () => {
    const items = [{ id: 'dest1', type: 's3' }, { id: 'dest2', type: 'splunk' }];
    mockGet.mockResolvedValue({ data: { items } });

    const result = await getDestinations('default');

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/system/outputs');
  });

  it('should return error when group name is empty', async () => {
    const result = await getDestinations('');

    expect(result).toEqual({ success: false, error: 'Group name is required for getDestinations.' });
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('createDestination', () => {
  it('should create a destination and extract items[0] from response', async () => {
    const newDest = { id: 'dest1', type: 's3' };
    mockPost.mockResolvedValue({ data: { items: [newDest] } });

    const result = await createDestination('default', newDest);

    expect(result).toEqual({ success: true, data: newDest });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/m/default/system/outputs', newDest);
  });

  it('should fall back to response.data when items is not present', async () => {
    const newDest = { id: 'dest1', type: 's3' };
    const responseData = { id: 'dest1', type: 's3', status: 'created' };
    mockPost.mockResolvedValue({ data: responseData });

    const result = await createDestination('default', newDest);

    expect(result).toEqual({ success: true, data: responseData });
  });
});

describe('updateDestination', () => {
  it('should update a destination on success', async () => {
    const updated = { id: 'dest1', type: 's3', disabled: true };
    mockPatch.mockResolvedValue({ data: { items: [updated] } });

    const result = await updateDestination('default', 'dest1', { disabled: true });

    expect(result).toEqual({ success: true, data: updated });
    expect(mockPatch).toHaveBeenCalledWith(
      '/api/v1/m/default/system/outputs/dest1',
      { disabled: true }
    );
  });

  it('should return custom error when destination is not found (404)', async () => {
    const error = new Error('Not Found');
    mockPatch.mockRejectedValue(error);
    mockHandleApiError.mockReturnValue('API Error (404) during updateDestination (Group: default, ID: missing): Not Found');

    const result = await updateDestination('default', 'missing', { disabled: true });

    expect(result).toEqual({
      success: false,
      error: "Destination 'missing' not found. Use cribl_getDestinations to list available destinations."
    });
  });
});

describe('deleteDestination', () => {
  it('should delete a destination on success', async () => {
    mockDelete.mockResolvedValue({ data: { items: [] } });

    const result = await deleteDestination('default', 'dest1');

    expect(result).toEqual({ success: true, data: { items: [] } });
    expect(mockDelete).toHaveBeenCalledWith('/api/v1/m/default/system/outputs/dest1');
  });

  it('should return custom error when destination is not found (404)', async () => {
    const error = new Error('Not Found');
    mockDelete.mockRejectedValue(error);
    mockHandleApiError.mockReturnValue('API Error (404) during deleteDestination (Group: default, ID: gone): Not Found');

    const result = await deleteDestination('default', 'gone');

    expect(result).toEqual({
      success: false,
      error: "Destination 'gone' not found. Use cribl_getDestinations to list available destinations."
    });
  });
});
