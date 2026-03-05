import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { config } from '../config.js';

// Define interfaces for expected API responses (add more detail as needed)
interface CriblApiResponse {
    items: any[]; // Generic placeholder, refine based on actual Cribl responses
    count?: number;
}

interface CriblPipeline {
    id: string;
    // Add other relevant pipeline fields
    config: any;
}

interface CriblSource {
    id: string;
    // Add other relevant source fields
}

interface CriblDestination {
    id: string;
    type?: string;
}

interface CriblRoute {
    id: string;
    name?: string;
    filter?: string;
    pipeline?: string;
    output?: string;
    enabled?: boolean;
    description?: string;
}

interface CriblLookup {
    id: string;
    fileInfo?: any;
    [key: string]: any;
}

interface CriblPack {
    id: string;
    displayName?: string;
    version?: string;
    author?: string;
    [key: string]: any;
}

interface CriblSample {
    id: string;
    description?: string;
    [key: string]: any;
}

interface CriblEventBreakerRuleset {
    id: string;
    rules?: any[];
    [key: string]: any;
}

interface CriblGlobalVariable {
    id: string;
    type?: string;
    value?: any;
    description?: string;
    [key: string]: any;
}

interface CriblJob {
    id: string;
    status?: string;
    type?: string;
    [key: string]: any;
}

interface CriblDatasetProvider {
    id: string;
    type?: string;
    [key: string]: any;
}

interface CriblSystemInfo {
    version?: string;
    build?: string;
    license?: any;
    uptime?: number;
    [key: string]: any;
}

interface CriblUser {
    id: string;
    username?: string;
    roles?: string[];
    disabled?: boolean;
    [key: string]: any;
}

interface CriblSearchJob {
    id: string;
    status?: string;
    [key: string]: any;
}

interface CriblWorker {
    id: string;
    hostname?: string;
    status?: string;
    version?: string;
    cpuUsage?: number;
    memUsage?: number;
    [key: string]: any;
}

interface CriblRegexEntry {
    id: string;
    lib?: string;
    regex?: string;
    description?: string;
    [key: string]: any;
}

interface CriblParser {
    id: string;
    lib?: string;
    description?: string;
    [key: string]: any;
}

interface CriblSchema {
    id: string;
    lib?: string;
    description?: string;
    [key: string]: any;
}

interface CriblCollector {
    id: string;
    name?: string;
    version?: string;
    disabled?: boolean;
    destroyable?: boolean;
    [key: string]: any;
}

interface CriblNotification {
    id: string;
    condition?: string;
    mode?: string;
    disabled?: boolean;
    targets?: any[];
    [key: string]: any;
}

interface CriblErrorResponse {
    error?: string; // Optional as sometimes only message is present
    message?: string; // Optional
    // Cribl sometimes uses a different error structure
    status?: string | number;
    text?: string;
}

interface CriblCloudTokenResponse {
    access_token: string;
    scope: string;
    expires_in: number; // Seconds
    token_type: 'Bearer';
}

interface CriblLocalTokenResponse {
    token: string; // Includes "Bearer " prefix from API
}

interface ClientResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// Define interface for Worker Group
interface CriblWorkerGroup {
    id: string;
    name?: string;
    description?: string;
    isFleet?: boolean;
    isSearch?: boolean;
    // Add other relevant fields like tags, etc. if needed based on API response
}

// Define more specific response types for version control
interface VersionControlItem {
    versioning: boolean;       // Whether version control is enabled
    remote: string;            // Remote repository URL, if configured
    branch?: string;           // Current branch name
    status?: {                 // Git status information
        staged: any[];         // Staged files information
        unstaged: any[];       // Unstaged changes
        untracked: any[];      // Untracked files
    };
    lastCommit?: {             // Information about the last commit
        id: string;            // Commit hash
        date: string;          // Commit date
        message: string;       // Commit message
        author: string;        // Author of the commit
    };
    [key: string]: any;        // Allow other properties
}

