import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getPipelines, getPipelineConfig, setPipelineConfig, createPipeline, previewPipeline, deletePipeline } from '../api/pipelines.js';
import { ValidatedArgs, GroupNameArgSchema, resolveGroupName } from './shared.js';

export function registerPipelineTools(server: McpServer) {
    const GetPipelinesArgsShape = {
        groupName: GroupNameArgSchema,
    };

    server.tool(
        'cribl_getPipelines',
        'Fetches pipeline definitions in a specified worker group.',
        GetPipelinesArgsShape,
        async (args: ValidatedArgs<typeof GetPipelinesArgsShape>) => {
            console.error(`[Tool Call] cribl_getPipelines with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const groupName = groupResolution.groupName;

            const result = await getPipelines(groupName);
            if (!result.success) {
                console.error(`[Tool Error] cribl_getPipelines (Group: ${groupName}):`, result.error);
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Error fetching pipelines for group ${groupName}: ${result.error}` }],
                };
            }
            console.error(`[Tool Success] cribl_getPipelines (Group: ${groupName}): Found ${result.data?.length || 0} pipelines.`);
            return {
                content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }],
            };
        }
    );

    const GetPipelineConfigArgsShape = {
        groupName: GroupNameArgSchema,
        pipelineId: z.string().describe('The ID of the pipeline to retrieve configuration for.'),
    };

    server.tool(
        'cribl_getPipelineConfig',
        'Retrieves full configuration JSON for a specified pipeline in a worker group.',
        GetPipelineConfigArgsShape,
        async (args: ValidatedArgs<typeof GetPipelineConfigArgsShape>) => {
            console.error(`[Tool Call] cribl_getPipelineConfig with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
             if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const groupName = groupResolution.groupName;
            const { pipelineId } = args;

            if (!pipelineId || pipelineId.trim().length === 0) {
                const pipelinesListResult = await getPipelines(groupName);
                const validIdsString = pipelinesListResult.success
                    ? `Valid pipeline IDs are: [${pipelinesListResult.data?.map(p => p.id).join(', ') || 'None found'}]`
                    : `Failed to retrieve list of valid IDs: ${pipelinesListResult.error}`;
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Pipeline ID argument is required and cannot be empty. ${validIdsString}` }],
                };
            }

            const result = await getPipelineConfig(groupName, pipelineId);

            if (!result.success) {
                let errorMessage = result.error || 'Unknown error getting pipeline config.';
                const isNotFoundError = errorMessage.includes('(404)') &&
                                       (errorMessage.toLowerCase().includes('item not found') ||
                                        errorMessage.toLowerCase().includes('not found'));

                if (isNotFoundError) {
                    console.error(`[stderr] Pipeline ID '${pipelineId}' not found in group '${groupName}', fetching valid IDs...`);
                    const pipelinesListResult = await getPipelines(groupName);
                    if (pipelinesListResult.success) {
                        const validIds = pipelinesListResult.data?.map(p => p.id) || [];
                        errorMessage = `Pipeline ID '${pipelineId}' not found in group '${groupName}'. Valid pipeline IDs are: [${validIds.join(', ') || 'None found'}]`;
                    } else {
                        errorMessage = `Pipeline ID '${pipelineId}' not found in group '${groupName}'. Additionally, failed to retrieve list of valid IDs: ${pipelinesListResult.error}`;
                    }
                }

                console.error(`[Tool Error] cribl_getPipelineConfig (Group: ${groupName}, ID: ${pipelineId}):`, errorMessage);
                return {
                    isError: true,
                    content: [{ type: 'text', text: errorMessage }],
                };
            }

            console.error(`[Tool Success] cribl_getPipelineConfig for Group: ${groupName}, ID: ${pipelineId}`);
            return {
                content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
            };
        }
    );

    const SetPipelineConfigArgsShape = {
        groupName: GroupNameArgSchema,
        pipelineId: z.string().describe('The ID of the pipeline to set configuration for.'),
        config: z.object({}).passthrough().describe('Pipeline configuration payload to validate.'),
    };

    server.tool(
        'cribl_setPipelineConfig',
        'Applies a new configuration payload to a specified pipeline in a worker group.',
        SetPipelineConfigArgsShape,
        async (args: ValidatedArgs<typeof SetPipelineConfigArgsShape>) => {
            console.error(`[Tool Call] cribl_setPipelineConfig with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
             if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const groupName = groupResolution.groupName;

            const { pipelineId, config: pipelineConfig } = args;
            const result = await setPipelineConfig(groupName, pipelineId, pipelineConfig);

            if (!result.success) {
                console.error(`[Tool Error] cribl_setPipelineConfig (Group: ${groupName}, ID: ${pipelineId}):`, result.error);
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Error setting pipeline config for ${pipelineId} in group ${groupName}: ${result.error}` }],
                };
            }

            console.error(`[Tool Success] cribl_setPipelineConfig for Group: ${groupName}, ID: ${pipelineId}`);
            return {
                content: [{ type: 'text', text: `Successfully updated config for pipeline ${pipelineId} in group ${groupName}. Response: ${JSON.stringify(result.data, null, 2)}` }],
            };
        }
    );

    const CreatePipelineArgsShape = {
        groupName: GroupNameArgSchema,
        id: z.string().min(1).describe('Unique ID for the new pipeline.'),
        functions: z.array(z.object({}).passthrough()).min(1).describe('Array of pipeline function objects (conf.functions). Each function should have at least an "id" and "conf" property.'),
        description: z.string().optional().describe('Optional: Description of the pipeline.'),
    };

    server.tool(
        'cribl_createPipeline',
        'Creates a new pipeline in a worker group with the specified functions.',
        CreatePipelineArgsShape,
        async (args: ValidatedArgs<typeof CreatePipelineArgsShape>) => {
            console.error(`[Tool Call] cribl_createPipeline with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const pipeline = {
                id: args.id,
                conf: { functions: args.functions },
                description: args.description,
            };
            const result = await createPipeline(groupResolution.groupName, pipeline);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error creating pipeline '${args.id}' in group ${groupResolution.groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_createPipeline: Created pipeline '${args.id}' in group ${groupResolution.groupName}`);
            return { content: [{ type: 'text', text: `Successfully created pipeline '${args.id}'. ${JSON.stringify(result.data, null, 2)}` }] };
        }
    );

    const PreviewPipelineArgsShape = {
        groupName: GroupNameArgSchema,
        pipelineId: z.string().min(1).describe('The ID of the pipeline to preview.'),
        events: z.array(z.object({}).passthrough()).min(1).describe('Array of event objects to send through the pipeline. Each event should have at least a "_raw" field with the raw event text.'),
        sampleId: z.string().optional().describe('Optional: ID of a sample file to use as input instead of/in addition to events.'),
    };

    server.tool(
        'cribl_previewPipeline',
        'Sends sample events through a pipeline and returns the transformed output. Use this to test and iterate on pipeline configurations — see exactly how events are modified by pipeline functions before committing changes.',
        PreviewPipelineArgsShape,
        async (args: ValidatedArgs<typeof PreviewPipelineArgsShape>) => {
            console.error(`[Tool Call] cribl_previewPipeline with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await previewPipeline(groupResolution.groupName, args.pipelineId, args.events, args.sampleId);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error previewing pipeline '${args.pipelineId}': ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_previewPipeline for pipeline '${args.pipelineId}'`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
        }
    );

    const DeletePipelineArgsShape = {
        groupName: GroupNameArgSchema,
        pipelineId: z.string().min(1).describe('The ID of the pipeline to delete.'),
    };

    server.tool(
        'cribl_deletePipeline',
        'Deletes a pipeline from a worker group. WARNING: This is irreversible. Ensure the pipeline is not referenced by any routes before deleting.',
        DeletePipelineArgsShape,
        async (args: ValidatedArgs<typeof DeletePipelineArgsShape>) => {
            console.error(`[Tool Call] cribl_deletePipeline with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await deletePipeline(groupResolution.groupName, args.pipelineId);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error deleting pipeline '${args.pipelineId}': ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_deletePipeline: Deleted '${args.pipelineId}'`);
            return { content: [{ type: 'text', text: `Successfully deleted pipeline '${args.pipelineId}'. ${JSON.stringify(result.data, null, 2)}` }] };
        }
    );
}
