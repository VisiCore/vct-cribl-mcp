import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSystemInfo, getSystemMetrics, getUsers, getAlerts, getNotifications, getAppLog } from '../api/system.js';
import { ValidatedArgs } from './shared.js';

export function registerSystemTools(server: McpServer) {
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
                return { isError: true, content: [{ type: 'text', text: `Error fetching alerts: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getAlerts: Found ${result.data?.length || 0} alerts.`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data || [], null, 2) }] };
        }
    );

    const GetSystemMetricsArgsShape = {
        filterExpr: z.string().optional().nullable().describe('Optional: A JS expression to filter metrics (e.g., "model.pipeline === \'test\'" or "host == \'myhost\'").'),
        metricNameFilter: z.string().optional().nullable().describe('Optional: Regex or array of metric names (e.g.,limit to "pipe.*" , "total.in_bytes", or "os.cpu.perc,os.mem.*").'),
        earliest: z.string().optional().nullable().describe('Optional: Start time for the query (e.g., \'-15m\', \'2023-10-26T10:00:00Z\').'),
        latest: z.string().optional().nullable().describe('Optional: End time for the query (e.g., \'now\', \'2023-10-26T10:15:00Z\').'),
        numBuckets: z.number().int().optional().nullable().describe('Optional: The number of time buckets for aggregation.'),
        wp: z.string().optional().nullable().describe('Optional: Worker process filter.'),
    };

    server.tool(
        'cribl_getSystemMetrics',
        'Retrieves system metrics from the Cribl deployment. \nIMPORTANT: To avoid excessively large responses, please use the optional parameters (filterExpr, metricNameFilter, earliest, latest, numBuckets, wp) to narrow down your query whenever possible. \nIf no parameters are provided, the server will default to fetching only the most recent data bucket (numBuckets=1) to prevent performance issues.',
        GetSystemMetricsArgsShape,
        async (args: ValidatedArgs<typeof GetSystemMetricsArgsShape>) => {
            console.error(`[Tool Call] cribl_getSystemMetrics with args:`, args);
            const result = await getSystemMetrics(args);
            if (!result.success || typeof result.data !== 'string') {
                console.error(`[Tool Error] cribl_getSystemMetrics for args ${JSON.stringify(args)}:`, result.error || 'Invalid data received');
                return { isError: true, content: [{ type: 'text', text: `Error fetching system metrics: ${result.error || 'Unknown error'}` }] };
            }
            console.error(`[Tool Success] cribl_getSystemMetrics: Fetched ${result.data.length} characters of metrics for args:`, args);
            return { content: [{ type: 'text', text: result.data }] };
        }
    );

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
}
