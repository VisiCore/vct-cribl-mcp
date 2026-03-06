import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getRoutes, createRoute, toggleRoute, deleteRoute } from '../api/routes.js';
import { ValidatedArgs, GroupNameArgSchema, resolveGroupName } from './shared.js';

export function registerRouteTools(server: McpServer) {
    server.tool(
        'cribl_getRoutes',
        'Fetches route configurations in a specified worker group. Routes define how data flows from sources through pipelines to destinations.',
        { groupName: GroupNameArgSchema },
        async (args: ValidatedArgs<{ groupName: typeof GroupNameArgSchema }>) => {
            console.error(`[Tool Call] cribl_getRoutes with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const groupName = groupResolution.groupName;
            const result = await getRoutes(groupName);
            if (!result.success) {
                console.error(`[Tool Error] cribl_getRoutes (Group: ${groupName}):`, result.error);
                return { isError: true, content: [{ type: 'text', text: `Error fetching routes for group ${groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getRoutes (Group: ${groupName}): Found ${result.data?.length || 0} routes.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );

    const CreateRouteArgsShape = {
        groupName: GroupNameArgSchema,
        id: z.string().min(1).describe('Unique ID for the new route.'),
        output: z.string().min(1).describe('Destination (output) ID for this route.'),
        name: z.string().optional().describe('Optional: Display name for the route.'),
        filter: z.string().optional().describe('Optional: Filter expression (defaults to "true" — matches all events).'),
        pipeline: z.string().optional().describe('Optional: Pipeline ID to process events through.'),
        enabled: z.boolean().optional().describe('Optional: Whether the route is enabled (defaults to true).'),
        description: z.string().optional().describe('Optional: Description of the route.'),
    };

    server.tool(
        'cribl_createRoute',
        'Creates a new route in a worker group. Routes define how data flows from sources through pipelines to destinations. Uses a read-modify-write pattern on the routes endpoint.',
        CreateRouteArgsShape,
        async (args: ValidatedArgs<typeof CreateRouteArgsShape>) => {
            console.error(`[Tool Call] cribl_createRoute with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const { id, output, name, filter, pipeline, enabled, description } = args;
            const result = await createRoute(groupResolution.groupName, { id, output, name, filter, pipeline, enabled, description });
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error creating route '${id}' in group ${groupResolution.groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_createRoute: Created route '${id}' in group ${groupResolution.groupName}`);
            return { content: [{ type: 'text', text: `Successfully created route '${id}'. ${JSON.stringify(result.data, null, 2)}` }] };
        }
    );

    const ToggleRouteArgsShape = {
        groupName: GroupNameArgSchema,
        routeId: z.string().min(1).describe('The ID of the route to enable or disable.'),
        enabled: z.boolean().describe('Whether to enable (true) or disable (false) the route.'),
    };

    server.tool(
        'cribl_toggleRoute',
        'Enables or disables an existing route in a worker group. Uses a read-modify-write pattern on the routes endpoint.',
        ToggleRouteArgsShape,
        async (args: ValidatedArgs<typeof ToggleRouteArgsShape>) => {
            console.error(`[Tool Call] cribl_toggleRoute with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await toggleRoute(groupResolution.groupName, args.routeId, args.enabled);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error toggling route '${args.routeId}' in group ${groupResolution.groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_toggleRoute: Route '${args.routeId}' set to enabled=${args.enabled}`);
            return { content: [{ type: 'text', text: `Successfully set route '${args.routeId}' to enabled=${args.enabled}. ${JSON.stringify(result.data, null, 2)}` }] };
        }
    );

    const DeleteRouteArgsShape = {
        groupName: GroupNameArgSchema,
        routeId: z.string().min(1).describe('The ID of the route to delete.'),
    };

    server.tool(
        'cribl_deleteRoute',
        'Deletes a route from a worker group. WARNING: This is irreversible.',
        DeleteRouteArgsShape,
        async (args: ValidatedArgs<typeof DeleteRouteArgsShape>) => {
            console.error(`[Tool Call] cribl_deleteRoute with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await deleteRoute(groupResolution.groupName, args.routeId);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error deleting route '${args.routeId}': ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_deleteRoute: Deleted '${args.routeId}'`);
            return { content: [{ type: 'text', text: result.data?.message || `Successfully deleted route '${args.routeId}'.` }] };
        }
    );
}
