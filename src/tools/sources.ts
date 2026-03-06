import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSources, createSource, updateSource, deleteSource } from '../api/sources.js';
import { ValidatedArgs, GroupNameArgSchema, resolveGroupName } from './shared.js';

export function registerSourceTools(server: McpServer) {
    server.tool(
        'cribl_getSources',
        'Fetches source configurations in a specified worker group.',
        { groupName: GroupNameArgSchema },
        async (args: ValidatedArgs<{ groupName: typeof GroupNameArgSchema }>) => {
            console.error(`[Tool Call] cribl_getSources with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const groupName = groupResolution.groupName;
            const result = await getSources(groupName);
            if (!result.success) {
                console.error(`[Tool Error] cribl_getSources (Group: ${groupName}):`, result.error);
                return { isError: true, content: [{ type: 'text', text: `Error fetching sources for group ${groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getSources (Group: ${groupName}): Found ${result.data?.length || 0} sources.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );

    const CreateSourceArgsShape = {
        groupName: GroupNameArgSchema,
        id: z.string().min(1).describe('Unique ID for the new source.'),
        type: z.string().min(1).describe('Source type (e.g., "syslog", "http", "splunk_tcp", "kafka").'),
        config: z.object({}).passthrough().optional().describe('Optional: Additional configuration properties for the source, passed through to the API.'),
    };

    server.tool(
        'cribl_createSource',
        'Creates a new source (input) in a worker group.',
        CreateSourceArgsShape,
        async (args: ValidatedArgs<typeof CreateSourceArgsShape>) => {
            console.error(`[Tool Call] cribl_createSource with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const payload: Record<string, any> = { id: args.id, type: args.type, ...(args.config || {}) };
            const result = await createSource(groupResolution.groupName, payload as any);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error creating source '${args.id}' in group ${groupResolution.groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_createSource: Created source '${args.id}' in group ${groupResolution.groupName}`);
            return { content: [{ type: 'text', text: `Successfully created source '${args.id}'. ${JSON.stringify(result.data, null, 2)}` }] };
        }
    );

    const UpdateSourceArgsShape = {
        groupName: GroupNameArgSchema,
        sourceId: z.string().min(1).describe('The ID of the source to update.'),
        updates: z.object({}).passthrough().describe('Object with the fields to update on the source. Only include fields you want to change.'),
    };

    server.tool(
        'cribl_updateSource',
        'Updates an existing source (input) configuration in a worker group. Only the provided fields are changed; other fields remain unchanged.',
        UpdateSourceArgsShape,
        async (args: ValidatedArgs<typeof UpdateSourceArgsShape>) => {
            console.error(`[Tool Call] cribl_updateSource with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await updateSource(groupResolution.groupName, args.sourceId, args.updates);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error updating source '${args.sourceId}': ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_updateSource: Updated '${args.sourceId}'`);
            return { content: [{ type: 'text', text: `Successfully updated source '${args.sourceId}'. ${JSON.stringify(result.data, null, 2)}` }] };
        }
    );

    const DeleteSourceArgsShape = {
        groupName: GroupNameArgSchema,
        sourceId: z.string().min(1).describe('The ID of the source to delete.'),
    };

    server.tool(
        'cribl_deleteSource',
        'Deletes a source (input) from a worker group. WARNING: This is irreversible. Ensure no routes reference this source before deleting.',
        DeleteSourceArgsShape,
        async (args: ValidatedArgs<typeof DeleteSourceArgsShape>) => {
            console.error(`[Tool Call] cribl_deleteSource with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await deleteSource(groupResolution.groupName, args.sourceId);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error deleting source '${args.sourceId}': ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_deleteSource: Deleted '${args.sourceId}'`);
            return { content: [{ type: 'text', text: `Successfully deleted source '${args.sourceId}'. ${JSON.stringify(result.data, null, 2)}` }] };
        }
    );
}
