import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPipelineTools } from './pipelines.js';
import { registerSourceTools } from './sources.js';
import { registerDestinationTools } from './destinations.js';
import { registerRouteTools } from './routes.js';
import { registerWorkerTools } from './workers.js';
import { registerSystemTools } from './system.js';
import { registerLibraryTools } from './library.js';
import { registerSearchTools } from './search.js';
import { registerVersionControlTools } from './versionControl.js';
import { registerJobTools } from './jobs.js';

export function registerAllTools(server: McpServer) {
    registerPipelineTools(server);
    registerSourceTools(server);
    registerDestinationTools(server);
    registerRouteTools(server);
    registerWorkerTools(server);
    registerSystemTools(server);
    registerLibraryTools(server);
    registerSearchTools(server);
    registerVersionControlTools(server);
    registerJobTools(server);
}
