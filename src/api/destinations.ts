import { apiClient, handleApiError } from './client.js';
import type { ClientResult, CriblApiResponse, CriblDestination } from '../types/index.js';

export async function getDestinations(groupName: string): Promise<ClientResult<CriblDestination[]>> {
    const context = `getDestinations (Group: ${groupName})`;
    if (!groupName) {
        return { success: false, error: 'Group name is required for getDestinations.' };
    }
    const url = `/api/v1/m/${groupName}/system/outputs`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblDestination[] };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        return { success: false, error: errorMessage };
    }
}

export async function createDestination(
    groupName: string,
    destination: { id: string; type: string; [key: string]: any }
): Promise<ClientResult<CriblDestination>> {
    const context = `createDestination (Group: ${groupName}, ID: ${destination.id})`;
    if (!groupName) return { success: false, error: 'Group name is required for createDestination.' };
    const url = `/api/v1/m/${groupName}/system/outputs`;
    console.error(`[stderr] Attempting API call: POST ${url}`);
    try {
        const response = await apiClient.post<any>(url, destination);
        const data = response.data?.items?.[0] || response.data;
        return { success: true, data: data as CriblDestination };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function updateDestination(
    groupName: string,
    destinationId: string,
    updates: Record<string, any>
): Promise<ClientResult<CriblDestination>> {
    const context = `updateDestination (Group: ${groupName}, ID: ${destinationId})`;
    if (!groupName) return { success: false, error: 'Group name is required for updateDestination.' };
    if (!destinationId) return { success: false, error: 'Destination ID is required for updateDestination.' };
    const url = `/api/v1/m/${groupName}/system/outputs/${encodeURIComponent(destinationId)}`;
    console.error(`[stderr] Attempting API call: PATCH ${url}`);
    try {
        const response = await apiClient.patch<any>(url, updates);
        const data = response.data?.items?.[0] || response.data;
        return { success: true, data: data as CriblDestination };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(404)')) {
            return { success: false, error: `Destination '${destinationId}' not found. Use cribl_getDestinations to list available destinations.` };
        }
        return { success: false, error: errMsg };
    }
}

export async function deleteDestination(groupName: string, destinationId: string): Promise<ClientResult<any>> {
    const context = `deleteDestination (Group: ${groupName}, ID: ${destinationId})`;
    if (!groupName) return { success: false, error: 'Group name is required for deleteDestination.' };
    if (!destinationId) return { success: false, error: 'Destination ID is required for deleteDestination.' };
    const url = `/api/v1/m/${groupName}/system/outputs/${encodeURIComponent(destinationId)}`;
    console.error(`[stderr] Attempting API call: DELETE ${url}`);
    try {
        const response = await apiClient.delete<any>(url);
        return { success: true, data: response.data };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(404)')) {
            return { success: false, error: `Destination '${destinationId}' not found. Use cribl_getDestinations to list available destinations.` };
        }
        return { success: false, error: errMsg };
    }
}
