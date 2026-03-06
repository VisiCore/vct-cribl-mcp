import { apiClient, handleApiError } from './client.js';
import type { ClientResult, CriblApiResponse, CriblSource } from '../types/index.js';

export async function getSources(groupName: string): Promise<ClientResult<CriblSource[]>> {
    const context = `getSources (Group: ${groupName})`;
    if (!groupName) {
        return { success: false, error: 'Group name is required for getSources.' };
    }
    const url = `/api/v1/m/${groupName}/system/inputs`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblSource[] };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        return { success: false, error: errorMessage };
    }
}

export async function createSource(
    groupName: string,
    source: { id: string; type: string; [key: string]: any }
): Promise<ClientResult<CriblSource>> {
    const context = `createSource (Group: ${groupName}, ID: ${source.id})`;
    if (!groupName) return { success: false, error: 'Group name is required for createSource.' };
    const url = `/api/v1/m/${groupName}/system/inputs`;
    console.error(`[stderr] Attempting API call: POST ${url}`);
    try {
        const response = await apiClient.post<any>(url, source);
        const data = response.data?.items?.[0] || response.data;
        return { success: true, data: data as CriblSource };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function updateSource(
    groupName: string,
    sourceId: string,
    updates: Record<string, any>
): Promise<ClientResult<CriblSource>> {
    const context = `updateSource (Group: ${groupName}, ID: ${sourceId})`;
    if (!groupName) return { success: false, error: 'Group name is required for updateSource.' };
    if (!sourceId) return { success: false, error: 'Source ID is required for updateSource.' };
    const url = `/api/v1/m/${groupName}/system/inputs/${encodeURIComponent(sourceId)}`;
    console.error(`[stderr] Attempting API call: PATCH ${url}`);
    try {
        const response = await apiClient.patch<any>(url, updates);
        const data = response.data?.items?.[0] || response.data;
        return { success: true, data: data as CriblSource };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(404)')) {
            return { success: false, error: `Source '${sourceId}' not found. Use cribl_getSources to list available sources.` };
        }
        return { success: false, error: errMsg };
    }
}

export async function deleteSource(groupName: string, sourceId: string): Promise<ClientResult<any>> {
    const context = `deleteSource (Group: ${groupName}, ID: ${sourceId})`;
    if (!groupName) return { success: false, error: 'Group name is required for deleteSource.' };
    if (!sourceId) return { success: false, error: 'Source ID is required for deleteSource.' };
    const url = `/api/v1/m/${groupName}/system/inputs/${encodeURIComponent(sourceId)}`;
    console.error(`[stderr] Attempting API call: DELETE ${url}`);
    try {
        const response = await apiClient.delete<any>(url);
        return { success: true, data: response.data };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(404)')) {
            return { success: false, error: `Source '${sourceId}' not found. Use cribl_getSources to list available sources.` };
        }
        return { success: false, error: errMsg };
    }
}
