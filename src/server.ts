#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z, ZodRawShape } from 'zod';
import { config } from './config.js';
import {
    getPipelines,
    getSources,
    getDestinations,
    getRoutes,
    getAlerts,
    setPipelineConfig,
    getPipelineConfig,
    listWorkerGroups,
    restartWorkerGroup,
    getSystemMetrics,
    versionControl,
    commitPipeline,
    deployPipeline,
    getLookups,
    getPacks,
    getSamples,
    getEventBreakers,
    getGlobalVariables,
    getJobs,
    getDatasets,
    getSystemInfo,
    getUsers,
    runSearch,
    getSearchResults,
    createRoute,
    createSource,
    createDestination,
    toggleRoute,
    createPipeline,
    previewPipeline,
    getWorkers,
    getAppLog,
    getRegexLibrary,
    getParserLibrary,
    getSchemas,
    getSampleData,
    getLookupContent,
    uploadLookup,
    deletePipeline,
    deleteRoute,
    deleteSource,
    deleteDestination,
    runCollectorJob,
    getCollectors,
    updateSource,
    updateDestination,
    getNotifications,
    getGitDiff,
} from './api/criblClient.js';

// Validate config on startup (errors are logged to stderr in config.ts)
try {
    config.cribl.baseUrl; // Check if base URL loaded
    // config.cribl.authToken; // Removed - authToken is no longer static config
    // Removed log: console.log('Configuration loaded successfully.');
} catch (error) {
    // Error is already logged to stderr in config.ts
    // console.error('FATAL: Configuration error:', error); // Redundant
    process.exit(1);
}

const server = new McpServer({
    name: config.server.name,
    version: config.server.version,
});

// --- Tool Definitions ---

// Helper type for validated args based on Zod schema shape
type ValidatedArgs<T extends ZodRawShape> = z.infer<z.ZodObject<T>>;

// Reusable schema for optional groupName: preprocess null to undefined, validate as optional string
const GroupNameArgSchema = z.preprocess(
  (val) => (val === null ? undefined : val), // Map null to undefined before validation
  z.string().optional() // Then validate as optional string
).describe(
  "Optional: The name of the Worker Group/Fleet. If omitted, defaults to attempting to use Cribl Stream and if only one group exists for Stream, it will use that sole group."
);

// Helper function for group name resolution; expects string or undefined
async function resolveGroupName(providedGroupName?: string, defaultProductType: 'stream' | 'edge' | 'search' = 'stream'): Promise<{ groupName?: string; error?: string }> {
    const listResult = await listWorkerGroups(); // Get all groups first for validation
    if (!listResult.success || !listResult.data) {
        const errorMsg = `Failed to list worker groups: ${listResult.error || 'Unknown error'}`;
        console.error(`[stderr] ${errorMsg}`);
        return { error: errorMsg };
    }
    const allGroups = listResult.data;
    const allGroupIds = allGroups.map(g => g.id);

    if (providedGroupName) {
        // Validate provided group name against *all* fetched groups
        if (!allGroupIds.includes(providedGroupName)) {
            const errorMsg = `Worker group '${providedGroupName}' not found. Available groups are: [${allGroupIds.join(', ')}]`;
            console.error(`[stderr] Error: ${errorMsg}`);
            return { error: errorMsg };
        }
        // Provided name is valid
        console.error(`[stderr] Using provided valid group name: ${providedGroupName}`);
        return { groupName: providedGroupName };
    }

    // No group name provided, try to find a default based on productType
    console.error(`[stderr] Group name not provided, attempting lookup for default product '${defaultProductType}'...`);
    const filteredGroups = allGroups.filter(group => {
         if (defaultProductType === 'stream') return !group.isFleet && !group.isSearch;
         if (defaultProductType === 'edge') return group.isFleet === true;
         if (defaultProductType === 'search') return group.isSearch === true;
         return false;
    });

    if (filteredGroups.length === 1) {
        const resolvedName = filteredGroups[0].id;
        console.error(`[stderr] Found single worker group for product '${defaultProductType}': ${resolvedName}, using it as default.`);
        return { groupName: resolvedName };
    } else if (filteredGroups.length === 0) {
         // Provide list of *all* groups if the default type isn't found
         const errorMsg = `No worker groups found for default product type '${defaultProductType}'. Please specify a groupName. Available groups are: [${allGroupIds.join(', ')}]`; 
         console.error(`[stderr] Error: ${errorMsg}`);
         return { error: errorMsg };
    } else {
        const filteredGroupIds = filteredGroups.map(g => g.id);
        // Provide list of groups matching the default type when ambiguous
        const errorMsg = `Multiple worker groups found for default product type '${defaultProductType}': [${filteredGroupIds.join(', ')}]. Please specify the 'groupName' argument.`; 
        console.error(`[stderr] Error: ${errorMsg}`);
        return { error: errorMsg };
    }
}

