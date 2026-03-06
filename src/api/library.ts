import { apiClient, handleApiError } from './client.js';
import type {
    ClientResult, CriblApiResponse,
    CriblLookup, CriblPack, CriblSample,
    CriblEventBreakerRuleset, CriblGlobalVariable,
    CriblDatasetProvider, CriblRegexEntry, CriblParser, CriblSchema,
} from '../types/index.js';

export async function getLookups(groupName: string): Promise<ClientResult<CriblLookup[]>> {
    const context = `getLookups (Group: ${groupName})`;
    if (!groupName) return { success: false, error: 'Group name is required for getLookups.' };
    const url = `/api/v1/m/${groupName}/system/lookups`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblLookup[] };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function getLookupContent(groupName: string, lookupId: string): Promise<ClientResult<any>> {
    const context = `getLookupContent (Group: ${groupName}, Lookup: ${lookupId})`;
    if (!groupName) return { success: false, error: 'Group name is required for getLookupContent.' };
    if (!lookupId) return { success: false, error: 'Lookup ID is required for getLookupContent.' };
    const url = `/api/v1/m/${groupName}/system/lookups/${encodeURIComponent(lookupId)}/content`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<any>(url);
        return { success: true, data: response.data };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(404)')) {
            return { success: false, error: `Lookup '${lookupId}' not found. Use cribl_getLookups to list available lookups.` };
        }
        return { success: false, error: errMsg };
    }
}

export async function uploadLookup(
    groupName: string,
    lookupId: string,
    content: { fields: string[]; items: any[][] }
): Promise<ClientResult<any>> {
    const context = `uploadLookup (Group: ${groupName}, Lookup: ${lookupId})`;
    if (!groupName) return { success: false, error: 'Group name is required for uploadLookup.' };
    if (!lookupId) return { success: false, error: 'Lookup ID is required for uploadLookup.' };
    const url = `/api/v1/m/${groupName}/system/lookups/${encodeURIComponent(lookupId)}/content`;
    console.error(`[stderr] Attempting API call: PUT ${url}`);
    try {
        const response = await apiClient.put<any>(url, content);
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function getPacks(groupName: string): Promise<ClientResult<CriblPack[]>> {
    const context = `getPacks (Group: ${groupName})`;
    if (!groupName) return { success: false, error: 'Group name is required for getPacks.' };
    const url = `/api/v1/m/${groupName}/packs`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblPack[] };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function getSamples(groupName: string): Promise<ClientResult<CriblSample[]>> {
    const context = `getSamples (Group: ${groupName})`;
    if (!groupName) return { success: false, error: 'Group name is required for getSamples.' };
    const url = `/api/v1/m/${groupName}/system/samples`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblSample[] };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function getSampleData(groupName: string, sampleId: string): Promise<ClientResult<any[]>> {
    const context = `getSampleData (Group: ${groupName}, Sample: ${sampleId})`;
    if (!groupName) return { success: false, error: 'Group name is required for getSampleData.' };
    if (!sampleId) return { success: false, error: 'Sample ID is required for getSampleData.' };
    const url = `/api/v1/m/${groupName}/system/samples/${encodeURIComponent(sampleId)}/content`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<any>(url);
        const data = Array.isArray(response.data) ? response.data : response.data?.items || response.data;
        return { success: true, data };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(404)')) {
            return { success: false, error: `Sample '${sampleId}' not found. Use cribl_getSamples to list available samples.` };
        }
        return { success: false, error: errMsg };
    }
}

export async function getEventBreakers(groupName: string): Promise<ClientResult<CriblEventBreakerRuleset[]>> {
    const context = `getEventBreakers (Group: ${groupName})`;
    if (!groupName) return { success: false, error: 'Group name is required for getEventBreakers.' };
    const url = `/api/v1/m/${groupName}/lib/breakers`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblEventBreakerRuleset[] };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function getGlobalVariables(groupName: string): Promise<ClientResult<CriblGlobalVariable[]>> {
    const context = `getGlobalVariables (Group: ${groupName})`;
    if (!groupName) return { success: false, error: 'Group name is required for getGlobalVariables.' };
    const url = `/api/v1/m/${groupName}/lib/vars`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblGlobalVariable[] };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function getRegexLibrary(groupName: string): Promise<ClientResult<CriblRegexEntry[]>> {
    const context = `getRegexLibrary (Group: ${groupName})`;
    if (!groupName) return { success: false, error: 'Group name is required for getRegexLibrary.' };
    const url = `/api/v1/m/${groupName}/lib/regex`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblRegexEntry[] };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(404)')) {
            return { success: false, error: `Regex library endpoint not available on this Cribl instance.` };
        }
        return { success: false, error: errMsg };
    }
}

export async function getParserLibrary(groupName: string): Promise<ClientResult<CriblParser[]>> {
    const context = `getParserLibrary (Group: ${groupName})`;
    if (!groupName) return { success: false, error: 'Group name is required for getParserLibrary.' };
    const url = `/api/v1/m/${groupName}/lib/parsers`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblParser[] };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(404)')) {
            return { success: false, error: `Parser library endpoint not available on this Cribl instance.` };
        }
        return { success: false, error: errMsg };
    }
}

export async function getSchemas(groupName: string): Promise<ClientResult<CriblSchema[]>> {
    const context = `getSchemas (Group: ${groupName})`;
    if (!groupName) return { success: false, error: 'Group name is required for getSchemas.' };
    const url = `/api/v1/m/${groupName}/lib/schemas`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblSchema[] };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(404)')) {
            return { success: false, error: `Schemas endpoint not available on this Cribl instance.` };
        }
        return { success: false, error: errMsg };
    }
}

export async function getDatasets(groupName: string): Promise<ClientResult<CriblDatasetProvider[]>> {
    const context = `getDatasets (Group: ${groupName})`;
    if (!groupName) return { success: false, error: 'Group name is required for getDatasets.' };
    const url = `/api/v1/m/${groupName}/lib/dataset-providers`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblDatasetProvider[] };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(404)')) {
            return { success: false, error: `Dataset providers endpoint not available on this Cribl instance. This feature may not be supported in your deployment version.` };
        }
        return { success: false, error: errMsg };
    }
}
