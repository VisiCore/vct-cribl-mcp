import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listWorkerGroups, getWorkers, restartWorkerGroup } from '../api/workers.js';
import { ValidatedArgs, filterGroupsByProductType } from './shared.js';

export function registerWorkerTools(server: McpServer) {
    const ListWorkerGroupsArgsShape = {
        productType: z.preprocess(
            (val) => (val === null || val === undefined || val === '' ? 'stream' : val),
            z.enum(['stream', 'edge', 'search', 'all'])
        ).describe('Filter groups by product type (stream, edge, search, all). Defaults to stream.'),
    };

    server.tool(
        'cribl_listWorkerGroups',
        'Lists available worker groups in the Cribl deployment, optionally filtered by product type (stream, edge, search, or all).',
        ListWorkerGroupsArgsShape,
        async (args: ValidatedArgs<typeof ListWorkerGroupsArgsShape>) => {
            const { productType } = args;
            console.error(`[Tool Call] cribl_listWorkerGroups (Filtering for: ${productType})`);
            const result = await listWorkerGroups();

            if (!result.success || !result.data) {
                console.error('[Tool Error] cribl_listWorkerGroups:', result.error);
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Error listing worker groups: ${result.error || 'Unknown error'}` }],
                };
            }

            const groupsToReturn = productType === 'all'
                ? result.data
                : filterGroupsByProductType(result.data, productType as 'stream' | 'edge' | 'search');

            console.error(`[Tool Success] cribl_listWorkerGroups: Found ${groupsToReturn.length} groups matching filter '${productType}'.`);
            return {
                content: [{ type: 'text', text: JSON.stringify(groupsToReturn, null, 2) }],
            };
        }
    );

    const GetWorkerGroupStatusArgsShape = {
        groupName: z.string().optional().describe('Optional: Return status for only this specific worker group. If omitted, returns status for all groups.'),
    };

    server.tool(
        'cribl_getWorkerGroupStatus',
        'Returns operational status for worker groups including workerCount, deployingWorkerCount, incompatibleWorkerCount, and configVersion.',
        GetWorkerGroupStatusArgsShape,
        async (args: ValidatedArgs<typeof GetWorkerGroupStatusArgsShape>) => {
            console.error(`[Tool Call] cribl_getWorkerGroupStatus with args:`, args);
            const result = await listWorkerGroups();
            if (!result.success || !result.data) {
                console.error(`[Tool Error] cribl_getWorkerGroupStatus:`, result.error);
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Error fetching worker group status: ${result.error || 'Unknown error'}` }],
                };
            }

            let groups = result.data;
            if (args.groupName) {
                groups = groups.filter(g => g.id === args.groupName);
                if (groups.length === 0) {
                    const allIds = result.data.map(g => g.id);
                    return {
                        isError: true,
                        content: [{ type: 'text', text: `Worker group '${args.groupName}' not found. Available groups: [${allIds.join(', ')}]` }],
                    };
                }
            }

            console.error(`[Tool Success] cribl_getWorkerGroupStatus: Returning status for ${groups.length} group(s).`);
            return {
                content: [{ type: 'text', text: JSON.stringify(groups, null, 2) }],
            };
        }
    );

    server.tool(
        'cribl_getWorkers',
        'Lists individual worker nodes managed by the leader, including hostname, status, version, CPU, and memory usage.',
        {},
        async () => {
            console.error(`[Tool Call] cribl_getWorkers`);
            const result = await getWorkers();
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error fetching workers: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getWorkers: Found ${result.data?.length || 0} workers.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );

    server.tool(
        'cribl_restartWorkerGroup',
        'Restarts all workers within the default or specified worker group.',
        {},
        async () => {
            console.error(`[Tool Call] cribl_restartWorkerGroup`);
            const result = await restartWorkerGroup();
            if (!result.success) {
                console.error(`[Tool Error] cribl_restartWorkerGroup:`, result.error);
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Error restarting workers: ${result.error}` }],
                };
            }
            console.error(`[Tool Success] cribl_restartWorkerGroup`);
            return {
                content: [{ type: 'text', text: result.data?.message || `Successfully initiated worker restart.` }],
            };
        }
    );
}
