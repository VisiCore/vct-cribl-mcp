import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API client module
vi.mock('../../src/api/client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
  handleApiError: vi.fn((err, ctx) => `Error during ${ctx}`),
}));

// Mock config so the module can load without .env
vi.mock('../../src/config', () => ({
  config: {
    cribl: { baseUrl: 'http://test:9000', auth: { type: 'local', username: 'admin', password: 'pass' } },
    server: { name: 'test', version: '1.0.0' },
  },
}));

import { getRoutes, createRoute, toggleRoute, deleteRoute } from '../../src/api/routes';
import { apiClient } from '../../src/api/client';

// Cast to access mock methods
const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ---------- getRoutes ----------

describe('getRoutes', () => {
  it('should return routes on success', async () => {
    const routes = [
      { id: 'route1', output: 'dest1', enabled: true },
      { id: 'route2', output: 'dest2', enabled: false },
    ];
    mockGet.mockResolvedValueOnce({ data: { items: routes } });

    const result = await getRoutes('myGroup');
    expect(result).toEqual({ success: true, data: routes });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/m/myGroup/routes');
  });

  it('should return error when groupName is empty', async () => {
    const result = await getRoutes('');
    expect(result).toEqual({ success: false, error: 'Group name is required for getRoutes.' });
    expect(mockGet).not.toHaveBeenCalled();
  });
});

// ---------- createRoute ----------

describe('createRoute', () => {
  it('should append a new route to the existing routes array', async () => {
    const existingRoutes = [
      { id: 'existing1', output: 'dest1', enabled: true },
    ];
    const wrapper = { id: 'default', routes: [...existingRoutes] };

    mockGet.mockResolvedValueOnce({
      data: { items: [wrapper] },
    });
    mockPatch.mockResolvedValueOnce({ data: {} });

    const newRouteInput = { id: 'newRoute', output: 'newDest', name: 'My Route' };
    const result = await createRoute('myGroup', newRouteInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      id: 'newRoute',
      output: 'newDest',
      name: 'My Route',
      filter: 'true',
      pipeline: undefined,
      enabled: true,
      description: undefined,
    });

    // The patch should have been called with the wrapper that now includes the new route
    expect(mockPatch).toHaveBeenCalledWith(
      '/api/v1/m/myGroup/routes',
      expect.objectContaining({
        routes: expect.arrayContaining([
          expect.objectContaining({ id: 'newRoute' }),
        ]),
      })
    );
  });

  it('should return error when response has unexpected structure', async () => {
    // items[0] has no routes array
    mockGet.mockResolvedValueOnce({
      data: { items: [{ id: 'default' }] },
    });

    const result = await createRoute('myGroup', { id: 'r1', output: 'dest' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unexpected routes response structure');
    expect(mockPatch).not.toHaveBeenCalled();
  });
});

// ---------- toggleRoute ----------

describe('toggleRoute', () => {
  it('should find and toggle the correct route', async () => {
    const routes = [
      { id: 'routeA', output: 'dest1', enabled: true },
      { id: 'routeB', output: 'dest2', enabled: false },
    ];
    const wrapper = { id: 'default', routes: [...routes.map((r) => ({ ...r }))] };

    mockGet.mockResolvedValueOnce({ data: { items: [wrapper] } });
    mockPatch.mockResolvedValueOnce({ data: {} });

    const result = await toggleRoute('myGroup', 'routeB', true);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(expect.objectContaining({ id: 'routeB', enabled: true }));
    expect(mockPatch).toHaveBeenCalledWith(
      '/api/v1/m/myGroup/routes',
      expect.objectContaining({
        routes: expect.arrayContaining([
          expect.objectContaining({ id: 'routeB', enabled: true }),
        ]),
      })
    );
  });

  it('should return error when route is not found', async () => {
    const wrapper = {
      id: 'default',
      routes: [{ id: 'routeA', output: 'dest1', enabled: true }],
    };
    mockGet.mockResolvedValueOnce({ data: { items: [wrapper] } });

    const result = await toggleRoute('myGroup', 'nonExistent', true);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Route 'nonExistent' not found");
    expect(result.error).toContain('routeA');
    expect(mockPatch).not.toHaveBeenCalled();
  });
});

// ---------- deleteRoute ----------

describe('deleteRoute', () => {
  it('should remove the route from the array', async () => {
    const routes = [
      { id: 'routeA', output: 'dest1', enabled: true },
      { id: 'routeB', output: 'dest2', enabled: false },
    ];
    const wrapper = { id: 'default', routes: [...routes.map((r) => ({ ...r }))] };

    mockGet.mockResolvedValueOnce({ data: { items: [wrapper] } });
    mockPatch.mockResolvedValueOnce({ data: {} });

    const result = await deleteRoute('myGroup', 'routeA');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ message: "Route 'routeA' deleted successfully." });

    // The patch should have been called with only routeB remaining
    expect(mockPatch).toHaveBeenCalledWith(
      '/api/v1/m/myGroup/routes',
      expect.objectContaining({
        routes: [expect.objectContaining({ id: 'routeB' })],
      })
    );
  });

  it('should return error when route is not found', async () => {
    const wrapper = {
      id: 'default',
      routes: [{ id: 'routeA', output: 'dest1', enabled: true }],
    };
    mockGet.mockResolvedValueOnce({ data: { items: [wrapper] } });

    const result = await deleteRoute('myGroup', 'ghost');

    expect(result.success).toBe(false);
    expect(result.error).toContain("Route 'ghost' not found");
    expect(result.error).toContain('routeA');
    expect(mockPatch).not.toHaveBeenCalled();
  });
});
