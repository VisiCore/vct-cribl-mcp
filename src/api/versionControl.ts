import { apiClient, handleApiError } from './client.js';
import type { ClientResult, VersionControlItem, CommitResult, DeployResponse } from '../types/index.js';

export async function versionControl(): Promise<ClientResult<VersionControlItem>> {
    const context = 'versionControl';
    const url = '/api/v1/version/info';
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<{ items: VersionControlItem[], count: number }>(url);

        if (response.data?.items && Array.isArray(response.data.items) && response.data.items.length > 0) {
            const versionInfo = response.data.items[0];
            console.error(`[stderr] ${context}: Version control enabled=${versionInfo.versioning}, remote=${versionInfo.remote || 'none'}, branch=${versionInfo.branch || 'unknown'}`);
            return { success: true, data: versionInfo };
        } else {
            console.error(`[stderr] ${context}: Unexpected response structure or empty items array:`, response.data);
            return {
                success: false,
                error: 'Unexpected response structure from version/info endpoint.'
            };
        }
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        return { success: false, error: errorMessage };
    }
}

export async function commitPipeline(
    message: string
): Promise<ClientResult<CommitResult | null>> {
    const context = `commitPipeline`;
    if (!message || message.trim().length === 0) {
        return { success: false, error: 'Commit message is required for commitPipeline.' };
    }
    const url = `/api/v1/version/commit`;
    console.error(`[stderr] Attempting API call: POST ${url} with message: "${message}"`);
    try {
        const payload = { message: message };
        const response = await apiClient.post<{ items: CommitResult[], count: number }>(url, payload);

        if (response.data?.items &&
            Array.isArray(response.data.items) &&
            response.data.items.length > 0) {

            const commitResult = response.data.items[0];

            if (commitResult.commit) {
                console.error(`[stderr] ${context}: Commit successful - ID: ${commitResult.commit}, Branch: ${commitResult.branch}`);
                if (commitResult.summary) {
                    console.error(`[stderr] ${context}: Files changed - Added: ${commitResult.summary.added || 0}, Modified: ${commitResult.summary.modified || 0}, Deleted: ${commitResult.summary.deleted || 0}`);
                }
                return { success: true, data: commitResult };
            }
        }

        console.error(`[stderr] ${context}: Unable to extract valid commit information from response. Data:`, response.data);
        return {
            success: false,
            error: 'Unable to extract valid commit information from response.',
            data: null
        };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        return { success: false, error: errorMessage, data: null };
    }
}

export async function deployPipeline(
    groupName: string,
    version: string
): Promise<ClientResult<DeployResponse>> {
    const context = `deployPipeline (Group: ${groupName}, Version: ${version})`;
    if (!groupName) return { success: false, error: 'Group name is required for deployPipeline.' };
    if (!version) return { success: false, error: 'Version (commit ID) is required for deployPipeline.' };

    const url = `/api/v1/master/groups/${groupName}/deploy`;
    console.error(`[stderr] Attempting API call: PATCH ${url} with version: "${version}"`);
    try {
        const payload = { version };
        const response = await apiClient.patch<DeployResponse>(url, payload);
        const data = response.data;

        if (data && Array.isArray(data.items) && data.items.length > 0) {
            console.error(`[stderr] ${context}: Deployment API returned ${data.items.length} ConfigGroup items (count=${data.count}).`);
            return { success: true, data };
        }
        const msg = 'Deployment API returned empty items array.';
        console.error(`[stderr] ${context}: ${msg}`);
        return { success: false, error: msg };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        return { success: false, error: errorMessage };
    }
}

export async function getGitDiff(): Promise<ClientResult<any>> {
    const context = 'getGitDiff';
    const url = '/api/v1/version/diff';
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<any>(url);
        const data = response.data?.items?.[0] || response.data;
        return { success: true, data };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
}