// Define schema for listWorkerGroups arguments
const ListWorkerGroupsArgsShape = {
    productType: z.preprocess(
        (val) => (val === null || val === undefined || val === '' ? 'stream' : val), // Map null/undefined/empty to default
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

        // Filter based on productType, skip if 'all'
        const groupsToReturn = productType === 'all' 
            ? result.data 
            : result.data.filter(group => {
                if (productType === 'stream') return !group.isFleet && !group.isSearch;
                if (productType === 'edge') return group.isFleet === true;
                if (productType === 'search') return group.isSearch === true;
                return false; // Should not happen
             });

        console.error(`[Tool Success] cribl_listWorkerGroups: Found ${groupsToReturn.length} groups matching filter '${productType}'.`);
        return {
            content: [{ type: 'text', text: JSON.stringify(groupsToReturn, null, 2) }],
        };
    }
);

// Define schema for getPipelines arguments (groupName optional)
const GetPipelinesArgsShape = {
    groupName: GroupNameArgSchema,
};

server.tool(
    'cribl_getPipelines',
    'Fetches pipeline definitions in a specified worker group.',
    GetPipelinesArgsShape,
    async (args: ValidatedArgs<typeof GetPipelinesArgsShape>) => {
        console.error(`[Tool Call] cribl_getPipelines with args:`, args);
        const groupResolution = await resolveGroupName(args.groupName); // Pass directly, preprocess handles null
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

// Define schema for getSources arguments (groupName optional)
const GetSourcesArgsShape = {
    groupName: GroupNameArgSchema,
};

server.tool(
    'cribl_getSources',
    'Fetches source configurations in a specified worker group.',
    GetSourcesArgsShape,
    async (args: ValidatedArgs<typeof GetSourcesArgsShape>) => { 
        console.error(`[Tool Call] cribl_getSources with args:`, args);
        const groupResolution = await resolveGroupName(args.groupName); // Pass directly, preprocess handles null
        if (groupResolution.error || !groupResolution.groupName) {
            return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
        }
        const groupName = groupResolution.groupName;

        const result = await getSources(groupName);
        if (!result.success) {
            console.error(`[Tool Error] cribl_getSources (Group: ${groupName}):`, result.error);
            return {
                isError: true,
                content: [{ type: 'text', text: `Error fetching sources for group ${groupName}: ${result.error}` }],
            };
        }
        console.error(`[Tool Success] cribl_getSources (Group: ${groupName}): Found ${result.data?.length || 0} sources.`);
        return {
            content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }],
        };
    }
);

// Define schema for getDestinations arguments (groupName optional)
const GetDestinationsArgsShape = {
    groupName: GroupNameArgSchema,
};

server.tool(
    'cribl_getDestinations',
    'Fetches destination (output) configurations in a specified worker group.',
    GetDestinationsArgsShape,
    async (args: ValidatedArgs<typeof GetDestinationsArgsShape>) => {
        console.error(`[Tool Call] cribl_getDestinations with args:`, args);
        const groupResolution = await resolveGroupName(args.groupName);
        if (groupResolution.error || !groupResolution.groupName) {
            return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
        }
        const groupName = groupResolution.groupName;

        const result = await getDestinations(groupName);
        if (!result.success) {
            console.error(`[Tool Error] cribl_getDestinations (Group: ${groupName}):`, result.error);
            return {
                isError: true,
                content: [{ type: 'text', text: `Error fetching destinations for group ${groupName}: ${result.error}` }],
            };
        }
        console.error(`[Tool Success] cribl_getDestinations (Group: ${groupName}): Found ${result.data?.length || 0} destinations.`);
        return {
            content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }],
        };
    }
);

