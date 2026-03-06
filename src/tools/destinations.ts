import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDestinations, createDestination, updateDestination, deleteDestination } from '../api/destinations.js';
import { ValidatedArgs, GroupNameArgSchema, resolveGroupName } from './shared.js';

export function registerDestinationTools(server: McpServer) {
    server.tool(
        'cribl_getDestinations',
        'Fetches destination (output) configurations in a specified worker group.',
        { groupName: GroupNameArgSchema },
        async (args: ValidatedArgs<{ groupName: typeof GroupNameArgSchema }>) => {
            console.error(`[Tool Call] cribl_getDestinations with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const groupName = groupResolution.groupName;
            const result = await getDestinations(groupName);
            if (!result.success) {
                console.error(`[Tool Error] cribl_getDestinations (Group: ${groupName}):`, result.error);
                return { isError: true, content: [{ type: 'text', text: `Error fetching destinations for group ${groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getDestinations (Group: ${groupName}): Found ${result.data?.length || 0} destinations.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );

    const CreateDestinationArgsShape = {
        groupName: GroupNameArgSchema,
        id: z.string().min(1).describe('Unique ID for the new destination.'),
        type: z.string().min(1).describe('Destination type (e.g., "s3", "splunk", "syslog", "kafka").'),
        config: z.object({}).passthrough().optional().describe('Optional: Additional configuration properties for the destination, passed through to the API.'),
    };

    server.tool(
        'cribl_createDestination',
        'Creates a new destination (output) in a worker group.',
        CreateDestinationArgsShape,
        async (args: ValidatedArgs<typeof CreateDestinationArgsShape>) => {
            console.error(`[Tool Call] cribl_createDestination with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const payload: Record<string, any> = { id: args.id, type: args.type, ...(args.config || {}) };
            const result = await createDestination(groupResolution.groupName, payload as any);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error creating destination '${args.id}' in group ${groupResolution.groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_createDestination: Created destination '${args.id}' in group ${groupResolution.groupName}`);
            return { content: [{ type: 'text', text: `Successfully created destination '${args.id}'. ${JSON.stringify(result.data, null, 2)}` }] };
        }
    );

    const UpdateDestinationArgsShape = {
        groupName: GroupNameArgSchema,
        destinationId: z.string().min(1).describe('The ID of the destination to update.'),
        updates: z.object({}).passthrough().describe('Object with the fields to update on the destination. Only include fields you want to change.'),
    };

    server.tool(
        'cribl_updateDestination',
        'Updates an existing destination (output) configuration in a worker group. Only the provided fields are changed; other fields remain unchanged.',
        UpdateDestinationArgsShape,
        async (args: ValidatedArgs<typeof UpdateDestinationArgsShape>) => {
            console.error(`[Tool Call] cribl_updateDestination with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await updateDestination(groupResolution.groupName, args.destinationId, args.updates);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error updating destination '${args.destinationId}': ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_updateDestination: Updated '${args.destinationId}'`);
            return { content: [{ type: 'text', text: `Successfully updated destination '${args.destinationId}'. ${JSON.stringify(result.data, null, 2)}` }] };
        }
    );

    const DeleteDestinationArgsShape = {
        groupName: GroupNameArgSchema,
        destinationId: z.string().min(1).describe('The ID of the destination to delete.'),
    };

    server.tool(
        'cribl_deleteDestination',
        'Deletes a destination (output) from a worker group. WARNING: This is irreversible. Ensure no routes reference this destination before deleting.',
        DeleteDestinationArgsShape,
        async (args: ValidatedArgs<typeof DeleteDestinationArgsShape>) => {
            console.error(`[Tool Call] cribl_deleteDestination with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await deleteDestination(groupResolution.groupName, args.destinationId);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error deleting destination '${args.destinationId}': ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_deleteDestination: Deleted '${args.destinationId}'`);
            return { content: [{ type: 'text', text: `Successfully deleted destination '${args.destinationId}'. ${JSON.stringify(result.data, null, 2)}` }] };
        }
    );
}
