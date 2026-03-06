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
import {
  getPipelines,
  getPipelineConfig,
  setPipelineConfig,
  createPipeline,
  previewPipeline,
  deletePipeline,
} from '../../src/api/pipelines';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>;
const mockDelete = apiClient.delete as ReturnType<typeof vi.fn>;
const mockHandleApiError = handleApiError as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getPipelines
// ---------------------------------------------------------------------------
describe('getPipelines', () => {
  it('should return pipeline items on success', async () => {
    const items = [{ id: 'pipe1' }, { id: 'pipe2' }];
    mockGet.mockResolvedValue({ data: { items } });

    const result = await getPipelines('default');

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/pipelines');
  });

  it('should return an error when groupName is empty', async () => {
    const result = await getPipelines('');

    expect(result).toEqual({ success: false, error: 'Group name is required for getPipelines.' });
    expect(mockGet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getPipelineConfig
// ---------------------------------------------------------------------------
describe('getPipelineConfig', () => {
  it('should return pipeline config on success', async () => {
    const pipeline = { id: 'pipe1', conf: { functions: [] } };
    mockGet.mockResolvedValue({ data: pipeline });

    const result = await getPipelineConfig('default', 'pipe1');

    expect(result).toEqual({ success: true, data: pipeline });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/pipelines/pipe1');
  });

  it('should return an error when pipelineId is missing', async () => {
    const result = await getPipelineConfig('default', '');

    expect(result).toEqual({ success: false, error: 'Pipeline ID is required for getPipelineConfig.' });
    expect(mockGet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// setPipelineConfig
// ---------------------------------------------------------------------------
describe('setPipelineConfig', () => {
  it('should return updated pipeline config on success', async () => {
    const updatedPipeline = { id: 'pipe1', conf: { functions: [{ id: 'fn1' }] } };
    const configPayload = { conf: { functions: [{ id: 'fn1' }] } };
    mockPatch.mockResolvedValue({ data: updatedPipeline });

    const result = await setPipelineConfig('default', 'pipe1', configPayload);

    expect(result).toEqual({ success: true, data: updatedPipeline });
    expect(mockPatch).toHaveBeenCalledWith('/api/v1/m/default/pipelines/pipe1', configPayload);
  });
});

// ---------------------------------------------------------------------------
// createPipeline
// ---------------------------------------------------------------------------
describe('createPipeline', () => {
  it('should extract items[0] from response when present', async () => {
    const created = { id: 'newPipe', conf: { functions: [] } };
    mockPost.mockResolvedValue({ data: { items: [created] } });

    const pipeline = { id: 'newPipe', conf: { functions: [] }, description: 'A new pipeline' };
    const result = await createPipeline('default', pipeline);

    expect(result).toEqual({ success: true, data: created });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/m/default/pipelines', pipeline);
  });

  it('should fall back to response.data when items is not present', async () => {
    const created = { id: 'newPipe', conf: { functions: [] } };
    mockPost.mockResolvedValue({ data: created });

    const pipeline = { id: 'newPipe', conf: { functions: [] } };
    const result = await createPipeline('default', pipeline);

    expect(result).toEqual({ success: true, data: created });
  });
});

// ---------------------------------------------------------------------------
// previewPipeline
// ---------------------------------------------------------------------------
describe('previewPipeline', () => {
  it('should return preview data on success', async () => {
    const previewResult = { events: [{ _raw: 'transformed' }] };
    mockPost.mockResolvedValue({ data: previewResult });

    const events = [{ _raw: 'original' }];
    const result = await previewPipeline('default', 'pipe1', events);

    expect(result).toEqual({ success: true, data: previewResult });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/m/default/preview', {
      mode: 'pipe',
      pipelineId: 'pipe1',
      events,
    });
  });

  it('should return a custom error message on 404', async () => {
    const error = new Error('Not Found');
    mockPost.mockRejectedValue(error);
    mockHandleApiError.mockReturnValue('API Error (404) during previewPipeline: Not Found');

    const result = await previewPipeline('default', 'pipe1', []);

    expect(result).toEqual({
      success: false,
      error: "Pipeline preview endpoint not available. Verify pipeline ID 'pipe1' exists.",
    });
  });
});

// ---------------------------------------------------------------------------
// deletePipeline
// ---------------------------------------------------------------------------
describe('deletePipeline', () => {
  it('should return response data on success', async () => {
    const deleteResponse = { items: [] };
    mockDelete.mockResolvedValue({ data: deleteResponse });

    const result = await deletePipeline('default', 'pipe1');

    expect(result).toEqual({ success: true, data: deleteResponse });
    expect(mockDelete).toHaveBeenCalledWith('/api/v1/m/default/pipelines/pipe1');
  });

  it('should return a custom error message on 404', async () => {
    const error = new Error('Not Found');
    mockDelete.mockRejectedValue(error);
    mockHandleApiError.mockReturnValue('API Error (404) during deletePipeline: Not Found');

    const result = await deletePipeline('default', 'pipe1');

    expect(result).toEqual({
      success: false,
      error: "Pipeline 'pipe1' not found. Use cribl_getPipelines to list available pipelines.",
    });
  });
});
