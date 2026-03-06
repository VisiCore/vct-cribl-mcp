import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ClientResult } from '../../src/types/api';
import type { CriblWorkerGroup } from '../../src/types/domain';

// Mock the workers API module before importing the module under test
vi.mock('../../src/api/workers.js', () => ({
    listWorkerGroups: vi.fn(),
}));

import { resolveGroupName } from '../../src/tools/shared';
import { listWorkerGroups } from '../../src/api/workers';

const mockedListWorkerGroups = vi.mocked(listWorkerGroups);

// Helper to build a CriblWorkerGroup object
function makeGroup(id: string, opts?: { isFleet?: boolean; isSearch?: boolean }): CriblWorkerGroup {
    return { id, isFleet: opts?.isFleet, isSearch: opts?.isSearch };
}

describe('resolveGroupName', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------
    // 1. listWorkerGroups failure
    // -------------------------------------------------------
    it('should return an error when listWorkerGroups fails', async () => {
        mockedListWorkerGroups.mockResolvedValue({
            success: false,
            error: 'Network timeout',
        } as ClientResult<CriblWorkerGroup[]>);

        const result = await resolveGroupName('mygroup');

        expect(result.error).toBeDefined();
        expect(result.error).toContain('Failed to list worker groups');
        expect(result.error).toContain('Network timeout');
        expect(result.groupName).toBeUndefined();
    });

    // -------------------------------------------------------
    // 2. listWorkerGroups succeeds but data is undefined
    // -------------------------------------------------------
    it('should return an error when listWorkerGroups returns success but no data', async () => {
        mockedListWorkerGroups.mockResolvedValue({
            success: true,
            data: undefined,
        } as ClientResult<CriblWorkerGroup[]>);

        const result = await resolveGroupName();

        expect(result.error).toBeDefined();
        expect(result.error).toContain('Failed to list worker groups');
        expect(result.groupName).toBeUndefined();
    });

    // -------------------------------------------------------
    // 3. Provided group name found in list
    // -------------------------------------------------------
    it('should return the provided group name when it exists in the list', async () => {
        mockedListWorkerGroups.mockResolvedValue({
            success: true,
            data: [makeGroup('default'), makeGroup('production'), makeGroup('staging')],
        });

        const result = await resolveGroupName('production');

        expect(result.groupName).toBe('production');
        expect(result.error).toBeUndefined();
    });

    // -------------------------------------------------------
    // 4. Provided group name NOT found in list
    // -------------------------------------------------------
    it('should return an error with available groups when provided group name is not found', async () => {
        mockedListWorkerGroups.mockResolvedValue({
            success: true,
            data: [makeGroup('default'), makeGroup('production')],
        });

        const result = await resolveGroupName('nonexistent');

        expect(result.error).toBeDefined();
        expect(result.error).toContain("Worker group 'nonexistent' not found");
        expect(result.error).toContain('default');
        expect(result.error).toContain('production');
        expect(result.groupName).toBeUndefined();
    });

    // -------------------------------------------------------
    // 5. No group name provided, single stream group auto-resolved
    // -------------------------------------------------------
    it('should auto-resolve when exactly one stream group exists and no group name is provided', async () => {
        mockedListWorkerGroups.mockResolvedValue({
            success: true,
            data: [
                makeGroup('default_stream'),                         // stream (no isFleet, no isSearch)
                makeGroup('edge_fleet', { isFleet: true }),          // edge
                makeGroup('search_group', { isSearch: true }),       // search
            ],
        });

        const result = await resolveGroupName();

        expect(result.groupName).toBe('default_stream');
        expect(result.error).toBeUndefined();
    });

    // -------------------------------------------------------
    // 6. No group name provided, zero stream groups
    // -------------------------------------------------------
    it('should return an error when no stream groups exist and no group name is provided', async () => {
        mockedListWorkerGroups.mockResolvedValue({
            success: true,
            data: [
                makeGroup('edge_fleet', { isFleet: true }),
                makeGroup('search_group', { isSearch: true }),
            ],
        });

        const result = await resolveGroupName();

        expect(result.error).toBeDefined();
        expect(result.error).toContain("No worker groups found for default product type 'stream'");
        expect(result.error).toContain('Please specify a groupName');
        expect(result.groupName).toBeUndefined();
    });

    // -------------------------------------------------------
    // 7. No group name provided, multiple stream groups
    // -------------------------------------------------------
    it('should return an error when multiple stream groups exist and no group name is provided', async () => {
        mockedListWorkerGroups.mockResolvedValue({
            success: true,
            data: [
                makeGroup('stream_a'),
                makeGroup('stream_b'),
                makeGroup('edge_fleet', { isFleet: true }),
            ],
        });

        const result = await resolveGroupName();

        expect(result.error).toBeDefined();
        expect(result.error).toContain("Multiple worker groups found for default product type 'stream'");
        expect(result.error).toContain('stream_a');
        expect(result.error).toContain('stream_b');
        expect(result.error).toContain("Please specify the 'groupName' argument");
        expect(result.groupName).toBeUndefined();
    });

    // -------------------------------------------------------
    // 8. defaultProductType = 'edge', single fleet group
    // -------------------------------------------------------
    it('should auto-resolve when exactly one edge group exists with defaultProductType edge', async () => {
        mockedListWorkerGroups.mockResolvedValue({
            success: true,
            data: [
                makeGroup('stream_default'),
                makeGroup('my_edge_fleet', { isFleet: true }),
                makeGroup('search_group', { isSearch: true }),
            ],
        });

        const result = await resolveGroupName(undefined, 'edge');

        expect(result.groupName).toBe('my_edge_fleet');
        expect(result.error).toBeUndefined();
    });

    // -------------------------------------------------------
    // 9. defaultProductType = 'search', single search group
    // -------------------------------------------------------
    it('should auto-resolve when exactly one search group exists with defaultProductType search', async () => {
        mockedListWorkerGroups.mockResolvedValue({
            success: true,
            data: [
                makeGroup('stream_default'),
                makeGroup('edge_fleet', { isFleet: true }),
                makeGroup('my_search', { isSearch: true }),
            ],
        });

        const result = await resolveGroupName(undefined, 'search');

        expect(result.groupName).toBe('my_search');
        expect(result.error).toBeUndefined();
    });

    // -------------------------------------------------------
    // 10. Provided group name takes precedence over defaultProductType
    // -------------------------------------------------------
    it('should use the provided group name even when defaultProductType is specified', async () => {
        mockedListWorkerGroups.mockResolvedValue({
            success: true,
            data: [
                makeGroup('stream_one'),
                makeGroup('edge_fleet', { isFleet: true }),
            ],
        });

        // Provide a valid group name along with a different defaultProductType
        const result = await resolveGroupName('edge_fleet', 'stream');

        expect(result.groupName).toBe('edge_fleet');
        expect(result.error).toBeUndefined();
    });
});
