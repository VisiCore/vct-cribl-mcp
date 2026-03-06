import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dotenv so it does not actually read .env files during tests
vi.mock('dotenv', () => ({
    default: { config: vi.fn() },
}));

describe('config – loadConfig()', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset module registry so each test re-executes loadConfig()
        vi.resetModules();
        // Create a clean copy of env vars to avoid cross-test pollution
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    // Helper that sets env vars then dynamically imports config
    async function loadConfigWith(env: Record<string, string>) {
        Object.assign(process.env, env);
        const mod = await import('../src/config');
        return mod.config;
    }

    // -------------------------------------------------------
    // 1. Cloud auth – successful load
    // -------------------------------------------------------
    it('should load cloud auth config when CRIBL_AUTH_TYPE is cloud', async () => {
        const cfg = await loadConfigWith({
            CRIBL_AUTH_TYPE: 'cloud',
            CRIBL_BASE_URL: 'https://my-cribl.cloud',
            CRIBL_CLIENT_ID: 'client-123',
            CRIBL_CLIENT_SECRET: 'secret-456',
        });

        expect(cfg.cribl.baseUrl).toBe('https://my-cribl.cloud');
        expect(cfg.cribl.auth.type).toBe('cloud');
        if (cfg.cribl.auth.type === 'cloud') {
            expect(cfg.cribl.auth.clientId).toBe('client-123');
            expect(cfg.cribl.auth.clientSecret).toBe('secret-456');
            // Default auth URL when none is provided
            expect(cfg.cribl.auth.authUrl).toBe('https://login.cribl.cloud');
        }
    });

    // -------------------------------------------------------
    // 2. Cloud auth – custom auth URL
    // -------------------------------------------------------
    it('should use a custom CRIBL_CLOUD_AUTH_URL when provided', async () => {
        const cfg = await loadConfigWith({
            CRIBL_AUTH_TYPE: 'cloud',
            CRIBL_BASE_URL: 'https://my-cribl.cloud',
            CRIBL_CLIENT_ID: 'client-123',
            CRIBL_CLIENT_SECRET: 'secret-456',
            CRIBL_CLOUD_AUTH_URL: 'https://custom-auth.example.com',
        });

        expect(cfg.cribl.auth.type).toBe('cloud');
        if (cfg.cribl.auth.type === 'cloud') {
            expect(cfg.cribl.auth.authUrl).toBe('https://custom-auth.example.com');
        }
    });

    // -------------------------------------------------------
    // 3. Local auth – successful load
    // -------------------------------------------------------
    it('should load local auth config when CRIBL_AUTH_TYPE is local', async () => {
        const cfg = await loadConfigWith({
            CRIBL_AUTH_TYPE: 'local',
            CRIBL_BASE_URL: 'http://localhost:9000',
            CRIBL_USERNAME: 'admin',
            CRIBL_PASSWORD: 's3cret',
        });

        expect(cfg.cribl.baseUrl).toBe('http://localhost:9000');
        expect(cfg.cribl.auth.type).toBe('local');
        if (cfg.cribl.auth.type === 'local') {
            expect(cfg.cribl.auth.username).toBe('admin');
            expect(cfg.cribl.auth.password).toBe('s3cret');
        }
    });

    // -------------------------------------------------------
    // 4. Missing CRIBL_AUTH_TYPE throws
    // -------------------------------------------------------
    it('should throw when CRIBL_AUTH_TYPE is missing', async () => {
        process.env = { ...originalEnv };
        // Remove any existing auth type
        delete process.env.CRIBL_AUTH_TYPE;
        process.env.CRIBL_BASE_URL = 'https://example.com';

        vi.resetModules();
        await expect(import('../src/config')).rejects.toThrow();
    });

    // -------------------------------------------------------
    // 5. Invalid CRIBL_AUTH_TYPE throws
    // -------------------------------------------------------
    it('should throw when CRIBL_AUTH_TYPE is invalid', async () => {
        process.env = { ...originalEnv };
        process.env.CRIBL_AUTH_TYPE = 'oauth2';
        process.env.CRIBL_BASE_URL = 'https://example.com';

        vi.resetModules();
        await expect(import('../src/config')).rejects.toThrow(/Invalid CRIBL_AUTH_TYPE/);
    });

    // -------------------------------------------------------
    // 6. Missing CRIBL_BASE_URL throws
    // -------------------------------------------------------
    it('should throw when CRIBL_BASE_URL is missing', async () => {
        process.env = { ...originalEnv };
        process.env.CRIBL_AUTH_TYPE = 'cloud';
        process.env.CRIBL_CLIENT_ID = 'id';
        process.env.CRIBL_CLIENT_SECRET = 'secret';
        delete process.env.CRIBL_BASE_URL;

        vi.resetModules();
        await expect(import('../src/config')).rejects.toThrow(/CRIBL_BASE_URL/);
    });
});
