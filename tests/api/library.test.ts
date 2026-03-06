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
  getLookups,
  getLookupContent,
  uploadLookup,
  getPacks,
  getSamples,
  getSampleData,
  getEventBreakers,
  getGlobalVariables,
  getRegexLibrary,
  getParserLibrary,
  getSchemas,
  getDatasets,
} from '../../src/api/library';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPut = apiClient.put as ReturnType<typeof vi.fn>;
const mockHandleApiError = handleApiError as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------- getLookups ----------
describe('getLookups', () => {
  it('returns lookups on success', async () => {
    const items = [{ id: 'lookup1' }, { id: 'lookup2' }];
    mockGet.mockResolvedValueOnce({ data: { items } });

    const result = await getLookups('default');

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/system/lookups');
  });

  it('returns error when group name is empty', async () => {
    const result = await getLookups('');

    expect(result).toEqual({ success: false, error: 'Group name is required for getLookups.' });
    expect(mockGet).not.toHaveBeenCalled();
  });
});

// ---------- getLookupContent ----------
describe('getLookupContent', () => {
  it('returns lookup content on success', async () => {
    const content = { fields: ['a', 'b'], rows: [[1, 2]] };
    mockGet.mockResolvedValueOnce({ data: content });

    const result = await getLookupContent('default', 'myLookup');

    expect(result).toEqual({ success: true, data: content });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/system/lookups/myLookup/content');
  });

  it('returns error when group name is empty', async () => {
    const result = await getLookupContent('', 'myLookup');

    expect(result).toEqual({ success: false, error: 'Group name is required for getLookupContent.' });
  });

  it('returns custom error on 404', async () => {
    mockHandleApiError.mockReturnValueOnce('API Error (404) during getLookupContent');
    mockGet.mockRejectedValueOnce(new Error('not found'));

    const result = await getLookupContent('default', 'missing');

    expect(result.success).toBe(false);
    expect(result.error).toContain("Lookup 'missing' not found");
    expect(result.error).toContain('cribl_getLookups');
  });
});

// ---------- uploadLookup ----------
describe('uploadLookup', () => {
  it('uploads lookup content on success', async () => {
    const content = { fields: ['name', 'value'], items: [['a', '1']] };
    const responseData = { success: true };
    mockPut.mockResolvedValueOnce({ data: responseData });

    const result = await uploadLookup('default', 'myLookup', content);

    expect(result).toEqual({ success: true, data: responseData });
    expect(mockPut).toHaveBeenCalledWith(
      '/api/v1/m/default/system/lookups/myLookup/content',
      content
    );
  });

  it('returns error when group name is empty', async () => {
    const result = await uploadLookup('', 'myLookup', { fields: [], items: [] });

    expect(result).toEqual({ success: false, error: 'Group name is required for uploadLookup.' });
  });
});

// ---------- getPacks ----------
describe('getPacks', () => {
  it('returns packs on success', async () => {
    const items = [{ id: 'pack1' }];
    mockGet.mockResolvedValueOnce({ data: { items } });

    const result = await getPacks('default');

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/packs');
  });

  it('returns error when group name is empty', async () => {
    const result = await getPacks('');

    expect(result).toEqual({ success: false, error: 'Group name is required for getPacks.' });
  });
});

// ---------- getSamples ----------
describe('getSamples', () => {
  it('returns samples on success', async () => {
    const items = [{ id: 'sample1' }];
    mockGet.mockResolvedValueOnce({ data: { items } });

    const result = await getSamples('default');

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/system/samples');
  });

  it('returns error when group name is empty', async () => {
    const result = await getSamples('');

    expect(result).toEqual({ success: false, error: 'Group name is required for getSamples.' });
  });
});

