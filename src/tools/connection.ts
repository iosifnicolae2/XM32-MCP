import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { X32Connection } from '../services/x32-connection.js';
import { parseDeviceType, DeviceType, getDeviceConfig } from '../types/index.js';

/**
 * Connection domain tools
 * Handles connection, disconnection, info, and status operations
 */

/**
 * Register connection_connect tool
 * Establishes connection to X32/M32/XR18 mixer
 */
function registerConnectionConnectTool(server: McpServer, connection: X32Connection): void {
    const defaultHost = process.env.MIXER_HOST;
    const defaultDeviceType = parseDeviceType(process.env.MIXER_TYPE);
    const deviceConfig = getDeviceConfig(defaultDeviceType);
    // Use device-specific port: 10023 for X32/M32, 10024 for XAir (XR18/XR16/XR12)
    const defaultPort = process.env.MIXER_PORT ? parseInt(process.env.MIXER_PORT, 10) : deviceConfig.defaultPort;

    server.registerTool(
        'connection_connect',
        {
            title: 'Connect to Mixer',
            description:
                'Establishes a connection to an X32, M32, XR18, XR16, or XR12 digital mixing console using the OSC (Open Sound Control) protocol. Use this tool when you need to control mixer functions remotely. The mixer must be powered on and connected to the same network.' +
                (defaultHost ? ` Default: ${defaultDeviceType} at ${defaultHost}:${defaultPort}` : ''),
            inputSchema: {
                host: defaultHost
                    ? z.string().optional().describe(`IP address of the mixer (default: ${defaultHost})`)
                    : z.string().describe('IP address of the mixer on the network (e.g., "192.168.1.100")'),
                port: z
                    .number()
                    .optional()
                    .describe(
                        `OSC port number. Default: 10023 for X32/M32, 10024 for XAir series (XR18/XR16/XR12). Current default: ${defaultPort}`
                    ),
                deviceType: z
                    .enum(['X32', 'XR18', 'XR16', 'XR12'])
                    .optional()
                    .describe(
                        `Mixer type (default: ${defaultDeviceType}). X32/M32 use port 10023 and /main/st addresses. XAir series (XR18/XR16/XR12) use port 10024 and /lr addresses.`
                    )
            },
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ host, port, deviceType }): Promise<CallToolResult> => {
            const resolvedHost = host || defaultHost;
            const resolvedDeviceType = (deviceType as DeviceType) || defaultDeviceType;
            // Use device-specific port if not explicitly provided
            const resolvedDeviceConfig = getDeviceConfig(resolvedDeviceType);
            const resolvedPort = port ?? (process.env.MIXER_PORT ? parseInt(process.env.MIXER_PORT, 10) : resolvedDeviceConfig.defaultPort);

            if (!resolvedHost) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'Host IP address is required. Please provide the mixer IP address, or set the MIXER_HOST environment variable.'
                        }
                    ],
                    isError: true
                };
            }

            if (connection.connected) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Already connected to ${connection.deviceConfig.type} mixer`
                        }
                    ]
                };
            }

            try {
                await connection.connect({ host: resolvedHost, port: resolvedPort, deviceType: resolvedDeviceType });
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Successfully connected to ${resolvedDeviceType} at ${resolvedHost}:${resolvedPort}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const troubleshootingSteps = [
                    `Connection to ${resolvedDeviceType} mixer failed: ${errorMessage}`,
                    '',
                    'Common causes and solutions:',
                    '1. Mixer is powered off or not on the network',
                    '   → Power on the mixer and ensure it is connected to the same network',
                    '',
                    '2. Incorrect IP address',
                    `   → Verify the IP address (currently trying: ${resolvedHost})`,
                    "   → Check mixer's network settings menu or use network scanning tools",
                    '',
                    '3. Firewall blocking UDP traffic',
                    `   → Ensure port ${resolvedPort} (UDP) is not blocked by your firewall`,
                    '   → Try temporarily disabling firewall to test connectivity',
                    '',
                    '4. Network routing issues',
                    '   → Ensure mixer and control computer are on the same subnet',
                    '   → Verify network cables are securely connected',
                    '',
                    'Next steps:',
                    "- Verify mixer IP address in mixer's network settings",
                    '- Ping the mixer to test basic network connectivity',
                    '- Check that no other application is using the OSC port',
                    `- Try the standard X32/M32 port (10023) or check mixer documentation`
                ].join('\n');

                return {
                    content: [
                        {
                            type: 'text',
                            text: troubleshootingSteps
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register connection_disconnect tool
 * Disconnects from mixer
 */
function registerConnectionDisconnectTool(server: McpServer, connection: X32Connection): void {
    server.registerTool(
        'connection_disconnect',
        {
            title: 'Disconnect from Mixer',
            description:
                'Disconnects from the currently connected digital mixing console. Use this tool to cleanly terminate the OSC connection when mixer control is no longer needed.',
            inputSchema: {},
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async (): Promise<CallToolResult> => {
            if (!connection.connected) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'Not connected to mixer'
                        }
                    ]
                };
            }

            try {
                await connection.disconnect();
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'Successfully disconnected from mixer'
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const troubleshootingSteps = [
                    `Disconnection from mixer failed: ${errorMessage}`,
                    '',
                    'What this means:',
                    '- The connection may already be closed or in an invalid state',
                    '- Network resources might not be releasing properly',
                    '',
                    'Recommended actions:',
                    '1. Check current connection status:',
                    '   → Use connection_get_status to verify connection state',
                    '',
                    '2. Force cleanup if needed:',
                    '   → The connection may be in a stuck state',
                    '   → Try restarting the MCP server if this persists',
                    '',
                    '3. Verify mixer status:',
                    '   → Ensure the mixer is still responsive',
                    '   → Check if the mixer is still on the network',
                    '',
                    'Note: Even if disconnection fails, you can attempt connection_connect',
                    'to establish a new connection. The connection state will be reset.'
                ].join('\n');

                return {
                    content: [
                        {
                            type: 'text',
                            text: troubleshootingSteps
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register connection_get_info tool
 * Retrieves console information from mixer
 */
function registerConnectionGetInfoTool(server: McpServer, connection: X32Connection): void {
    server.registerTool(
        'connection_get_info',
        {
            title: 'Get Console Information',
            description:
                'Retrieves detailed console information from connected digital mixing console. Returns model name, firmware version, server details, and other system information useful for identifying mixer capabilities and troubleshooting.',
            inputSchema: {},
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async (): Promise<CallToolResult> => {
            if (!connection.connected) {
                const notConnectedMessage = [
                    'Cannot retrieve console information: Not connected to mixer',
                    '',
                    'What you need to do:',
                    '1. First establish a connection using connection_connect',
                    '',
                    'Example usage:',
                    '  Tool: connection_connect',
                    '  Parameters:',
                    '    host: "192.168.1.100"  (your mixer\'s IP address)',
                    '    port: 10023             (standard OSC port)',
                    '    deviceType: "XR18"      (or X32, XR16, XR12)',
                    '',
                    "How to find your mixer's IP address:",
                    '- On the mixer: Setup → Network → IP Address',
                    '- Use a network scanning tool to discover devices',
                    "- Check your router's DHCP client list",
                    '',
                    'After connecting, you can use this tool to get console information.'
                ].join('\n');

                return {
                    content: [
                        {
                            type: 'text',
                            text: notConnectedMessage
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
                    `McpServer Name: ${info.serverName}`,
                    `McpServer Version: ${info.serverVersion}`
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
                const errorMessage = error instanceof Error ? error.message : String(error);
                const troubleshootingSteps = [
                    `Failed to retrieve console information: ${errorMessage}`,
                    '',
                    'What went wrong:',
                    '- The mixer did not respond to the information request',
                    '- Communication timeout or network interruption occurred',
                    '',
                    'Possible causes:',
                    '1. Connection was lost:',
                    '   → The mixer may have been powered off or disconnected from network',
                    '   → Network cable may have been unplugged',
                    '',
                    '2. Mixer is not responding:',
                    '   → The mixer may be busy or overloaded',
                    '   → Firmware issue preventing OSC responses',
                    '',
                    'How to fix:',
                    '1. Check connection status:',
                    '   → Use connection_get_status to verify connection state',
                    '',
                    '2. Reconnect if needed:',
                    '   → Use connection_disconnect followed by connection_connect',
                    '   → Verify the mixer is powered on and network is stable',
                    '',
                    '3. If problem persists:',
                    '   → Restart the mixer',
                    '   → Check mixer firmware version and update if needed',
                    '   → Verify no other applications are heavily using OSC communication'
                ].join('\n');

                return {
                    content: [
                        {
                            type: 'text',
                            text: troubleshootingSteps
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register connection_get_status tool
 * Retrieves current status from mixer
 */
function registerConnectionGetStatusTool(server: McpServer, connection: X32Connection): void {
    server.registerTool(
        'connection_get_status',
        {
            title: 'Get Connection Status',
            description:
                'Retrieves the current operational status of the connected digital mixing console. Returns connection state, network information, and server details to monitor mixer availability and network configuration.',
            inputSchema: {},
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async (): Promise<CallToolResult> => {
            if (!connection.connected) {
                const notConnectedMessage = [
                    'Cannot retrieve connection status: Not connected to mixer',
                    '',
                    'What you need to do:',
                    '1. First establish a connection using connection_connect',
                    '',
                    'Example usage:',
                    '  Tool: connection_connect',
                    '  Parameters:',
                    '    host: "192.168.1.100"  (your mixer\'s IP address)',
                    '    port: 10023             (standard OSC port)',
                    '    deviceType: "XR18"      (or X32, XR16, XR12)',
                    '',
                    "How to find your mixer's IP address:",
                    '- On the mixer: Setup → Network → IP Address',
                    '- Use a network scanning tool to discover devices',
                    "- Check your router's DHCP client list",
                    '',
                    'After connecting, you can use this tool to monitor connection status.'
                ].join('\n');

                return {
                    content: [
                        {
                            type: 'text',
                            text: notConnectedMessage
                        }
                    ],
                    isError: true
                };
            }

            try {
                const status = await connection.getStatus();
                const output = [`State: ${status.state}`, `IP Address: ${status.ipAddress}`, `McpServer Name: ${status.serverName}`].join(
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
                const errorMessage = error instanceof Error ? error.message : String(error);
                const troubleshootingSteps = [
                    `Failed to retrieve connection status: ${errorMessage}`,
                    '',
                    'What went wrong:',
                    '- The mixer did not respond to the status request',
                    '- Communication timeout or network interruption occurred',
                    '',
                    'Possible causes:',
                    '1. Connection was lost:',
                    '   → The mixer may have been powered off or disconnected from network',
                    '   → Network cable may have been unplugged',
                    '   → The mixer may have restarted',
                    '',
                    '2. Network issues:',
                    '   → Temporary network congestion or packet loss',
                    '   → Router or switch problems',
                    '   → WiFi interference (if using wireless connection)',
                    '',
                    'How to fix:',
                    '1. Verify basic connectivity:',
                    '   → Check if the mixer is powered on',
                    '   → Verify network cables are connected',
                    "   → Try pinging the mixer's IP address",
                    '',
                    '2. Reconnect if needed:',
                    '   → Use connection_disconnect followed by connection_connect',
                    "   → Verify the mixer IP address hasn't changed (check DHCP settings)",
                    '',
                    '3. If problem persists:',
                    '   → Restart the mixer',
                    '   → Restart network equipment (router, switch)',
                    '   → Use a wired connection instead of WiFi for reliability',
                    '   → Check for network configuration changes'
                ].join('\n');

                return {
                    content: [
                        {
                            type: 'text',
                            text: troubleshootingSteps
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register all connection domain tools
 */
export function registerConnectionTools(server: McpServer, connection: X32Connection): void {
    registerConnectionConnectTool(server, connection);
    registerConnectionDisconnectTool(server, connection);
    registerConnectionGetInfoTool(server, connection);
    registerConnectionGetStatusTool(server, connection);
}
