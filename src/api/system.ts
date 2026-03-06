import axios from 'axios';
import { apiClient, handleApiError } from './client.js';
import type { ClientResult, CriblApiResponse, CriblSystemInfo, CriblUser, CriblNotification } from '../types/index.js';

export async function getSystemInfo(): Promise<ClientResult<CriblSystemInfo>> {
    const context = 'getSystemInfo';
    const url = '/api/v1/system/info';
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<any>(url);
        const data = response.data;
        if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
            return { success: true, data: data.items[0] as CriblSystemInfo };
        }
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            return { success: true, data: data as CriblSystemInfo };
        }
        return { success: false, error: 'Unexpected response structure from system/info endpoint.' };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function getSystemMetrics(
    params?: {
        filterExpr?: string | null;
        metricNameFilter?: string | null;
        earliest?: string | null;
        latest?: string | null;
        numBuckets?: number | null;
        wp?: string | null;
    }
): Promise<ClientResult<string>> {
    const context = `getSystemMetrics`;
    const url = `/api/v1/system/metrics`;
    console.error(`[stderr] Attempting API call: GET ${url} with params: ${JSON.stringify(params)}`);

    const queryParams: Record<string, any> = {};
    if (params?.filterExpr != null) queryParams.filterExpr = params.filterExpr;
    if (params?.metricNameFilter != null) queryParams.metricNameFilter = params.metricNameFilter;
    if (params?.earliest != null) queryParams.earliest = params.earliest;
    if (params?.latest != null) queryParams.latest = params.latest;
    if (params?.wp != null) queryParams.wp = params.wp;

    const providedParamKeys = Object.keys(params || {}).filter(k => params?.[k as keyof typeof params] !== undefined && params?.[k as keyof typeof params] !== null);
    if (providedParamKeys.length === 0) {
        queryParams.numBuckets = 1;
        console.error(`[stderr] No specific metrics parameters provided, defaulting to numBuckets=1`);
    } else if (params?.numBuckets != null) {
        queryParams.numBuckets = params.numBuckets;
    }

    try {
        const response = await apiClient.get<string>(url, {
            params: queryParams,
            headers: {
                'Accept': 'text/plain'
            },
            responseType: 'text',
        });
        const responseDataString = typeof response.data === 'string' ? response.data : String(response.data);
        return { success: true, data: responseDataString };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        if (axios.isAxiosError(error) && error.response?.headers?.['content-type']?.includes('text/html')) {
            try {
                const htmlError = error.response.data as string;
                const preMatch = htmlError.match(/<pre>([\s\S]*?)<\/pre>/i);
                if (preMatch && preMatch[1]) {
                    console.error(`[stderr] Extracted HTML error detail for ${context}: ${preMatch[1]}`);
                }
            } catch (htmlParseError) {
                console.error(`[stderr] Failed to parse potential HTML error for ${context}: ${htmlParseError}`);
            }
        }
        return { success: false, error: errorMessage };
    }
}

export async function getUsers(): Promise<ClientResult<CriblUser[]>> {
    const context = 'getUsers';
    const url = '/api/v1/system/users';
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblUser[] };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(405)') || errMsg.includes('(404)')) {
            return { success: false, error: `Users endpoint not available. On Cribl Cloud, user management is handled through the Cribl Cloud portal, not the API.` };
        }
        return { success: false, error: errMsg };
    }
}

export async function getAlerts(params?: {
    limit?: number;
    offset?: number;
    sort?: string;
    filter?: string;
}): Promise<ClientResult<any[]>> {
    const context = 'getAlerts';
    const url = '/api/v1/system/messages';
    console.error(`[stderr] Attempting API call: GET ${url} with params: ${JSON.stringify(params)}`);
    const queryParams: Record<string, any> = {};
    if (params?.limit != null) queryParams.limit = params.limit;
    if (params?.offset != null) queryParams.offset = params.offset;
    if (params?.sort != null) queryParams.sort = params.sort;
    if (params?.filter != null) queryParams.filter = params.filter;
    try {
        const response = await apiClient.get<CriblApiResponse>(url, { params: queryParams });
        return { success: true, data: response.data.items };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        return { success: false, error: errorMessage };
    }
}

export async function getNotifications(): Promise<ClientResult<CriblNotification[]>> {
    const context = 'getNotifications';
    const url = '/api/v1/notifications';
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblNotification[] };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function getAppLog(params?: {
    limit?: number;
    filter?: string;
}): Promise<ClientResult<any[]>> {
    const context = 'getAppLog';
    const url = '/api/v1/system/logs';
    console.error(`[stderr] Attempting API call: GET ${url}`);
    const queryParams: Record<string, any> = {};
    if (params?.limit != null) {
        queryParams.limit = params.limit;
        queryParams.offset = 0;
    }
    if (params?.filter != null) queryParams.filter = params.filter;
    try {
        const response = await apiClient.get<CriblApiResponse>(url, { params: queryParams });
        return { success: true, data: response.data.items };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}
