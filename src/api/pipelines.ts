import { apiClient, handleApiError } from './client.js';
import type { ClientResult, CriblApiResponse, CriblPipeline } from '../types/index.js';

export async function getPipelines(groupName: string): Promise<ClientResult<CriblPipeline[]>> {
    const context = `getPipelines (Group: ${groupName})`;
    if (!groupName) {
        return { success: false, error: 'Group name is required for getPipelines.' };
    }
    const url = `/api/v1/m/${groupName}/pipelines`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        return { success: true, data: response.data.items as CriblPipeline[] };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        return { success: false, error: errorMessage };
    }
}

export async function getPipelineConfig(groupName: string, pipelineId: string): Promise<ClientResult<CriblPipeline>> {
    const context = `getPipelineConfig (Group: ${groupName}, ID: ${pipelineId})`;
    if (!groupName) {
        return { success: false, error: 'Group name is required for getPipelineConfig.' };
    }
    if (!pipelineId) {
        return { success: false, error: 'Pipeline ID is required for getPipelineConfig.' };
    }
    const url = `/api/v1/m/${groupName}/pipelines/${pipelineId}`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblPipeline>(url);
        return { success: true, data: response.data };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        return { success: false, error: errorMessage };
    }
}

export async function setPipelineConfig(groupName: string, pipelineId: string, pipelineConfig: any): Promise<ClientResult<CriblPipeline>> {
    const context = `setPipelineConfig (Group: ${groupName}, ID: ${pipelineId})`;
    if (!groupName) {
        return { success: false, error: 'Group name is required for setPipelineConfig.' };
    }
    if (!pipelineId) {
        return { success: false, error: 'Pipeline ID is required for setPipelineConfig.' };
    }
    const url = `/api/v1/m/${groupName}/pipelines/${pipelineId}`;
    console.error(`[stderr] Attempting API call: PATCH ${url}`);
    try {
        console.error(`[stderr] Sending config payload:`, JSON.stringify(pipelineConfig));
        const response = await apiClient.patch<CriblPipeline>(url, pipelineConfig);
        return { success: true, data: response.data };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        console.error(`[stderr] Returning error for ${context}: ${errorMessage}`);
        return { success: false, error: errorMessage };
    }
}

export async function createPipeline(
    groupName: string,
    pipeline: { id: string; conf: { functions: any[] }; description?: string }
): Promise<ClientResult<CriblPipeline>> {
    const context = `createPipeline (Group: ${groupName}, ID: ${pipeline.id})`;
    if (!groupName) return { success: false, error: 'Group name is required for createPipeline.' };
    const url = `/api/v1/m/${groupName}/pipelines`;
    console.error(`[stderr] Attempting API call: POST ${url}`);
    try {
        const response = await apiClient.post<any>(url, pipeline);
        const data = response.data?.items?.[0] || response.data;
        return { success: true, data: data as CriblPipeline };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}

export async function previewPipeline(
    groupName: string,
    pipelineId: string,
    events: any[],
    sampleId?: string
): Promise<ClientResult<any>> {
    const context = `previewPipeline (Group: ${groupName}, Pipeline: ${pipelineId})`;
    if (!groupName) return { success: false, error: 'Group name is required for previewPipeline.' };
    if (!pipelineId) return { success: false, error: 'Pipeline ID is required for previewPipeline.' };
    const url = `/api/v1/m/${groupName}/preview`;
    console.error(`[stderr] Attempting API call: POST ${url} with mode=pipe, pipelineId=${pipelineId}, ${events.length} event(s)`);
    try {
        const payload: Record<string, any> = { mode: 'pipe', pipelineId, events };
        if (sampleId) payload.sampleId = sampleId;
        const response = await apiClient.post<any>(url, payload);
        return { success: true, data: response.data };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(404)')) {
            return { success: false, error: `Pipeline preview endpoint not available. Verify pipeline ID '${pipelineId}' exists.` };
        }
        return { success: false, error: errMsg };
    }
}

export async function deletePipeline(groupName: string, pipelineId: string): Promise<ClientResult<any>> {
    const context = `deletePipeline (Group: ${groupName}, ID: ${pipelineId})`;
    if (!groupName) return { success: false, error: 'Group name is required for deletePipeline.' };
    if (!pipelineId) return { success: false, error: 'Pipeline ID is required for deletePipeline.' };
    const url = `/api/v1/m/${groupName}/pipelines/${encodeURIComponent(pipelineId)}`;
    console.error(`[stderr] Attempting API call: DELETE ${url}`);
    try {
        const response = await apiClient.delete<any>(url);
        return { success: true, data: response.data };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        if (errMsg.includes('(404)')) {
            return { success: false, error: `Pipeline '${pipelineId}' not found. Use cribl_getPipelines to list available pipelines.` };
        }
        return { success: false, error: errMsg };
    }
}
