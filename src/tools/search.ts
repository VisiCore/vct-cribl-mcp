import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runSearch, getSearchResults } from '../api/search.js';
import { ValidatedArgs } from './shared.js';

export function registerSearchTools(server: McpServer) {
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
}
