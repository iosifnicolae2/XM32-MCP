declare module 'osc' {
    export interface UDPPort {
        open(): void;
        close(): void;
        send(message: any, address?: string, port?: number): void;
        on(event: string, callback: (...args: any[]) => void): void;
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
        send(message: any, address?: string, port?: number): void;
        on(event: string, callback: (...args: any[]) => void): void;
    }

    const osc: {
        UDPPort: typeof UDPPort;
    };

    export default osc;
}