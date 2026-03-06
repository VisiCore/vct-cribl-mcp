export interface CriblApiResponse {
    items: any[];
    count?: number;
}

export interface CriblErrorResponse {
    error?: string;
    message?: string;
    status?: string | number;
    text?: string;
}

export interface CriblCloudTokenResponse {
    access_token: string;
    scope: string;
    expires_in: number;
    token_type: 'Bearer';
}

export interface CriblLocalTokenResponse {
    token: string;
}

export interface ClientResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}
