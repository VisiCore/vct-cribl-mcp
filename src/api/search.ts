import { apiClient, handleApiError } from './client.js';
import type { ClientResult, CriblSearchJob } from '../types/index.js';

export async function runSearch(params: {
    query: string;
    earliest?: string;
    latest?: string;
    dataset?: string;
}): Promise<ClientResult<CriblSearchJob>> {
    const context = 'runSearch';
    const url = '/api/v1/search/jobs';
    console.error(`[stderr] Attempting API call: POST ${url} with query: "${params.query}"`);
    try {
        const payload: Record<string, any> = { query: params.query };
        if (params.earliest) payload.earliest = params.earliest;
        if (params.latest) payload.latest = params.latest;
        if (params.dataset) payload.dataset = params.dataset;
        const response = await apiClient.post<any>(url, payload);
        const data = response.data;
        const job = data?.items?.[0] || data;
        return { success: true, data: job as CriblSearchJob };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(404)')) {
            return { success: false, error: `Search endpoint not available. This feature may require Cribl Cloud or Cribl Search. Details: ${errMsg}` };
        }
        return { success: false, error: errMsg };
    }
}

export async function getSearchResults(jobId: string): Promise<ClientResult<any>> {
    const context = `getSearchResults (Job: ${jobId})`;
    if (!jobId) return { success: false, error: 'Job ID is required for getSearchResults.' };
    const url = `/api/v1/search/jobs/${jobId}/results`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<any>(url);
        return { success: true, data: response.data };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(404)')) {
            return { success: false, error: `Search results endpoint not available. Details: ${errMsg}` };
        }
        return { success: false, error: errMsg };
    }
}