// Define schema for getRoutes arguments (groupName optional)
const GetRoutesArgsShape = {
    groupName: GroupNameArgSchema,
};

server.tool(
    'cribl_getRoutes',
    'Fetches route configurations in a specified worker group. Routes define how data flows from sources through pipelines to destinations.',
    GetRoutesArgsShape,
    async (args: ValidatedArgs<typeof GetRoutesArgsShape>) => {
        console.error(`[Tool Call] cribl_getRoutes with args:`, args);
        const groupResolution = await resolveGroupName(args.groupName);
        if (groupResolution.error || !groupResolution.groupName) {
            return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
        }
        const groupName = groupResolution.groupName;

        const result = await getRoutes(groupName);
        if (!result.success) {
            console.error(`[Tool Error] cribl_getRoutes (Group: ${groupName}):`, result.error);
            return {
                isError: true,
                content: [{ type: 'text', text: `Error fetching routes for group ${groupName}: ${result.error}` }],
            };
        }
        console.error(`[Tool Success] cribl_getRoutes (Group: ${groupName}): Found ${result.data?.length || 0} routes.`);
        return {
            content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }],
        };
    }
);

// Define schema for getAlerts arguments (global, no group scope)
const GetAlertsArgsShape = {
    limit: z.number().int().optional().describe('Optional: Maximum number of alerts to return.'),
    offset: z.number().int().optional().default(0).describe('Optional: Number of alerts to skip (for pagination). Defaults to 0.'),
    sort: z.string().optional().describe('Optional: Sort expression for results.'),
    filter: z.string().optional().describe('Optional: Filter expression to narrow results.'),
};

server.tool(
    'cribl_getAlerts',
    'Fetches system alerts and messages from the Cribl deployment. Supports pagination and filtering.',
    GetAlertsArgsShape,
    async (args: ValidatedArgs<typeof GetAlertsArgsShape>) => {
        console.error(`[Tool Call] cribl_getAlerts with args:`, args);
        const result = await getAlerts(args);
        if (!result.success) {
            console.error(`[Tool Error] cribl_getAlerts:`, result.error);
            return {
                isError: true,
                content: [{ type: 'text', text: `Error fetching alerts: ${result.error}` }],
            };
        }
        console.error(`[Tool Success] cribl_getAlerts: Found ${result.data?.length || 0} alerts.`);
        return {
            content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }],
        };
    }
);

// Define schema for getWorkerGroupStatus arguments (global, reuses listWorkerGroups)
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

// Define schema for getPipelineConfig arguments (groupName optional)
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
        const groupResolution = await resolveGroupName(args.groupName); // Pass directly, preprocess handles null
         if (groupResolution.error || !groupResolution.groupName) {
            return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
        }
        const groupName = groupResolution.groupName;
        const { pipelineId } = args;

        // Input validation for pipelineId itself (prevent empty strings)
        if (!pipelineId || pipelineId.trim().length === 0) {
            // Fetch valid IDs to include in the error message
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
            // Check if it's the specific 404 Item not found error
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
            // Return the full pipeline object which includes the config
            content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }], 
        };
    }
);

// Define schema for setPipelineConfig arguments (groupName optional)
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
        const groupResolution = await resolveGroupName(args.groupName); // Pass directly, preprocess handles null
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

// Reintegrate restartWorkerGroup tool definition (no arguments)
const RestartWorkerGroupArgsShape = {}; // No args needed

