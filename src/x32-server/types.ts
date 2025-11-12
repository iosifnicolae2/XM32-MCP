/**
 * X32/M32 Connection Configuration
 */
export interface X32ConnectionConfig {
    host: string;
    port: number;
}

/**
 * X32/M32 Info Response
 * Response from /info command
 * Format: /info~~~,ssss~~~V2.05~~~osc-server~~X32~2.12~~~~
 */
export interface X32InfoResponse {
    serverVersion: string;
    serverName: string;
    consoleModel: string;
    consoleVersion: string;
}

/**
 * X32/M32 Status Response
 * Response from /status command
 * Format: /status~,sss~~~~active~~192.168.0.64~~~~osc-server~~
 */
export interface X32StatusResponse {
    state: string;
    ipAddress: string;
    serverName: string;
}

/**
 * OSC Message structure
 */
export interface OscMessage {
    address: string;
    args: OscArgument[];
}

export interface OscArgument {
    type: string;
    value: any;
}

