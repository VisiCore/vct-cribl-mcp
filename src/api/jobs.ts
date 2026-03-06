import { apiClient, handleApiError } from './client.js';
import type { ClientResult, CriblApiResponse, CriblJob, CriblCollector } from '../types/index.js';

export async function getJobs(groupName: string): Promise<ClientResult<CriblJob[]>> {
    const context = `getJobs (Group: ${groupName})`;
    if (!groupName) return { success: false, error: 'Group name is required for getJobs.' };
    const url = `/api/v1/m/${groupName}/jobs`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblJob[] };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function getCollectors(groupName: string): Promise<ClientResult<CriblCollector[]>> {
    const context = `getCollectors (Group: ${groupName})`;
    if (!groupName) return { success: false, error: 'Group name is required for getCollectors.' };
    const url = `/api/v1/m/${groupName}/collectors`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblCollector[] };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function runCollectorJob(
    groupName: string,
    collectorId: string,
    configOverrides?: Record<string, any>
): Promise<ClientResult<any>> {
    const context = `runCollectorJob (Group: ${groupName}, Collector: ${collectorId})`;
    if (!groupName) return { success: false, error: 'Group name is required for runCollectorJob.' };
    if (!collectorId) return { success: false, error: 'Collector ID is required for runCollectorJob.' };
    const url = `/api/v1/m/${groupName}/lib/jobs`;
    console.error(`[stderr] Attempting API call: POST ${url} to run collector ${collectorId}`);
    try {
        const payload: Record<string, any> = {
            collector: collectorId,
            type: 'collection',
        };
        if (configOverrides) payload.configOverrides = configOverrides;
        const response = await apiClient.post<any>(url, payload);
        const data = response.data?.items?.[0] || response.data;
        return { success: true, data };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(404)')) {
            return { success: false, error: `Collector job endpoint not available. Use cribl_getJobs to see existing jobs.` };
        }
        return { success: false, error: errMsg };
    }
}
