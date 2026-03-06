import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { config } from '../config.js';
import type { CriblErrorResponse, CriblCloudTokenResponse, CriblLocalTokenResponse } from '../types/index.js';

// --- Token Management State ---
let accessToken: string | null = null;
let tokenExpiresAt: number = 0;
let isRefreshingToken: boolean = false;
let tokenRefreshPromise: Promise<void> | null = null;

// --- Axios Instances ---
const authClient: AxiosInstance = axios.create();

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
export function handleApiError(error: unknown, context: string): string {
    console.error(`[stderr] Raw error intercepted during ${context}:`, error);
    let errorMessage = `Unknown error occurred during ${context}.`;

    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        errorMessage = `API Error during ${context}: ${axiosError.message}`;

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
        } catch (responseProcessingError) {
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
export async function acquireToken(): Promise<void> {
    console.error('[stderr] Acquiring/Refreshing Cribl API token...');
    try {
        if (config.cribl.auth.type === 'cloud') {
            const response = await authClient.post<CriblCloudTokenResponse>(
                `${config.cribl.auth.authUrl}/oauth/token`,
                {
                    grant_type: 'client_credentials',
                    client_id: config.cribl.auth.clientId,
                    client_secret: config.cribl.auth.clientSecret,
                    audience: 'https://api.cribl.cloud',
                },
                { headers: { 'Content-Type': 'application/json' } }
            );
            accessToken = response.data.access_token;
            tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000;
            console.error(`[stderr] Cloud token acquired. Expires around: ${new Date(tokenExpiresAt).toISOString()}`);

        } else {
            const response = await authClient.post<CriblLocalTokenResponse>(
                `${config.cribl.baseUrl}/api/v1/auth/login`,
                {
                    username: config.cribl.auth.username,
                    password: config.cribl.auth.password,
                },
                { headers: { 'Content-Type': 'application/json' } }
            );
            accessToken = response.data.token.replace(/^Bearer\s+/, '');
            tokenExpiresAt = Date.now() + (60 * 60 * 1000);
            console.error(`[stderr] Local token acquired. Set to refresh around: ${new Date(tokenExpiresAt).toISOString()}`);
        }
    } catch (error) {
        accessToken = null;
        tokenExpiresAt = 0;
        const context = `acquireToken (Type: ${config.cribl.auth.type})`;
        const errorMessage = handleApiError(error, context);
        console.error(`[stderr] FATAL: Failed to acquire Cribl token: ${errorMessage}`);
        throw new Error(`Failed to acquire Cribl token: ${errorMessage}`);
    }
}

// --- Axios Request Interceptor ---
apiClient.interceptors.request.use(
    async (req: InternalAxiosRequestConfig) => {
        const now = Date.now();
        if (!accessToken || now >= tokenExpiresAt) {
            if (!isRefreshingToken) {
                isRefreshingToken = true;
                tokenRefreshPromise = acquireToken().finally(() => {
                    isRefreshingToken = false;
                    tokenRefreshPromise = null;
                });
            }
            if (tokenRefreshPromise) {
                try {
                    await tokenRefreshPromise;
                } catch (refreshError) {
                    console.error('[stderr] Token refresh failed, cannot proceed with request.');
                    return Promise.reject(refreshError);
                }
            }
        }

        if (accessToken) {
            req.headers.Authorization = `Bearer ${accessToken}`;
        } else {
            console.error('[stderr] Interceptor: No access token available after check/refresh attempt.');
            return Promise.reject(new Error('No valid API token available.'));
        }

        return req;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export { apiClient };
