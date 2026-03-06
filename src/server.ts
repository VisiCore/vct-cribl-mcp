#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from './config.js';
import { registerAllTools } from './tools/index.js';

// Validate config on startup
try {
    config.cribl.baseUrl;
} catch (error) {
    process.exit(1);
}

const server = new McpServer({
    name: config.server.name,
    version: config.server.version,
});

registerAllTools(server);

async function main() {
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error('MCP Server is connected and listening via stdio.');
    } catch (error) {
        console.error('Failed to connect MCP server:', error);
        process.exit(1);
    }
}

main();
