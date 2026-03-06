import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config', () => ({
  config: {
    cribl: { baseUrl: 'http://test:9000', auth: { type: 'local', username: 'admin', password: 'pass' } },
    server: { name: 'test', version: '1.0.0' }
  }
}));

vi.mock('../../src/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
    defaults: { headers: { common: {} } }
  },
  handleApiError: vi.fn((err, ctx) => `Error during ${ctx}`)
}));

import { apiClient, handleApiError } from '../../src/api/client';
import {
  getSystemInfo,
  getSystemMetrics,
  getUsers,
  getAlerts,
  getNotifications,
  getAppLog
} from '../../src/api/system';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockHandleApiError = handleApiError as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSystemInfo', () => {
  it('should return system info from items array response', async () => {
    const info = { version: '4.0.0', build: '12345', os: 'linux' };
    mockGet.mockResolvedValue({ data: { items: [info] } });

    const result = await getSystemInfo();

    expect(result).toEqual({ success: true, data: info });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/system/info');
  });

  it('should return system info from direct object response', async () => {
    const info = { version: '4.0.0', build: '12345', os: 'linux' };
    mockGet.mockResolvedValue({ data: info });

    const result = await getSystemInfo();

    expect(result).toEqual({ success: true, data: info });
  });
});

describe('getSystemMetrics', () => {
  it('should return metrics data as string on success', async () => {
    const metricsText = 'cpu_usage{host="worker1"} 0.42\nmem_usage{host="worker1"} 0.65';
    mockGet.mockResolvedValue({ data: metricsText });

    const result = await getSystemMetrics({ metricNameFilter: 'cpu_usage', numBuckets: 5 });

    expect(result).toEqual({ success: true, data: metricsText });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/system/metrics', {
      params: { metricNameFilter: 'cpu_usage', numBuckets: 5 },
      headers: { 'Accept': 'text/plain' },
      responseType: 'text',
    });
  });

  it('should default numBuckets to 1 when no params are provided', async () => {
    mockGet.mockResolvedValue({ data: 'some_metric 0.1' });

    const result = await getSystemMetrics();

    expect(result).toEqual({ success: true, data: 'some_metric 0.1' });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/system/metrics', {
      params: { numBuckets: 1 },
      headers: { 'Accept': 'text/plain' },
      responseType: 'text',
    });
  });
});

describe('getUsers', () => {
  it('should return users on success', async () => {
    const users = [{ id: 'admin', username: 'admin' }, { id: 'user1', username: 'user1' }];
    mockGet.mockResolvedValue({ data: { items: users } });

    const result = await getUsers();

    expect(result).toEqual({ success: true, data: users });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/system/users');
  });

  it('should return custom error on 404 or 405', async () => {
    const error = new Error('Not Found');
    mockGet.mockRejectedValue(error);
    mockHandleApiError.mockReturnValue('API Error (405) during getUsers: Method Not Allowed');

    const result = await getUsers();

    expect(result).toEqual({
      success: false,
      error: 'Users endpoint not available. On Cribl Cloud, user management is handled through the Cribl Cloud portal, not the API.'
    });
  });
});

describe('getAlerts', () => {
  it('should return alerts with query params', async () => {
    const alerts = [{ id: 'alert1', severity: 'warn' }];
    mockGet.mockResolvedValue({ data: { items: alerts } });

    const result = await getAlerts({ limit: 10, offset: 0, sort: 'severity', filter: 'warn' });

    expect(result).toEqual({ success: true, data: alerts });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/system/messages', {
      params: { limit: 10, offset: 0, sort: 'severity', filter: 'warn' }
    });
  });
});

describe('getNotifications', () => {
  it('should return notifications on success', async () => {
    const notifications = [{ id: 'n1', title: 'Update available' }];
    mockGet.mockResolvedValue({ data: { items: notifications } });

    const result = await getNotifications();

    expect(result).toEqual({ success: true, data: notifications });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/notifications');
  });
});

describe('getAppLog', () => {
  it('should pass limit and set offset to 0 when limit is provided', async () => {
    const logs = [{ message: 'log entry 1' }, { message: 'log entry 2' }];
    mockGet.mockResolvedValue({ data: { items: logs } });

    const result = await getAppLog({ limit: 50 });

    expect(result).toEqual({ success: true, data: logs });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/system/logs', {
      params: { limit: 50, offset: 0 }
    });
  });
});