// Define commit response interface
interface CommitResult {
    branch: string;            // Branch name (e.g., "master")
    commit: string;            // Commit ID (hash)
    root: boolean;             // Whether this is a root commit
    summary: {                 // Commit summary information
        added?: number;        // Number of files added
        deleted?: number;      // Number of files deleted
        modified?: number;     // Number of files modified
        [key: string]: any;    // Allow other summary properties
    };
    files: {                   // Information about changed files
        added?: string[];      // Files added in this commit
        deleted?: string[];    // Files deleted in this commit
        modified?: string[];   // Files modified in this commit
        [key: string]: any;    // Allow other file properties
    };
    message?: string;          // Commit message (if available in response)
    [key: string]: any;        // Allow other properties
}

// Define deployment result interface
interface DeploymentResult {
    deployed: boolean;         // Whether deployment was successful
    workerCount?: number;      // Number of workers the deployment was sent to
    started?: string;          // Timestamp when deployment started
    completed?: string;        // Timestamp when deployment completed
    count?: number;            // Number of items affected
    files?: string[];          // List of files deployed
    version?: string;          // Version/commit that was deployed
    groupName?: string;        // Worker group name
    status?: string;           // Status message (e.g., "success", "in-progress", "failed")
    error?: string;            // Error message if deployment failed
    message?: string;          // Additional status message
    [key: string]: any;        // Allow other properties
}

// Insert new ConfigGroup and DeployResponse interfaces below existing interfaces (after CommitResult interface)
interface ConfigGroup {
    id: string;
    name?: string;
    description?: string;
    configVersion?: string;
    workerCount?: number;
    isFleet?: boolean;
    isSearch?: boolean;
    deployingWorkerCount?: number;
    incompatibleWorkerCount?: number;
    tags?: string;
    streamtags?: string[];
    git?: {
        commit?: string;
        localChanges?: number;
        log?: any[];
    };
    // Allow extra fields from API we haven't modelled yet
    [key: string]: any;
}

interface DeployResponse {
    count: number;
    items: ConfigGroup[];
}

// --- Token Management State ---
let accessToken: string | null = null;
let tokenExpiresAt: number = 0; // Store expiry time as timestamp (milliseconds)
let isRefreshingToken: boolean = false;
let tokenRefreshPromise: Promise<void> | null = null;

// --- Axios Instances ---
// Separate instance for auth calls to avoid circular interceptor calls
const authClient: AxiosInstance = axios.create();

// Main API client instance
const apiClient: AxiosInstance = axios.create({
    baseURL: config.cribl.baseUrl,
    headers: {
        'Content-Type': 'application/json',
    },
    validateStatus: function (status) {
        return status >= 200 && status < 300;
    },
});

// --- Error Handling ---
function handleApiError(error: unknown, context: string): string {
    console.error(`[stderr] Raw error intercepted during ${context}:`, error);
    let errorMessage = `Unknown error occurred during ${context}.`;
    
    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>; 
        errorMessage = `API Error during ${context}: ${axiosError.message}`; // Default if no response

        // Add try-catch around the entire response processing block
        try {
            if (axiosError.response) {
                const status = axiosError.response.status;
                const errorData = axiosError.response.data;
                const statusText = axiosError.response.statusText;
                console.error('[stderr] Response status:', status);
                try {
                    console.error('[stderr] Response data:', typeof errorData === 'string' ? errorData : JSON.stringify(errorData));
                } catch { 
                    console.error('[stderr] Response data: (Could not stringify raw data)'); 
                }

                let detail = '';
                // Inner try-catch for detail extraction is good
                try {
                     if (errorData && typeof errorData === 'object') {
                        const data = errorData as CriblErrorResponse;
                        detail = data.message || data.error || data.text || JSON.stringify(data); 
                     } else if (typeof errorData === 'string' && errorData.length > 0) {
                        detail = errorData;
                     } else if (statusText && statusText.length > 0) {
                        detail = statusText;
                     } else {
                        detail = `Status ${status} received with no useful error details in body.`;
                     }
                } catch (parseError) {
                     console.error(`[stderr] Error attempting to parse response body during ${context}:`, parseError);
                     let rawBody = '(Could not get raw body)';
                     try { rawBody = String(errorData); } catch {} 
                     detail = `Status ${status} received but response body parsing failed. Raw body snippet: ${rawBody.substring(0, 100)}`;
                }
                errorMessage = `API Error (${status}) during ${context}: ${detail}`;

            } else if (axiosError.request) {
                errorMessage = `API Error during ${context}: No response received from server.`;
                console.error('[stderr] Request data:', axiosError.request);
            } 
            // else: Use initial errorMessage based on axiosError.message
        } catch (responseProcessingError) {
            // Catch errors occurring *while trying to process* the response object itself
            console.error(`[stderr] CRITICAL: Error processing the Axios response object during ${context}:`, responseProcessingError);
            errorMessage = `API Error during ${context}: Failed to process the error response (${axiosError.message}).`;
        }
        
    } else if (error instanceof Error) {
        errorMessage = `Error during ${context}: ${error.message}`;
        console.error(`[stderr] Non-Axios error during ${context}:`, error);
    } else {
        errorMessage = `Unknown error type during ${context}: ${String(error)}`;
        console.error(`[stderr] Unknown error type during ${context}:`, error);
    }
    
    console.error(`[stderr] Final formatted error message for ${context}: ${errorMessage}`);
    return errorMessage;
}

