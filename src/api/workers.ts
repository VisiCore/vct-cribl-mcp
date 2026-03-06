import { apiClient, handleApiError } from './client.js';
import type { ClientResult, CriblApiResponse, CriblWorkerGroup, CriblWorker } from '../types/index.js';

export async function listWorkerGroups(): Promise<ClientResult<CriblWorkerGroup[]>> {
    const context = 'listWorkerGroups';
    const url = '/api/v1/master/groups';
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblWorkerGroup[] };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        return { success: false, error: errorMessage };
    }
}

export async function getWorkers(): Promise<ClientResult<CriblWorker[]>> {
    const context = 'getWorkers';
    const url = '/api/v1/master/workers';
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblWorker[] };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function restartWorkerGroup(): Promise<ClientResult<{ message: string }>> {
    const context = `restartWorkerGroup`;
    const url = `/api/v1/master/workers/restart`;
    console.error(`[stderr] Attempting API call: PATCH ${url} - WARNING: This likely restarts ALL workers managed by the Leader.`);
    try {
        const response = await apiClient.patch(url);
        return { success: true, data: { message: `Successfully initiated worker restart. Response status: ${response.status}` } };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        return { success: false, error: errorMessage };
    }
}