// ---------- getSampleData ----------
describe('getSampleData', () => {
  it('returns sample data on success', async () => {
    const data = [{ event: 'log line 1' }, { event: 'log line 2' }];
    mockGet.mockResolvedValueOnce({ data });

    const result = await getSampleData('default', 'syslog');

    expect(result).toEqual({ success: true, data });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/system/samples/syslog/content');
  });

  it('returns error when group name is empty', async () => {
    const result = await getSampleData('', 'syslog');

    expect(result).toEqual({ success: false, error: 'Group name is required for getSampleData.' });
  });

  it('returns custom error on 404', async () => {
    mockHandleApiError.mockReturnValueOnce('API Error (404) during getSampleData');
    mockGet.mockRejectedValueOnce(new Error('not found'));

    const result = await getSampleData('default', 'missing');

    expect(result.success).toBe(false);
    expect(result.error).toContain("Sample 'missing' not found");
    expect(result.error).toContain('cribl_getSamples');
  });
});

// ---------- getEventBreakers ----------
describe('getEventBreakers', () => {
  it('returns event breakers on success', async () => {
    const items = [{ id: 'eb1', rules: [] }];
    mockGet.mockResolvedValueOnce({ data: { items } });

    const result = await getEventBreakers('default');

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/lib/breakers');
  });

  it('returns error when group name is empty', async () => {
    const result = await getEventBreakers('');

    expect(result).toEqual({ success: false, error: 'Group name is required for getEventBreakers.' });
  });
});

// ---------- getGlobalVariables ----------
describe('getGlobalVariables', () => {
  it('returns global variables on success', async () => {
    const items = [{ id: 'var1', value: 'hello' }];
    mockGet.mockResolvedValueOnce({ data: { items } });

    const result = await getGlobalVariables('default');

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/lib/vars');
  });

  it('returns error when group name is empty', async () => {
    const result = await getGlobalVariables('');

    expect(result).toEqual({ success: false, error: 'Group name is required for getGlobalVariables.' });
  });
});

// ---------- getRegexLibrary ----------
describe('getRegexLibrary', () => {
  it('returns regex library on success', async () => {
    const items = [{ id: 'regex1', lib: 'syslog' }];
    mockGet.mockResolvedValueOnce({ data: { items } });

    const result = await getRegexLibrary('default');

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/lib/regex');
  });

  it('returns error when group name is empty', async () => {
    const result = await getRegexLibrary('');

    expect(result).toEqual({ success: false, error: 'Group name is required for getRegexLibrary.' });
  });
});

// ---------- getParserLibrary ----------
describe('getParserLibrary', () => {
  it('returns parser library on success', async () => {
    const items = [{ id: 'parser1' }];
    mockGet.mockResolvedValueOnce({ data: { items } });

    const result = await getParserLibrary('default');

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/lib/parsers');
  });

  it('returns error when group name is empty', async () => {
    const result = await getParserLibrary('');

    expect(result).toEqual({ success: false, error: 'Group name is required for getParserLibrary.' });
  });
});

// ---------- getSchemas ----------
describe('getSchemas', () => {
  it('returns schemas on success', async () => {
    const items = [{ id: 'schema1' }];
    mockGet.mockResolvedValueOnce({ data: { items } });

    const result = await getSchemas('default');

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/lib/schemas');
  });

  it('returns error when group name is empty', async () => {
    const result = await getSchemas('');

    expect(result).toEqual({ success: false, error: 'Group name is required for getSchemas.' });
  });
});

// ---------- getDatasets ----------
describe('getDatasets', () => {
  it('returns datasets on success', async () => {
    const items = [{ id: 'ds1', type: 'provider' }];
    mockGet.mockResolvedValueOnce({ data: { items } });

    const result = await getDatasets('default');

    expect(result).toEqual({ success: true, data: items });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/default/lib/dataset-providers');
  });

  it('returns error when group name is empty', async () => {
    const result = await getDatasets('');

    expect(result).toEqual({ success: false, error: 'Group name is required for getDatasets.' });
  });

  it('returns custom error on 404 about feature not supported', async () => {
    mockHandleApiError.mockReturnValueOnce('API Error (404) during getDatasets');
    mockGet.mockRejectedValueOnce(new Error('not found'));

    const result = await getDatasets('default');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Dataset providers endpoint not available');
    expect(result.error).toContain('not be supported');
  });
});
