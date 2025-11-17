import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { X32Connection } from '../services/x32-connection.js';
import { dbToFader, faderToDb, formatDb } from '../utils/db-converter.js';

/**
 * Main output domain tools
 * Semantic, task-based tools for main and monitor output control
 */

/**
 * Register main_set_volume tool
 * Set main stereo output volume
 */
function registerMainSetVolumeTool(server: McpServer, connection: X32Connection): void {
    server.registerTool(
        'main_set_volume',
        {
            title: 'Set Main Stereo Output Volume',
            description:
                'Set the main stereo output fader level on the X32/M32 mixer. Supports both linear values (0.0-1.0) and decibel values (-90 to +10 dB). Unity gain is 0 dB or 0.75 linear.',
            inputSchema: {
                value: z.number().describe('Volume value (interpretation depends on unit parameter)'),
                unit: z
                    .enum(['linear', 'db'])
                    .default('linear')
                    .describe('Unit of the value: "linear" (0.0-1.0) or "db" (-90 to +10 dB). Default is "linear".')
            },
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ value, unit = 'linear' }): Promise<CallToolResult> => {
            if (!connection.connected) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'Not connected to X32/M32 mixer. Use connection_connect first.'
                        }
                    ],
                    isError: true
                };
            }

            try {
                let faderValue: number;
                let dbValue: number;

                if (unit === 'db') {
                    // Input is in dB
                    if (value < -90 || value > 10) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Invalid dB value: ${value}. Must be between -90 and +10 dB.`
                                }
                            ],
                            isError: true
                        };
                    }
                    dbValue = value;
                    faderValue = dbToFader(value);
                } else {
                    // Input is linear
                    if (value < 0 || value > 1) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Invalid linear value: ${value}. Must be between 0.0 and 1.0.`
                                }
                            ],
                            isError: true
                        };
                    }
                    faderValue = value;
                    dbValue = faderToDb(value);
                }

                await connection.setParameter('/main/st/mix/fader', faderValue);

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Set main stereo output to ${formatDb(dbValue)} (linear: ${faderValue.toFixed(3)})`
                        }
                    ]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Failed to set main volume: ${error instanceof Error ? error.message : String(error)}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register main_mute tool
 * Mute or unmute main stereo output
 */
function registerMainMuteTool(server: McpServer, connection: X32Connection): void {
    server.registerTool(
        'main_mute',
        {
            title: 'Main Stereo Output Mute Control',
            description: 'Mute or unmute the main stereo output on the X32/M32 mixer. This controls the master output on/off state.',
            inputSchema: {
                muted: z.boolean().describe('True to mute the main output, false to unmute')
            },
            annotations: {
                readOnlyHint: false,
                destructiveHint: true, // Muting main output is potentially destructive
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ muted }): Promise<CallToolResult> => {
            if (!connection.connected) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'Not connected to X32/M32 mixer. Use connection_connect first.'
                        }
                    ],
                    isError: true
                };
            }

            try {
                // X32 uses inverted logic: 0 = muted, 1 = unmuted
                const onValue = muted ? 0 : 1;
                await connection.setParameter('/main/st/mix/on', onValue);

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Main stereo output ${muted ? 'muted' : 'unmuted'}`
                        }
                    ]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Failed to ${muted ? 'mute' : 'unmute'} main output: ${error instanceof Error ? error.message : String(error)}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register monitor_set_level tool
 * Set monitor output level
 */
function registerMonitorSetLevelTool(server: McpServer, connection: X32Connection): void {
    server.registerTool(
        'monitor_set_level',
        {
            title: 'Set Monitor Output Level',
            description:
                'Set the monitor output fader level on the X32/M32 mixer. Supports both linear values (0.0-1.0) and decibel values (-90 to +10 dB). Unity gain is 0 dB or 0.75 linear.',
            inputSchema: {
                value: z.number().describe('Volume value (interpretation depends on unit parameter)'),
                unit: z
                    .enum(['linear', 'db'])
                    .default('linear')
                    .describe('Unit of the value: "linear" (0.0-1.0) or "db" (-90 to +10 dB). Default is "linear".')
            },
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ value, unit = 'linear' }): Promise<CallToolResult> => {
            if (!connection.connected) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'Not connected to X32/M32 mixer. Use connection_connect first.'
                        }
                    ],
                    isError: true
                };
            }

            try {
                let faderValue: number;
                let dbValue: number;

                if (unit === 'db') {
                    // Input is in dB
                    if (value < -90 || value > 10) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Invalid dB value: ${value}. Must be between -90 and +10 dB.`
                                }
                            ],
                            isError: true
                        };
                    }
                    dbValue = value;
                    faderValue = dbToFader(value);
                } else {
                    // Input is linear
                    if (value < 0 || value > 1) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Invalid linear value: ${value}. Must be between 0.0 and 1.0.`
                                }
                            ],
                            isError: true
                        };
                    }
                    faderValue = value;
                    dbValue = faderToDb(value);
                }

                await connection.setParameter('/main/m/mix/fader', faderValue);

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Set monitor output to ${formatDb(dbValue)} (linear: ${faderValue.toFixed(3)})`
                        }
                    ]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Failed to set monitor level: ${error instanceof Error ? error.message : String(error)}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register all main/monitor domain tools
 */
export function registerMainTools(server: McpServer, connection: X32Connection): void {
    registerMainSetVolumeTool(server, connection);
    registerMainMuteTool(server, connection);
    registerMonitorSetLevelTool(server, connection);
}
