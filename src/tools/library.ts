import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
    getLookups, getLookupContent, uploadLookup,
    getPacks, getSamples, getSampleData,
    getEventBreakers, getGlobalVariables,
    getRegexLibrary, getParserLibrary, getSchemas, getDatasets,
} from '../api/library.js';
import { ValidatedArgs, GroupNameArgSchema, resolveGroupName } from './shared.js';

export function registerLibraryTools(server: McpServer) {
    server.tool(
        'cribl_getLookups',
        'Fetches lookup file definitions in a specified worker group.',
        { groupName: GroupNameArgSchema },
        async (args: ValidatedArgs<{ groupName: typeof GroupNameArgSchema }>) => {
            console.error(`[Tool Call] cribl_getLookups with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await getLookups(groupResolution.groupName);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error fetching lookups for group ${groupResolution.groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getLookups (Group: ${groupResolution.groupName}): Found ${result.data?.length || 0} lookups.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );

    const GetLookupContentArgsShape = {
        groupName: GroupNameArgSchema,
        lookupId: z.string().min(1).describe('The ID (filename) of the lookup file. Use cribl_getLookups to list available lookups.'),
    };

    server.tool(
        'cribl_getLookupContent',
        'Fetches the actual data content of a lookup file. Returns fields (column headers) and items (rows). Useful for inspecting enrichment data used in pipelines.',
        GetLookupContentArgsShape,
        async (args: ValidatedArgs<typeof GetLookupContentArgsShape>) => {
            console.error(`[Tool Call] cribl_getLookupContent with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await getLookupContent(groupResolution.groupName, args.lookupId);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error fetching lookup content '${args.lookupId}': ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getLookupContent for '${args.lookupId}'`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
        }
    );

    const UploadLookupArgsShape = {
        groupName: GroupNameArgSchema,
        lookupId: z.string().min(1).describe('The ID (filename) of the lookup file to create or update.'),
        fields: z.array(z.string()).min(1).describe('Column header names for the lookup table.'),
        items: z.array(z.array(z.any())).describe('Array of rows, where each row is an array of values matching the fields order.'),
    };

    server.tool(
        'cribl_uploadLookup',
        'Creates or updates a lookup file with the provided fields (columns) and items (rows). WARNING: This overwrites the entire lookup content.',
        UploadLookupArgsShape,
        async (args: ValidatedArgs<typeof UploadLookupArgsShape>) => {
            console.error(`[Tool Call] cribl_uploadLookup with args:`, { ...args, items: `[${args.items.length} rows]` });
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await uploadLookup(groupResolution.groupName, args.lookupId, { fields: args.fields, items: args.items });
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error uploading lookup '${args.lookupId}': ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_uploadLookup: Updated '${args.lookupId}' with ${args.items.length} rows`);
            return { content: [{ type: 'text', text: `Successfully uploaded lookup '${args.lookupId}' with ${args.fields.length} fields and ${args.items.length} rows.` }] };
        }
    );

    server.tool(
        'cribl_getPacks',
        'Fetches installed packs in a specified worker group.',
        { groupName: GroupNameArgSchema },
        async (args: ValidatedArgs<{ groupName: typeof GroupNameArgSchema }>) => {
            console.error(`[Tool Call] cribl_getPacks with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await getPacks(groupResolution.groupName);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error fetching packs for group ${groupResolution.groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getPacks (Group: ${groupResolution.groupName}): Found ${result.data?.length || 0} packs.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );

    server.tool(
        'cribl_getSamples',
        'Fetches sample data files in a specified worker group.',
        { groupName: GroupNameArgSchema },
        async (args: ValidatedArgs<{ groupName: typeof GroupNameArgSchema }>) => {
            console.error(`[Tool Call] cribl_getSamples with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await getSamples(groupResolution.groupName);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error fetching samples for group ${groupResolution.groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getSamples (Group: ${groupResolution.groupName}): Found ${result.data?.length || 0} samples.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );

    const GetSampleDataArgsShape = {
        groupName: GroupNameArgSchema,
        sampleId: z.string().min(1).describe('The ID of the sample file to fetch content from. Use cribl_getSamples to list available samples.'),
    };

    server.tool(
        'cribl_getSampleData',
        'Fetches the actual event content of a sample data file. Returns an array of event objects with _raw, _time, and other fields. Use with cribl_previewPipeline to test pipelines against real sample data.',
        GetSampleDataArgsShape,
        async (args: ValidatedArgs<typeof GetSampleDataArgsShape>) => {
            console.error(`[Tool Call] cribl_getSampleData with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await getSampleData(groupResolution.groupName, args.sampleId);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error fetching sample data '${args.sampleId}': ${result.error}` }] };
            }
            const count = Array.isArray(result.data) ? result.data.length : '?';
            console.error(`[Tool Success] cribl_getSampleData: Fetched ${count} events from sample '${args.sampleId}'`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
        }
    );

    server.tool(
        'cribl_getEventBreakers',
        'Fetches event breaker rulesets in a specified worker group.',
        { groupName: GroupNameArgSchema },
        async (args: ValidatedArgs<{ groupName: typeof GroupNameArgSchema }>) => {
            console.error(`[Tool Call] cribl_getEventBreakers with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await getEventBreakers(groupResolution.groupName);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error fetching event breakers for group ${groupResolution.groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getEventBreakers (Group: ${groupResolution.groupName}): Found ${result.data?.length || 0} rulesets.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );

    server.tool(
        'cribl_getGlobalVariables',
        'Fetches global variables defined in a specified worker group.',
        { groupName: GroupNameArgSchema },
        async (args: ValidatedArgs<{ groupName: typeof GroupNameArgSchema }>) => {
            console.error(`[Tool Call] cribl_getGlobalVariables with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await getGlobalVariables(groupResolution.groupName);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error fetching global variables for group ${groupResolution.groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getGlobalVariables (Group: ${groupResolution.groupName}): Found ${result.data?.length || 0} variables.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );

    server.tool(
        'cribl_getRegexLibrary',
        'Fetches named regex patterns from the regex library in a worker group. These patterns can be referenced by pipeline functions.',
        { groupName: GroupNameArgSchema },
        async (args: ValidatedArgs<{ groupName: typeof GroupNameArgSchema }>) => {
            console.error(`[Tool Call] cribl_getRegexLibrary with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await getRegexLibrary(groupResolution.groupName);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error fetching regex library: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getRegexLibrary (Group: ${groupResolution.groupName}): Found ${result.data?.length || 0} entries.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );

    server.tool(
        'cribl_getParserLibrary',
        'Fetches parser definitions from the parser library in a worker group. Parsers define how to extract structured fields from raw data.',
        { groupName: GroupNameArgSchema },
        async (args: ValidatedArgs<{ groupName: typeof GroupNameArgSchema }>) => {
            console.error(`[Tool Call] cribl_getParserLibrary with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await getParserLibrary(groupResolution.groupName);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error fetching parser library: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getParserLibrary (Group: ${groupResolution.groupName}): Found ${result.data?.length || 0} parsers.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );

    server.tool(
        'cribl_getSchemas',
        'Fetches schema definitions from the schema library in a worker group. Schemas define the expected structure of events.',
        { groupName: GroupNameArgSchema },
        async (args: ValidatedArgs<{ groupName: typeof GroupNameArgSchema }>) => {
            console.error(`[Tool Call] cribl_getSchemas with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await getSchemas(groupResolution.groupName);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error fetching schemas: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getSchemas (Group: ${groupResolution.groupName}): Found ${result.data?.length || 0} schemas.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );

    server.tool(
        'cribl_getDatasets',
        'Fetches dataset providers in a specified worker group.',
        { groupName: GroupNameArgSchema },
        async (args: ValidatedArgs<{ groupName: typeof GroupNameArgSchema }>) => {
            console.error(`[Tool Call] cribl_getDatasets with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const result = await getDatasets(groupResolution.groupName);
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error fetching datasets for group ${groupResolution.groupName}: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getDatasets (Group: ${groupResolution.groupName}): Found ${result.data?.length || 0} dataset providers.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );

}
