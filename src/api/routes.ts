import { apiClient, handleApiError } from './client.js';
import type { ClientResult, CriblApiResponse, CriblRoute } from '../types/index.js';

export async function getRoutes(groupName: string): Promise<ClientResult<CriblRoute[]>> {
    const context = `getRoutes (Group: ${groupName})`;
    if (!groupName) {
        return { success: false, error: 'Group name is required for getRoutes.' };
    }
    const url = `/api/v1/m/${groupName}/routes`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblRoute[] };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        return { success: false, error: errorMessage };
    }
}

export async function createRoute(
    groupName: string,
    route: { id: string; output: string; name?: string; filter?: string; pipeline?: string; enabled?: boolean; description?: string }
): Promise<ClientResult<CriblRoute>> {
    const context = `createRoute (Group: ${groupName}, ID: ${route.id})`;
    if (!groupName) return { success: false, error: 'Group name is required for createRoute.' };
    const url = `/api/v1/m/${groupName}/routes`;
    console.error(`[stderr] Attempting read-modify-write on: ${url}`);
    try {
        const getResponse = await apiClient.get<CriblApiResponse>(url);
        const wrapper = getResponse.data.items?.[0];
        if (!wrapper || !Array.isArray(wrapper.routes)) {
            return { success: false, error: 'Unexpected routes response structure: missing items[0].routes array.' };
        }
        const newRoute: CriblRoute = {
            id: route.id,
            output: route.output,
            name: route.name,
            filter: route.filter ?? 'true',
            pipeline: route.pipeline,
            enabled: route.enabled ?? true,
            description: route.description,
        };
        wrapper.routes.push(newRoute);
        const patchResponse = await apiClient.patch<any>(url, wrapper);
        return { success: true, data: newRoute };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function toggleRoute(
    groupName: string,
    routeId: string,
    enabled: boolean
): Promise<ClientResult<CriblRoute>> {
    const context = `toggleRoute (Group: ${groupName}, Route: ${routeId}, Enabled: ${enabled})`;
    if (!groupName) return { success: false, error: 'Group name is required for toggleRoute.' };
    if (!routeId) return { success: false, error: 'Route ID is required for toggleRoute.' };
    const url = `/api/v1/m/${groupName}/routes`;
    console.error(`[stderr] Attempting read-modify-write on: ${url}`);
    try {
        const getResponse = await apiClient.get<CriblApiResponse>(url);
        const wrapper = getResponse.data.items?.[0];
        if (!wrapper || !Array.isArray(wrapper.routes)) {
            return { success: false, error: 'Unexpected routes response structure: missing items[0].routes array.' };
        }
        const targetRoute = wrapper.routes.find((r: any) => r.id === routeId);
        if (!targetRoute) {
            const availableIds = wrapper.routes.map((r: any) => r.id);
            return { success: false, error: `Route '${routeId}' not found. Available routes: [${availableIds.join(', ')}]` };
        }
        targetRoute.enabled = enabled;
        await apiClient.patch<any>(url, wrapper);
        return { success: true, data: targetRoute as CriblRoute };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function deleteRoute(groupName: string, routeId: string): Promise<ClientResult<any>> {
    const context = `deleteRoute (Group: ${groupName}, Route: ${routeId})`;
    if (!groupName) return { success: false, error: 'Group name is required for deleteRoute.' };
    if (!routeId) return { success: false, error: 'Route ID is required for deleteRoute.' };
    const url = `/api/v1/m/${groupName}/routes`;
    console.error(`[stderr] Attempting read-modify-write on: ${url} to remove route ${routeId}`);
    try {
        const getResponse = await apiClient.get<CriblApiResponse>(url);
        const wrapper = getResponse.data.items?.[0];
        if (!wrapper || !Array.isArray(wrapper.routes)) {
            return { success: false, error: 'Unexpected routes response structure: missing items[0].routes array.' };
        }
        const originalLength = wrapper.routes.length;
        wrapper.routes = wrapper.routes.filter((r: any) => r.id !== routeId);
        if (wrapper.routes.length === originalLength) {
            const availableIds = wrapper.routes.map((r: any) => r.id);
            return { success: false, error: `Route '${routeId}' not found. Available routes: [${availableIds.join(', ')}]` };
        }
        await apiClient.patch<any>(url, wrapper);
        return { success: true, data: { message: `Route '${routeId}' deleted successfully.` } };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}
