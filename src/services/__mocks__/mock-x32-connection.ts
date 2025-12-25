import { EventEmitter } from 'events';
import {
    X32ConnectionConfig,
    X32InfoResponse,
    X32StatusResponse,
    OscMessage,
    DeviceConfig,
    getDeviceConfig,
    X32_CONFIG
} from '../../types/index.js';
import { MixerConnectionConfig } from '../x32-connection.js';

/**
 * Mock X32 Connection for Testing
 * Simulates X32/M32/XR18 mixer responses without requiring actual hardware
 */
export class MockX32Connection extends EventEmitter {
    private isConnected: boolean = false;
    private config: MixerConnectionConfig | null = null;
    private parameterStore: Map<string, unknown> = new Map();
    private _deviceConfig: DeviceConfig = X32_CONFIG;
    private readonly DEFAULT_INFO: X32InfoResponse = {
        serverVersion: 'V2.05',
        serverName: 'X32 Emulator',
        consoleModel: 'X32',
        consoleVersion: '2.12'
    };
    private readonly DEFAULT_STATUS: X32StatusResponse = {
        state: 'active',
        ipAddress: '192.168.0.64',
        serverName: 'osc-server'
    };

    constructor() {
        super();
        this.initializeDefaultParameters();
    }

    /**
     * Get the current device configuration
     */
    get deviceConfig(): DeviceConfig {
        return this._deviceConfig;
    }

    /**
     * Get the main output address for this device
     */
    get mainAddress(): string {
        return this._deviceConfig.addresses.main;
    }

    /**
     * Initialize default parameter values
     */
    private initializeDefaultParameters(): void {
        // Initialize default channel parameters (32 channels)
        for (let ch = 1; ch <= 32; ch++) {
            const channelNum = ch.toString().padStart(2, '0');
            this.parameterStore.set(`/ch/${channelNum}/config/name`, `Ch ${ch}`);
            this.parameterStore.set(`/ch/${channelNum}/config/color`, 0);
            this.parameterStore.set(`/ch/${channelNum}/config/icon`, 0);
            this.parameterStore.set(`/ch/${channelNum}/mix/fader`, 0.75); // Unity gain
            this.parameterStore.set(`/ch/${channelNum}/mix/on`, 1); // Unmuted
            this.parameterStore.set(`/ch/${channelNum}/mix/pan`, 0.5); // Center
            this.parameterStore.set(`/-stat/solosw/${channelNum}`, 0); // Not soloed
        }

        // Initialize default bus parameters (16 buses)
        for (let bus = 1; bus <= 16; bus++) {
            const busNum = bus.toString().padStart(2, '0');
            this.parameterStore.set(`/bus/${busNum}/mix/fader`, 0.75);
            this.parameterStore.set(`/bus/${busNum}/mix/on`, 1);
            this.parameterStore.set(`/bus/${busNum}/mix/pan`, 0.5);
        }

        // Initialize main parameters
        this.parameterStore.set('/main/st/mix/fader', 0.75);
        this.parameterStore.set('/main/st/mix/on', 1);
        this.parameterStore.set('/main/st/mix/pan', 0.5);
    }

    /**
     * Mock connection to mixer
     */
    async connect(config: MixerConnectionConfig): Promise<void> {
        if (this.isConnected) {
            throw new Error('Already connected to mixer');
        }

        this.config = config;

        // Set device configuration based on type
        if (config.deviceType) {
            this._deviceConfig = getDeviceConfig(config.deviceType);
        }

        // Simulate async connection
        await new Promise(resolve => setTimeout(resolve, 10));

        this.isConnected = true;
        this.emit('connected');
    }

    /**
     * Mock disconnection from mixer
     */
    async disconnect(): Promise<void> {
        if (!this.isConnected) {
            return;
        }

        // Simulate async disconnection
        await new Promise(resolve => setTimeout(resolve, 10));

        this.isConnected = false;
        this.config = null;
        this.emit('disconnected');
    }

