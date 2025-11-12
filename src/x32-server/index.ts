#!/usr/bin/env node
import { z } from 'zod';
import { McpServer } from '../server/mcp.js';
import { StdioServerTransport } from '../server/stdio.js';
import { X32Connection } from './x32-connection.js';
import { CallToolResult } from '../types.js';

/**
 * X32 MCP Server
 * Model Context Protocol server for X32/M32 mixer control
 */
async function main() {
    // Create X32 connection instance
    const connection = new X32Connection();

    // Create MCP server
    const server = new McpServer(
        {
            name: 'x32-mcp-server',
            version: '1.0.0'
        },
        {
            capabilities: {
                tools: {}
            }
        }
    );

    // Register x32_connect tool
    server.tool(
        'x32_connect',
        'Connect to X32/M32 mixer via OSC protocol',
        {
            host: z.string().describe('X32/M32 mixer IP address'),
            port: z.number().default(10023).describe('X32/M32 mixer OSC port (default: 10023)')
        },
        async ({ host, port }): Promise<CallToolResult> => {
            if (connection.connected) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'Already connected to X32/M32 mixer'
                        }
                    ]
                };
            }

            try {
                await connection.connect({ host, port });
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Successfully connected to X32/M32 at ${host}:${port}`
                        }
                    ]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Failed to connect: ${error instanceof Error ? error.message : String(error)}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );

    // Register x32_get_info tool
    server.tool('x32_get_info', 'Get X32/M32 mixer console information (model, version, etc.)', {}, async (): Promise<CallToolResult> => {
        if (!connection.connected) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'Not connected to X32/M32 mixer. Use x32_connect first.'
                    }
                ],
                isError: true
            };
        }

        try {
            const info = await connection.getInfo();
            const output = [
                `Console Model: ${info.consoleModel}`,
                `Console Version: ${info.consoleVersion}`,
                `Server Name: ${info.serverName}`,
                `Server Version: ${info.serverVersion}`
            ].join('\n');

            return {
                content: [
                    {
                        type: 'text',
                        text: output
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to get info: ${error instanceof Error ? error.message : String(error)}`
                    }
                ],
                isError: true
            };
        }
    });

    // Register x32_get_status tool
    server.tool(
        'x32_get_status',
        'Get X32/M32 mixer current status (state, IP address, server name)',
        {},
        async (): Promise<CallToolResult> => {
            if (!connection.connected) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'Not connected to X32/M32 mixer. Use x32_connect first.'
                        }
                    ],
                    isError: true
                };
            }

            try {
                const status = await connection.getStatus();
                const output = [`State: ${status.state}`, `IP Address: ${status.ipAddress}`, `Server Name: ${status.serverName}`].join(
                    '\n'
                );

                return {
                    content: [
                        {
                            type: 'text',
                            text: output
                        }
                    ]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Failed to get status: ${error instanceof Error ? error.message : String(error)}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );

    // Setup connection event handlers
    connection.on('connected', () => {
        console.error('X32 Connected');
    });

    connection.on('disconnected', () => {
        console.error('X32 Disconnected');
    });

    connection.on('error', error => {
        console.error('X32 Error:', error);
    });

    // Create stdio transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.connect(transport);

    console.error('X32 MCP Server running on stdio');
    console.error('Available tools:');
    console.error('  - x32_connect: Connect to X32/M32 mixer');
    console.error('  - x32_get_info: Get console information');
    console.error('  - x32_get_status: Get current status');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.error('\nShutting down...');
        if (connection.connected) {
            await connection.disconnect();
        }
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.error('\nShutting down...');
        if (connection.connected) {
            await connection.disconnect();
        }
        process.exit(0);
    });
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
