import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getJobs, getCollectors, runCollectorJob } from '../api/jobs.js';
import { ValidatedArgs, GroupNameArgSchema, resolveGroupName } from './shared.js';

export function registerJobTools(server: McpServer) {
    server.tool(
        'cribl_getJobs',
        'Fetches jobs in a specified worker group.',
        { groupName: GroupNameArgSchema },
        async (args: ValidatedArgs<{ groupName: typeof GroupNameArgSchema }>) => {
            console.error(`[Tool Call] cribl_getJobs with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await getJobs(groupResolution.groupName);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error fetching jobs for group ${groupResolution.groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getJobs (Group: ${groupResolution.groupName}): Found ${result.data?.length || 0} jobs.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );

    const RunCollectorJobArgsShape = {
        groupName: GroupNameArgSchema,
        collectorId: z.string().min(1).describe('The ID of the collector to run. Use cribl_getJobs or check configured collectors.'),
        configOverrides: z.object({}).passthrough().optional().describe('Optional: Configuration overrides for this job run.'),
    };

    server.tool(
        'cribl_runCollectorJob',
        'Triggers an on-demand run of a collector job in a worker group. Returns the job object with status.',
        RunCollectorJobArgsShape,
        async (args: ValidatedArgs<typeof RunCollectorJobArgsShape>) => {
            console.error(`[Tool Call] cribl_runCollectorJob with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await runCollectorJob(groupResolution.groupName, args.collectorId, args.configOverrides);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error running collector job '${args.collectorId}': ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_runCollectorJob: Triggered '${args.collectorId}'`);
            return { content: [{ type: 'text', text: `Collector job '${args.collectorId}' triggered. ${JSON.stringify(result.data, null, 2)}` }] };
        }
    );

    server.tool(
        'cribl_getCollectors',
        'Fetches collector configurations in a worker group. Collectors define how data is collected from external sources on a schedule.',
        { groupName: GroupNameArgSchema },
        async (args: ValidatedArgs<{ groupName: typeof GroupNameArgSchema }>) => {
            console.error(`[Tool Call] cribl_getCollectors with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await getCollectors(groupResolution.groupName);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error fetching collectors for group ${groupResolution.groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getCollectors (Group: ${groupResolution.groupName}): Found ${result.data?.length || 0} collectors.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );
}