// --- Token Acquisition Logic ---
async function acquireToken(): Promise<void> {
    console.error('[stderr] Acquiring/Refreshing Cribl API token...');
    try {
        if (config.cribl.auth.type === 'cloud') {
            const response = await authClient.post<CriblCloudTokenResponse>(
                `${config.cribl.auth.authUrl}/oauth/token`, // Use configured auth URL
                {
                    grant_type: 'client_credentials',
                    client_id: config.cribl.auth.clientId,
                    client_secret: config.cribl.auth.clientSecret,
                    audience: 'https://api.cribl.cloud', // Required audience for Cloud
                },
                { headers: { 'Content-Type': 'application/json' } }
            );
            accessToken = response.data.access_token;
            // Refresh token 60 seconds before actual expiry
            tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000;
            console.error(`[stderr] Cloud token acquired. Expires around: ${new Date(tokenExpiresAt).toISOString()}`);

        } else { // config.cribl.auth.type === 'local'
            const response = await authClient.post<CriblLocalTokenResponse>(
                `${config.cribl.baseUrl}/api/v1/auth/login`,
                {
                    username: config.cribl.auth.username,
                    password: config.cribl.auth.password,
                },
                { headers: { 'Content-Type': 'application/json' } }
            );
            // Local API includes "Bearer " prefix, store token without it
            accessToken = response.data.token.replace(/^Bearer\s+/, '');
            // Local tokens don't have expiry in response, refresh periodically (e.g., every hour)
            // Or rely on interceptor to refresh on 401
            tokenExpiresAt = Date.now() + (60 * 60 * 1000); // Refresh in 1 hour
            console.error(`[stderr] Local token acquired. Set to refresh around: ${new Date(tokenExpiresAt).toISOString()}`);
        }
    } catch (error) {
        accessToken = null;
        tokenExpiresAt = 0;
        const context = `acquireToken (Type: ${config.cribl.auth.type})`;
        const errorMessage = handleApiError(error, context);
        console.error(`[stderr] FATAL: Failed to acquire Cribl token: ${errorMessage}`);
        // Throw error to prevent subsequent API calls
        throw new Error(`Failed to acquire Cribl token: ${errorMessage}`);
    }
}

// --- Axios Request Interceptor ---
apiClient.interceptors.request.use(
    async (req: InternalAxiosRequestConfig) => {
        const now = Date.now();
        // Check if token is missing or expired (within buffer)
        if (!accessToken || now >= tokenExpiresAt) {
            // Prevent multiple concurrent refresh attempts
            if (!isRefreshingToken) {
                isRefreshingToken = true;
                // Start the refresh process, store the promise
                tokenRefreshPromise = acquireToken().finally(() => {
                    isRefreshingToken = false;
                    tokenRefreshPromise = null; // Clear promise once done
                });
            }
            // Wait for the ongoing refresh to complete
            if (tokenRefreshPromise) {
                try {
                    await tokenRefreshPromise;
                } catch (refreshError) {
                    // If refresh failed, propagate the error to stop the request
                    console.error('[stderr] Token refresh failed, cannot proceed with request.');
                    // Returning Promise.reject cancels the original request
                    return Promise.reject(refreshError);
                }
            }
        }

        // Set the Authorization header if token is available
        if (accessToken) {
            req.headers.Authorization = `Bearer ${accessToken}`;
        } else {
            // Should not happen if acquireToken throws, but good safety check
            console.error('[stderr] Interceptor: No access token available after check/refresh attempt.');
            return Promise.reject(new Error('No valid API token available.'));
        }

        return req;
    },
    (error) => {
        // Handle request configuration errors
        return Promise.reject(error);
    }
);

