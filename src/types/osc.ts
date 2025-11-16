/**
 * Type definitions for 'osc' package
 * Since the osc package doesn't provide TypeScript definitions
 */

export interface UDPPortOptions {
    localAddress?: string;
    localPort?: number;
    remoteAddress?: string;
    remotePort?: number;
    broadcast?: boolean;
    multicastTTL?: number;
    multicastMembership?: string[];
    socket?: unknown;
}

export interface UDPPort {
    open(): void;
    close(): void;
    send(packet: OSCMessage, address?: string, port?: number): void;
    on(event: 'ready', listener: () => void): this;
    on(event: 'message', listener: (oscMessage: OSCMessage, timeTag?: unknown, info?: unknown) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;
    options: UDPPortOptions;
}

export interface OSCMessage {
    address: string;
    args?: Array<{
        type: 'i' | 'f' | 's' | 'b' | 'h' | 't' | 'd' | 'S' | 'c' | 'r' | 'm' | 'T' | 'F' | 'N' | 'I';
        value: unknown;
    }>;
}

// OSC module interface
export interface OSCModule {
    UDPPort: new (options?: UDPPortOptions) => UDPPort;
}
