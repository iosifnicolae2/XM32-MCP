declare module 'osc' {
    export interface UDPPortInterface {
        open(): void;
        close(): void;
        send(message: OSCMessage, address?: string, port?: number): void;
        on(event: string, callback: (...args: unknown[]) => void): void;
    }

    export interface UDPPortOptions {
        localAddress?: string;
        localPort?: number;
        remoteAddress?: string;
        remotePort?: number;
        broadcast?: boolean;
        multicastTTL?: number;
        multicastMembership?: string[];
        metadata?: boolean;
    }

    export class UDPPort {
        constructor(options: UDPPortOptions);
        open(): void;
        close(): void;
        send(message: OSCMessage, address?: string, port?: number): void;
        on(event: string, callback: (...args: unknown[]) => void): void;
    }

    export interface OSCMessage {
        address: string;
        args?: Array<{
            type: string;
            value: unknown;
        }>;
    }

    const osc: {
        UDPPort: typeof UDPPort;
    };

    export default osc;
}