// --- API Client Functions (Using /api/v1/ prefix) ---

export async function listWorkerGroups(): Promise<ClientResult<CriblWorkerGroup[]>> {
    const context = 'listWorkerGroups';
    // Using /master/groups path as it reportedly worked previously
    const url = '/api/v1/master/groups'; 
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        // Assuming the response structure has an 'items' array
        const response = await apiClient.get<CriblApiResponse>(url); 
        return { success: true, data: response.data.items as CriblWorkerGroup[] };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        return { success: false, error: errorMessage };
    }
}

export async function getPipelines(groupName: string): Promise<ClientResult<CriblPipeline[]>> {
    const context = `getPipelines (Group: ${groupName})`;
    if (!groupName) {
        return { success: false, error: 'Group name is required for getPipelines.' };
    }
    // Use group-specific path
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

export async function getSources(groupName: string): Promise<ClientResult<CriblSource[]>> {
    const context = `getSources (Group: ${groupName})`;
    if (!groupName) {
        // This check might be redundant if called correctly, but good safety
        return { success: false, error: 'Group name is required for getSources.' };
    }
    // Use group-specific path
    const url = `/api/v1/m/${groupName}/system/inputs`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        // Assuming the response structure still has an 'items' array for inputs
        return { success: true, data: response.data.items as CriblSource[] };
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
        // Sending ONLY the config object as the payload
        console.error(`[stderr] Sending config payload:`, JSON.stringify(pipelineConfig)); 
        const response = await apiClient.patch<CriblPipeline>(url, pipelineConfig); 
        return { success: true, data: response.data };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        // Explicitly log the message being returned
        console.error(`[stderr] Returning error for ${context}: ${errorMessage}`); 
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
    // Use group-specific path
    const url = `/api/v1/m/${groupName}/pipelines/${pipelineId}`; 
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        // Assuming the response is the full pipeline object, including its config
        const response = await apiClient.get<CriblPipeline>(url);
        return { success: true, data: response.data };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        return { success: false, error: errorMessage };
    }
}

