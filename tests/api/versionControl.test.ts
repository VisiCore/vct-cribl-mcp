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
  versionControl,
  commitPipeline,
  deployPipeline,
  getGitDiff,
} from '../../src/api/versionControl';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>;
const mockHandleApiError = handleApiError as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------- versionControl ----------
describe('versionControl', () => {
  it('returns version info on success (items[0])', async () => {
    const versionInfo = { versioning: true, remote: 'origin', branch: 'main' };
    mockGet.mockResolvedValueOnce({ data: { items: [versionInfo], count: 1 } });

    const result = await versionControl();

    expect(result).toEqual({ success: true, data: versionInfo });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/version/info');
  });

  it('returns error when items array is empty', async () => {
    mockGet.mockResolvedValueOnce({ data: { items: [], count: 0 } });

    const result = await versionControl();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unexpected response structure');
  });
});

// ---------- commitPipeline ----------
describe('commitPipeline', () => {
  it('returns commit result on success', async () => {
    const commitResult = {
      commit: 'abc123',
      branch: 'main',
      summary: { added: 1, modified: 2, deleted: 0 },
    };
    mockPost.mockResolvedValueOnce({ data: { items: [commitResult], count: 1 } });

    const result = await commitPipeline('Add new pipeline');

    expect(result).toEqual({ success: true, data: commitResult });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/version/commit', { message: 'Add new pipeline' });
  });

  it('returns error when message is empty', async () => {
    const result = await commitPipeline('');

    expect(result).toEqual({ success: false, error: 'Commit message is required for commitPipeline.' });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('returns error when message is whitespace only', async () => {
    const result = await commitPipeline('   ');

    expect(result).toEqual({ success: false, error: 'Commit message is required for commitPipeline.' });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('returns error when no commit in response', async () => {
    mockPost.mockResolvedValueOnce({ data: { items: [{ branch: 'main' }], count: 1 } });

    const result = await commitPipeline('Some change');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to extract valid commit information');
    expect(result.data).toBeNull();
  });
});

// ---------- deployPipeline ----------
describe('deployPipeline', () => {
  it('returns deploy response on success', async () => {
    const deployData = { items: [{ id: 'default', version: 'abc123' }], count: 1 };
    mockPatch.mockResolvedValueOnce({ data: deployData });

    const result = await deployPipeline('default', 'abc123');

    expect(result).toEqual({ success: true, data: deployData });
    expect(mockPatch).toHaveBeenCalledWith('/api/v1/master/groups/default/deploy', { version: 'abc123' });
  });

  it('returns error when group name is empty', async () => {
    const result = await deployPipeline('', 'abc123');

    expect(result).toEqual({ success: false, error: 'Group name is required for deployPipeline.' });
  });

  it('returns error when version is empty', async () => {
    const result = await deployPipeline('default', '');

    expect(result).toEqual({ success: false, error: 'Version (commit ID) is required for deployPipeline.' });
  });

  it('returns error when items array is empty', async () => {
    mockPatch.mockResolvedValueOnce({ data: { items: [], count: 0 } });

    const result = await deployPipeline('default', 'abc123');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Deployment API returned empty items array');
  });
});

// ---------- getGitDiff ----------
describe('getGitDiff', () => {
  it('returns diff data on success', async () => {
    const diffItem = { files: ['pipelines/main.json'], additions: 5, deletions: 2 };
    mockGet.mockResolvedValueOnce({ data: { items: [diffItem] } });

    const result = await getGitDiff();

    expect(result).toEqual({ success: true, data: diffItem });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/version/diff');
  });
});