    /**
     * Mock send OSC message
     */
    async sendMessage(address: string, args: unknown[] = [], waitForReply: boolean = true): Promise<OscMessage | null> {
        if (!this.isConnected) {
            throw new Error('Not connected to mixer');
        }

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 5));

        if (waitForReply) {
            // If args are provided, this is a SET operation
            if (args.length > 0) {
                this.parameterStore.set(address, args[0]);
            }

            // Return stored value or default
            const value = this.parameterStore.get(address);

            // Create response message
            const response: OscMessage = {
                address,
                args: value !== undefined ? [{ type: this.inferOscType(value), value }] : []
            };

            return response;
        }

        return null;
    }

    /**
     * Infer OSC type from value
     */
    private inferOscType(value: unknown): string {
        if (typeof value === 'number') {
            return Number.isInteger(value) ? 'i' : 'f';
        } else if (typeof value === 'string') {
            return 's';
        } else if (Buffer.isBuffer(value)) {
            return 'b';
        }
        return 's';
    }

    /**
     * Mock get mixer info
     */
    async getInfo(): Promise<X32InfoResponse> {
        if (!this.isConnected) {
            throw new Error('Not connected to mixer');
        }

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 5));

        return { ...this.DEFAULT_INFO };
    }

    /**
     * Mock get mixer status
     */
    async getStatus(): Promise<X32StatusResponse> {
        if (!this.isConnected) {
            throw new Error('Not connected to mixer');
        }

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 5));

        return { ...this.DEFAULT_STATUS };
    }

    /**
     * Check if connected
     */
    get connected(): boolean {
        return this.isConnected;
    }

    /**
     * Get connection config
     */
    getConfig(): X32ConnectionConfig | null {
        return this.config;
    }

    /**
     * Mock get parameter value
     */
    async getParameter<T = unknown>(address: string): Promise<T> {
        const response = await this.sendMessage(address);
        if (!response || !response.args || response.args.length === 0) {
            throw new Error(`No value returned from ${address}`);
        }
        return response.args[0].value as T;
    }

    /**
     * Mock set parameter value
     */
    async setParameter(address: string, value: unknown): Promise<void> {
        await this.sendMessage(address, [value], false);
        // Also store the value so it can be retrieved
        this.parameterStore.set(address, value);
    }

    /**
     * Mock get channel parameter
     */
    async getChannelParameter<T = unknown>(channel: number, param: string): Promise<T> {
        const maxChannels = this._deviceConfig.channels;
        if (channel < 1 || channel > maxChannels) {
            throw new Error(`Channel must be between 1 and ${maxChannels}`);
        }
        const ch = channel.toString().padStart(2, '0');
        return this.getParameter<T>(`/ch/${ch}/${param}`);
    }

    /**
     * Mock set channel parameter
     */
    async setChannelParameter(channel: number, param: string, value: unknown): Promise<void> {
        const maxChannels = this._deviceConfig.channels;
        if (channel < 1 || channel > maxChannels) {
            throw new Error(`Channel must be between 1 and ${maxChannels}`);
        }
        const ch = channel.toString().padStart(2, '0');
        await this.setParameter(`/ch/${ch}/${param}`, value);
    }

    /**
     * Mock get bus parameter
     */
    async getBusParameter<T = unknown>(bus: number, param: string): Promise<T> {
        const maxBuses = this._deviceConfig.buses;
        if (bus < 1 || bus > maxBuses) {
            throw new Error(`Bus must be between 1 and ${maxBuses}`);
        }
        const busNum = bus.toString().padStart(2, '0');
        return this.getParameter<T>(`/bus/${busNum}/${param}`);
    }

    /**
     * Mock set bus parameter
     */
    async setBusParameter(bus: number, param: string, value: unknown): Promise<void> {
        const maxBuses = this._deviceConfig.buses;
        if (bus < 1 || bus > maxBuses) {
            throw new Error(`Bus must be between 1 and ${maxBuses}`);
        }
        const busNum = bus.toString().padStart(2, '0');
        await this.setParameter(`/bus/${busNum}/${param}`, value);
    }

    /**
     * Get main output parameter
     */
    async getMainParameter<T = unknown>(param: string): Promise<T> {
        const address = `${this.mainAddress}/${param}`;
        return this.getParameter<T>(address);
    }

    /**
     * Set main output parameter
     */
    async setMainParameter(param: string, value: unknown): Promise<void> {
        const address = `${this.mainAddress}/${param}`;
        await this.setParameter(address, value);
    }

    /**
     * Reset mock to initial state
     */
    reset(): void {
        this.isConnected = false;
        this.config = null;
        this.parameterStore.clear();
        this.initializeDefaultParameters();
    }

    /**
     * Set custom parameter value for testing
     */
    setMockParameter(address: string, value: unknown): void {
        this.parameterStore.set(address, value);
    }

    /**
     * Get all stored parameters (for debugging)
     */
    getMockParameters(): Map<string, unknown> {
        return new Map(this.parameterStore);
    }
}