server.tool(
    'cribl_restartWorkerGroup',
    'Restarts all workers within the default or specified worker group.',
    RestartWorkerGroupArgsShape,
    async () => { // No args needed
        console.error(`[Tool Call] cribl_restartWorkerGroup`);
        const result = await restartWorkerGroup(); // Call client function without groupName
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

// Define schema for getSystemMetrics with optional filtering parameters
const GetSystemMetricsArgsShape = {
    filterExpr: z.string().optional().nullable().describe('Optional: A JS expression to filter metrics (e.g., "model.pipeline === \'test\'" or "host == \'myhost\'").'),
    metricNameFilter: z.string().optional().nullable().describe('Optional: Regex or array of metric names (e.g.,limit to "pipe.*" , "total.in_bytes", or "os.cpu.perc,os.mem.*").'),
    earliest: z.string().optional().nullable().describe('Optional: Start time for the query (e.g., \'-15m\', \'2023-10-26T10:00:00Z\').'),
    latest: z.string().optional().nullable().describe('Optional: End time for the query (e.g., \'now\', \'2023-10-26T10:15:00Z\').'),
    numBuckets: z.number().int().optional().nullable().describe('Optional: The number of time buckets for aggregation.'),
    wp: z.string().optional().nullable().describe('Optional: Worker process filter.'),
}

server.tool(
    'cribl_getSystemMetrics',
    'Retrieves system metrics from the Cribl deployment. \nIMPORTANT: To avoid excessively large responses, please use the optional parameters (filterExpr, metricNameFilter, earliest, latest, numBuckets, wp) to narrow down your query whenever possible. \nIf no parameters are provided, the server will default to fetching only the most recent data bucket (numBuckets=1) to prevent performance issues.',
    GetSystemMetricsArgsShape,
    async (args: ValidatedArgs<typeof GetSystemMetricsArgsShape>) => {
        console.error(`[Tool Call] cribl_getSystemMetrics with args:`, args)

        // Pass the validated args to the API client function
        const result = await getSystemMetrics(args)

        if (!result.success || typeof result.data !== 'string') {
            console.error(`[Tool Error] cribl_getSystemMetrics for args ${JSON.stringify(args)}:`, result.error || 'Invalid data received')
            return {
                isError: true,
                content: [{ type: 'text', text: `Error fetching system metrics: ${result.error || 'Unknown error'}` }],
            }
        }

        console.error(`[Tool Success] cribl_getSystemMetrics: Fetched ${result.data.length} characters of metrics for args:`, args)
        return {
            content: [{ type: 'text', text: result.data }],
        }
    }
)

// Define schema for cribl_versionControl arguments (none required)
const VersionControlArgsShape = {}

server.tool(
    'cribl_versionControl',
    'Detects if version control (git) is enabled on the Cribl instance and whether a remote repository URL is configured.',
    VersionControlArgsShape,
    async () => {
        console.error(`[Tool Call] cribl_versionControl`)
        const result = await versionControl()
        if (!result.success || !result.data) {
            console.error(`[Tool Error] cribl_versionControl:`, result.error)
            return { isError: true, content: [{ type: 'text', text: `Error detecting version control: ${result.error}` }] }
        }
        
        // Extract key information from the result
        const versionInfo = result.data;
        const isEnabled = versionInfo.versioning === true;
        const remoteUrl = versionInfo.remote || 'None configured';
        const branch = versionInfo.branch || 'unknown';
        
        // Log detailed version control status
        console.error(`[Tool Success] cribl_versionControl: enabled=${isEnabled}, remoteUrl=${remoteUrl}, branch=${branch}`);
        
        // Log additional git details if available
        if (versionInfo.lastCommit) {
            console.error(`[Tool Success] cribl_versionControl: lastCommit=${versionInfo.lastCommit.id}, message="${versionInfo.lastCommit.message}", author=${versionInfo.lastCommit.author}`);
        }
        
        if (versionInfo.status) {
            const hasChanges = (
                (versionInfo.status.staged && versionInfo.status.staged.length > 0) || 
                (versionInfo.status.unstaged && versionInfo.status.unstaged.length > 0) || 
                (versionInfo.status.untracked && versionInfo.status.untracked.length > 0)
            );
            
            console.error(`[Tool Success] cribl_versionControl: hasChanges=${hasChanges}, staged=${versionInfo.status.staged?.length || 0}, unstaged=${versionInfo.status.unstaged?.length || 0}, untracked=${versionInfo.status.untracked?.length || 0}`);
        }
        
        // Return full details for LLM use
        return { 
            content: [{ 
                type: 'text', 
                text: JSON.stringify(versionInfo, null, 2)
            }] 
        }
    }
)

// Define schema for cribl_commitPipeline arguments
const CommitPipelineArgsShape = {
    message: z.string().min(1).describe('The commit message.')
}

server.tool(
    'cribl_commitPipeline',
    'Commits staged pipeline config changes to version control with a message. Returns detailed commit information including branch, commit ID, and summary of changed files.',
    CommitPipelineArgsShape,
    async (args: ValidatedArgs<typeof CommitPipelineArgsShape>) => {
        console.error(`[Tool Call] cribl_commitPipeline with args:`, args)
        
        // Call client function
        const result = await commitPipeline(args.message) 
        
        // Check for success (defined by having valid data with a commit ID)
        if (!result.success || !result.data || !result.data.commit) {
            console.error(`[Tool Error] cribl_commitPipeline:`, result.error || 'No commit information returned.')
            return { 
                isError: true, 
                content: [{ 
                    type: 'text', 
                    text: `Error committing pipeline changes: ${result.error || 'No commit information returned.'}`
                }] 
            }
        }

        // Extract commit ID and other useful information
        const { commit: commitId, branch, summary, files } = result.data;
        
        // Log success with key details
        console.error(`[Tool Success] cribl_commitPipeline: commitId=${commitId}, branch=${branch}`);
        
        // Log file summary if available
        if (summary) {
            console.error(`[Tool Success] cribl_commitPipeline: files changed - added=${summary.added || 0}, modified=${summary.modified || 0}, deleted=${summary.deleted || 0}`);
        }
        
        // Return formatted commit result with details for LLM use
        return { 
            content: [{ 
                type: 'text', 
                text: JSON.stringify({
                    // Rename commit ID for clarity at LLM level
                    commitId,
                    // Include full result data for LLM to use as needed
                    ...result.data
                }, null, 2)
            }] 
        }
    }
)

// Define schema for cribl_deployPipeline arguments
const DeployPipelineArgsShape = {
    groupName: GroupNameArgSchema,
    version: z.string().min(1).describe('The commit ID (version) to deploy.')
};

server.tool(
    'cribl_deployPipeline',
    'Deploys a specific committed configuration version to a worker group. Returns the list of ConfigGroup objects Cribl provides.',
    DeployPipelineArgsShape,
    async (args: ValidatedArgs<typeof DeployPipelineArgsShape>) => {
        console.error(`[Tool Call] cribl_deployPipeline with args:`, args)
        // Resolve group name (optional arg)
        const groupResolution = await resolveGroupName(args.groupName)
        if (groupResolution.error || !groupResolution.groupName) {
            return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] }
        }
        const groupName = groupResolution.groupName
        const { version } = args

        const result = await deployPipeline(groupName, version)
        if (!result.success || !result.data) {
            console.error(`[Tool Error] cribl_deployPipeline:`, result.error || 'Unknown error')
            return { isError: true, content: [{ type: 'text', text: `Error deploying version ${version}: ${result.error}` }] }
        }

        // Success: expose full JSON result including all ConfigGroup fields
        console.error(`[Tool Success] cribl_deployPipeline: Deployed commit ${version} to group ${groupName}. ConfigGroups returned: ${result.data.count}`)
        return {
            content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }]
        }
    }
)