// Reintegrating restartWorkerGroup
export async function restartWorkerGroup(): Promise<ClientResult<{ message: string }>> { // Removed groupName parameter
    const context = `restartWorkerGroup`;
    // Using documented PATCH /master/workers/restart endpoint (No group scope)
    const url = `/api/v1/master/workers/restart`; 
    console.error(`[stderr] Attempting API call: PATCH ${url} - WARNING: This likely restarts ALL workers managed by the Leader.`);
    
    try {
        const response = await apiClient.patch(url); // Use PATCH, no body usually needed for restart action
        return { success: true, data: { message: `Successfully initiated worker restart. Response status: ${response.status}` } };
    } catch (error) {
        const errorMessage = handleApiError(error, context);
        return { success: false, error: errorMessage };
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

    // Prepare query parameters
    const queryParams: Record<string, any> = {};
    if (params?.filterExpr != null) queryParams.filterExpr = params.filterExpr;
    if (params?.metricNameFilter != null) queryParams.metricNameFilter = params.metricNameFilter;
    if (params?.earliest != null) queryParams.earliest = params.earliest;
    if (params?.latest != null) queryParams.latest = params.latest;
    if (params?.wp != null) queryParams.wp = params.wp;

    // Default to 1 bucket if no parameters are provided to limit response size
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
                ...apiClient.defaults.headers.common,
                'Accept': 'text/plain' // Keep requesting plain text for now
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

// Detects if version control is enabled on the Cribl instance, and whether a remote repo is set up.
export async function versionControl(): Promise<ClientResult<VersionControlItem>> {
    const context = 'versionControl';
    const url = '/api/v1/version/info';
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        // API returns items array with version control status details
        const response = await apiClient.get<{ items: VersionControlItem[], count: number }>(url);
        
        if (response.data?.items && Array.isArray(response.data.items) && response.data.items.length > 0) {
            // Return complete information from the first item
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
    message: string // Required commit message
): Promise<ClientResult<CommitResult | null>> {
    const context = `commitPipeline`;
    if (!message || message.trim().length === 0) {
        return { success: false, error: 'Commit message is required for commitPipeline.' };
    }
    const url = `/api/v1/version/commit`;
    console.error(`[stderr] Attempting API call: POST ${url} with message: "${message}"`);
    try {
        const payload = { message: message };
        // API returns items array with commit details
        const response = await apiClient.post<{ items: CommitResult[], count: number }>(url, payload);
        
        if (response.data?.items && 
            Array.isArray(response.data.items) && 
            response.data.items.length > 0) {
            
            // Get full commit details from the first item
            const commitResult = response.data.items[0];
            
            // Verify we have at least the commit ID
            if (commitResult.commit) {
                // Log comprehensive commit information
                console.error(`[stderr] ${context}: Commit successful - ID: ${commitResult.commit}, Branch: ${commitResult.branch}`);
                if (commitResult.summary) {
                    console.error(`[stderr] ${context}: Files changed - Added: ${commitResult.summary.added || 0}, Modified: ${commitResult.summary.modified || 0}, Deleted: ${commitResult.summary.deleted || 0}`);
                }
                
                // Return full commit details
                return { success: true, data: commitResult };
            }
        }
        
        // If we get here, we couldn't find valid commit info in the response
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

export async function deployPipeline(
    groupName: string,
    version: string // Commit ID to deploy
): Promise<ClientResult<DeployResponse>> {
    const context = `deployPipeline (Group: ${groupName}, Version: ${version})`;
    if (!groupName) return { success: false, error: 'Group name is required for deployPipeline.' };
    if (!version) return { success: false, error: 'Version (commit ID) is required for deployPipeline.' };

    const url = `/api/v1/master/groups/${groupName}/deploy`;
    console.error(`[stderr] Attempting API call: PATCH ${url} with version: "${version}"`);
    try {
        const payload = { version };
        // Use PATCH per API docs and expect DeployResponse
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

// --- Batch 1: Read-Only Group-Scoped ---

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

// --- Batch 2: Global Read-Only ---

export async function getSystemInfo(): Promise<ClientResult<CriblSystemInfo>> {
    const context = 'getSystemInfo';
    const url = '/api/v1/system/info';
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<any>(url);
        const data = response.data;
        // Handle both items[0] and direct-object response shapes
        if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
            return { success: true, data: data.items[0] as CriblSystemInfo };
        }
        // Direct object response (no items wrapper)
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            return { success: true, data: data as CriblSystemInfo };
        }
        return { success: false, error: 'Unexpected response structure from system/info endpoint.' };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
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

// --- Batch 3: Search ---

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
        // Handle items array or direct object
        const job = data?.items?.[0] || data;
        return { success: true, data: job as CriblSearchJob };
    } catch (error) {
        const errMsg = handleApiError(error, context);
        // Gracefully handle 404 (search may be Cloud-only)
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

// --- Batch 4: Write/Action Tools ---

export async function createRoute(
    groupName: string,
    route: { id: string; output: string; name?: string; filter?: string; pipeline?: string; enabled?: boolean; description?: string }
): Promise<ClientResult<CriblRoute>> {
    const context = `createRoute (Group: ${groupName}, ID: ${route.id})`;
    if (!groupName) return { success: false, error: 'Group name is required for createRoute.' };
    const url = `/api/v1/m/${groupName}/routes`;
    console.error(`[stderr] Attempting read-modify-write on: ${url}`);
    try {
        // GET current routes wrapper
        const getResponse = await apiClient.get<CriblApiResponse>(url);
        const wrapper = getResponse.data.items?.[0];
        if (!wrapper || !Array.isArray(wrapper.routes)) {
            return { success: false, error: 'Unexpected routes response structure: missing items[0].routes array.' };
        }
        // Build new route entry
        const newRoute: CriblRoute = {
            id: route.id,
            output: route.output,
            name: route.name,
            filter: route.filter ?? 'true',
            pipeline: route.pipeline,
            enabled: route.enabled ?? true,
            description: route.description,
        };
        // Append to existing routes
        wrapper.routes.push(newRoute);
        // PATCH back the wrapper
        const patchResponse = await apiClient.patch<any>(url, wrapper);
        return { success: true, data: newRoute };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
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
        // GET current routes wrapper
        const getResponse = await apiClient.get<CriblApiResponse>(url);
        const wrapper = getResponse.data.items?.[0];
        if (!wrapper || !Array.isArray(wrapper.routes)) {
            return { success: false, error: 'Unexpected routes response structure: missing items[0].routes array.' };
        }
        // Find the target route
        const targetRoute = wrapper.routes.find((r: any) => r.id === routeId);
        if (!targetRoute) {
            const availableIds = wrapper.routes.map((r: any) => r.id);
            return { success: false, error: `Route '${routeId}' not found. Available routes: [${availableIds.join(', ')}]` };
        }
        // Toggle enabled
        targetRoute.enabled = enabled;
        // PATCH back
        await apiClient.patch<any>(url, wrapper);
        return { success: true, data: targetRoute as CriblRoute };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
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

// --- Round 3: Additional Tools ---

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
        queryParams.offset = 0; // offset is required when limit is provided
    }
    if (params?.filter != null) queryParams.filter = params.filter;
    try {
        const response = await apiClient.get<CriblApiResponse>(url, { params: queryParams });
        return { success: true, data: response.data.items };
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

// --- Round 4: CRUD Completion + Sample/Lookup Content ---

export async function getSampleData(groupName: string, sampleId: string): Promise<ClientResult<any[]>> {
    const context = `getSampleData (Group: ${groupName}, Sample: ${sampleId})`;
    if (!groupName) return { success: false, error: 'Group name is required for getSampleData.' };
    if (!sampleId) return { success: false, error: 'Sample ID is required for getSampleData.' };
    const url = `/api/v1/m/${groupName}/system/samples/${encodeURIComponent(sampleId)}/content`;
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<any>(url);
        // Response is a JSON array of event objects
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

export async function deleteRoute(groupName: string, routeId: string): Promise<ClientResult<any>> {
    const context = `deleteRoute (Group: ${groupName}, Route: ${routeId})`;
    if (!groupName) return { success: false, error: 'Group name is required for deleteRoute.' };
    if (!routeId) return { success: false, error: 'Route ID is required for deleteRoute.' };
    const url = `/api/v1/m/${groupName}/routes`;
    console.error(`[stderr] Attempting read-modify-write on: ${url} to remove route ${routeId}`);
    try {
        // GET current routes wrapper
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
        // PATCH back without the removed route
        await apiClient.patch<any>(url, wrapper);
        return { success: true, data: { message: `Route '${routeId}' deleted successfully.` } };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
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

export async function runCollectorJob(
    groupName: string,
    collectorId: string,
    configOverrides?: Record<string, any>
): Promise<ClientResult<any>> {
    const context = `runCollectorJob (Group: ${groupName}, Collector: ${collectorId})`;
    if (!groupName) return { success: false, error: 'Group name is required for runCollectorJob.' };
    if (!collectorId) return { success: false, error: 'Collector ID is required for runCollectorJob.' };
    // Dispatch a job for this collector via the jobs endpoint
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

// --- Round 5: Final Tools ---

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

export async function getGitDiff(): Promise<ClientResult<any>> {
    const context = 'getGitDiff';
    const url = '/api/v1/version/diff';
    console.error(`[stderr] Attempting API call: GET ${url}`);
    try {
        const response = await apiClient.get<CriblApiResponse>(url);
        const data = response.data?.items?.[0] || response.data;
        return { success: true, data };
    } catch (error) {
        return { success: false, error: handleApiError(error, context) };
    }
} 