// --- Batch 1: Read-Only Group-Scoped Tools ---

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

// --- Batch 2: Global Read-Only Tools ---

server.tool(
    'cribl_getSystemInfo',
    'Retrieves system information from the Cribl deployment including version, build, license, and uptime.',
    {},
    async () => {
        console.error(`[Tool Call] cribl_getSystemInfo`);
        const result = await getSystemInfo();
        if (!result.success || !result.data) {
            return { isError: true, content: [{ type: 'text', text: `Error fetching system info: ${result.error}` }] };
        }
        console.error(`[Tool Success] cribl_getSystemInfo: version=${result.data.version || 'unknown'}`);
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
);

server.tool(
    'cribl_getUsers',
    'Fetches user accounts from the Cribl deployment including usernames, roles, and disabled status.',
    {},
    async () => {
        console.error(`[Tool Call] cribl_getUsers`);
        const result = await getUsers();
        if (!result.success) {
            return { isError: true, content: [{ type: 'text', text: `Error fetching users: ${result.error}` }] };
        }
        console.error(`[Tool Success] cribl_getUsers: Found ${result.data?.length || 0} users.`);
        return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
    }
);

// --- Batch 3: Search Tools ---

const RunSearchArgsShape = {
    query: z.string().min(1).describe('The search query to execute.'),
    earliest: z.string().optional().describe('Optional: Start time for the search (e.g., "-1h", "2024-01-01T00:00:00Z").'),
    latest: z.string().optional().describe('Optional: End time for the search (e.g., "now", "2024-01-01T01:00:00Z").'),
    dataset: z.string().optional().describe('Optional: Dataset to search against.'),
};

server.tool(
    'cribl_runSearch',
    'Submits a search job to Cribl Search. Returns a job object with an ID that can be used with cribl_getSearchResults to poll for results. May be Cloud/Search-only.',
    RunSearchArgsShape,
    async (args: ValidatedArgs<typeof RunSearchArgsShape>) => {
        console.error(`[Tool Call] cribl_runSearch with args:`, args);
        const result = await runSearch(args);
        if (!result.success || !result.data) {
            return { isError: true, content: [{ type: 'text', text: `Error running search: ${result.error}` }] };
        }
        console.error(`[Tool Success] cribl_runSearch: Job ID=${result.data.id}, Status=${result.data.status || 'unknown'}`);
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
);

const GetSearchResultsArgsShape = {
    jobId: z.string().min(1).describe('The search job ID returned by cribl_runSearch.'),
};

server.tool(
    'cribl_getSearchResults',
    'Retrieves results for a previously submitted search job. If the job is still running, returns the current status — the LLM should poll by calling this tool again.',
    GetSearchResultsArgsShape,
    async (args: ValidatedArgs<typeof GetSearchResultsArgsShape>) => {
        console.error(`[Tool Call] cribl_getSearchResults with args:`, args);
        const result = await getSearchResults(args.jobId);
        if (!result.success) {
            return { isError: true, content: [{ type: 'text', text: `Error fetching search results for job ${args.jobId}: ${result.error}` }] };
        }
        console.error(`[Tool Success] cribl_getSearchResults for job ${args.jobId}`);
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
);

// --- Batch 4: Write/Action Tools ---

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

// --- Round 3: Additional Tools ---

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

const GetAppLogArgsShape = {
    limit: z.number().int().optional().describe('Optional: Maximum number of log entries to return.'),
    filter: z.string().optional().describe('Optional: Filter expression to narrow log results (e.g., "level==\'error\'").'),
};

server.tool(
    'cribl_getAppLog',
    'Fetches recent application log entries from the Cribl deployment. Useful for troubleshooting errors and understanding system behavior.',
    GetAppLogArgsShape,
    async (args: ValidatedArgs<typeof GetAppLogArgsShape>) => {
        console.error(`[Tool Call] cribl_getAppLog with args:`, args);
        const result = await getAppLog(args);
        if (!result.success) {
            return { isError: true, content: [{ type: 'text', text: `Error fetching app log: ${result.error}` }] };
        }
        console.error(`[Tool Success] cribl_getAppLog: Found ${result.data?.length || 0} log entries.`);
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

// --- Round 4: CRUD Completion + Sample/Lookup Content ---

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

// --- Round 5: Final Tools ---

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

server.tool(
    'cribl_getNotifications',
    'Fetches notification rule definitions from the Cribl deployment. These are alert rules that trigger based on conditions (different from cribl_getAlerts which shows triggered messages).',
    {},
    async () => {
        console.error(`[Tool Call] cribl_getNotifications`);
        const result = await getNotifications();
        if (!result.success) {
            return { isError: true, content: [{ type: 'text', text: `Error fetching notifications: ${result.error}` }] };
        }
        console.error(`[Tool Success] cribl_getNotifications: Found ${result.data?.length || 0} notification rules.`);
        return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
    }
);

server.tool(
    'cribl_getGitDiff',
    'Shows uncommitted configuration changes (git diff) in the Cribl deployment. Use before cribl_commitPipeline to review what will be committed.',
    {},
    async () => {
        console.error(`[Tool Call] cribl_getGitDiff`);
        const result = await getGitDiff();
        if (!result.success) {
            return { isError: true, content: [{ type: 'text', text: `Error fetching git diff: ${result.error}` }] };
        }
        console.error(`[Tool Success] cribl_getGitDiff`);
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
);

// --- Server Connection ---

async function main() {
    try {
        const transport = new StdioServerTransport();
        // Removed log: console.log('Connecting transport...');
        await server.connect(transport);
        // Use stderr for final confirmation log
        console.error('MCP Server is connected and listening via stdio.');
    } catch (error) {
        console.error('Failed to connect MCP server:', error);
        process.exit(1);
    }
}

main(); 