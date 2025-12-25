import { EventEmitter } from 'events';
import portAudio, { DeviceInfo, IoStreamRead, SampleFormat16Bit, SampleFormatFloat32 } from 'naudiodon';
import type { AudioDevice, AudioCaptureConfig, CapturedAudio, AudioCaptureStatus, AUDIO_DEFAULTS } from '../types/audio.js';

// Debug logging (controlled by DEBUG env var)
const DEBUG = process.env.DEBUG?.includes('audio') || process.env.DEBUG?.includes('capture') || process.env.DEBUG === '*';

const debugLog = (...args: unknown[]) => {
    if (DEBUG) {
        console.error('[AudioCapture]', ...args);
    }
};

/**
 * Default audio configuration
 */
const DEFAULTS: typeof AUDIO_DEFAULTS = {
    sampleRate: 44100,
    channels: 2,
    bitDepth: 16,
    fftSize: 2048,
    hopSize: 512,
    numMelBands: 128,
    instantDurationMs: 500,
    intervalDurationMs: 5000,
    maxDurationMs: 30000,
    minDurationMs: 100,
    outputWidth: 800,
    outputHeight: 400
};

/**
 * AudioCaptureService
 * Manages audio device enumeration and capture via PortAudio (naudiodon)
 */
export class AudioCaptureService extends EventEmitter {
    private audioInput: IoStreamRead | null = null;
    private isCapturing: boolean = false;
    private config: AudioCaptureConfig | null = null;
    private buffers: Buffer[] = [];
    private captureStartTime: number = 0;
    private currentDevice: AudioDevice | null = null;

    constructor() {
        super();
    }

    /**
     * List all available audio input devices
     * Includes loopback detection for system audio capture
     */
    listDevices(includeLoopback: boolean = true): AudioDevice[] {
        const devices = portAudio.getDevices();
        debugLog(`Found ${devices.length} audio devices`);

        const audioDevices: AudioDevice[] = devices
            .filter(device => device.maxInputChannels > 0 || includeLoopback)
            .map(device => this.convertToAudioDevice(device));

        debugLog(`Returning ${audioDevices.length} devices (loopback filter: ${includeLoopback})`);
        return audioDevices;
    }

    /**
     * Convert PortAudio DeviceInfo to our AudioDevice type
     */
    private convertToAudioDevice(device: DeviceInfo): AudioDevice {
        return {
            id: device.id,
            name: device.name,
            hostApi: device.hostAPIName,
            maxInputChannels: device.maxInputChannels,
            maxOutputChannels: device.maxOutputChannels,
            defaultSampleRate: device.defaultSampleRate,
            defaultLowInputLatency: device.defaultLowInputLatency,
            defaultHighInputLatency: device.defaultHighInputLatency,
            defaultLowOutputLatency: device.defaultLowOutputLatency,
            defaultHighOutputLatency: device.defaultHighOutputLatency,
            isLoopback: this.detectLoopback(device)
        };
    }

    /**
     * Detect if a device is a loopback/monitor device
     * Platform-specific detection patterns
     */
    private detectLoopback(device: DeviceInfo): boolean {
        const name = device.name.toLowerCase();
        const hostApi = device.hostAPIName.toLowerCase();

        // Windows WASAPI loopback devices
        if (name.includes('[loopback]')) return true;
        if (hostApi === 'wasapi' && name.includes('output')) return true;

        // macOS virtual audio devices
        if (name.includes('blackhole')) return true;
        if (name.includes('soundflower')) return true;
        if (name.includes('loopback')) return true;

        // Linux PulseAudio/PipeWire monitors
        if (name.includes('monitor of')) return true;
        if (name.includes('monitor')) return true;

        // Sonobus loopback
        if (name.includes('sonobus')) return true;

        return false;
    }

    /**
     * Find a device by ID or name
     */
    findDevice(deviceIdOrName: number | string): AudioDevice | null {
        const devices = this.listDevices(true);

        if (typeof deviceIdOrName === 'number') {
            return devices.find(d => d.id === deviceIdOrName) || null;
        }

        // Search by name (case-insensitive partial match)
        const searchName = deviceIdOrName.toLowerCase();
        return devices.find(d => d.name.toLowerCase().includes(searchName)) || null;
    }

    /**
     * Get default loopback device for the current platform
     */
    getDefaultLoopbackDevice(): AudioDevice | null {
        const devices = this.listDevices(true);
        const loopbackDevices = devices.filter(d => d.isLoopback);

        if (loopbackDevices.length === 0) {
            debugLog('No loopback devices found');
            return null;
        }

        debugLog(`Found ${loopbackDevices.length} loopback devices, selecting first: ${loopbackDevices[0].name}`);
        return loopbackDevices[0];
    }

    /**
     * Start audio capture from a device
     */
    async startCapture(config?: Partial<AudioCaptureConfig>): Promise<void> {
        if (this.isCapturing) {
            throw new Error('Already capturing audio');
        }

        // Merge with defaults
        this.config = {
            sampleRate: config?.sampleRate ?? DEFAULTS.sampleRate,
            channels: config?.channels ?? DEFAULTS.channels,
            bitDepth: config?.bitDepth ?? DEFAULTS.bitDepth,
            deviceId: config?.deviceId
        };

        // Find device
        let device: AudioDevice | null = null;
        if (this.config.deviceId !== undefined) {
            device = this.findDevice(this.config.deviceId);
            if (!device) {
                throw new Error(`Device not found: ${this.config.deviceId}`);
            }
        } else {
            // Try to get default loopback, fall back to default input
            device = this.getDefaultLoopbackDevice();
            if (!device) {
                const devices = this.listDevices(true);
                device = devices.find(d => d.maxInputChannels > 0) || null;
            }
        }

        if (!device) {
            throw new Error('No audio input device available');
        }

        this.currentDevice = device;
        debugLog(`Starting capture on device: ${device.name} (ID: ${device.id})`);

        // Determine sample format based on bit depth
        const sampleFormat = this.config.bitDepth === 32 ? SampleFormatFloat32 : SampleFormat16Bit;

        try {
            this.audioInput = portAudio.AudioIO({
                inOptions: {
                    deviceId: device.id,
                    sampleRate: this.config.sampleRate,
                    channelCount: this.config.channels,
                    sampleFormat,
                    framesPerBuffer: 1024,
                    closeOnError: true
                }
            });

            this.buffers = [];
            this.captureStartTime = Date.now();

            // Collect audio data
            this.audioInput.on('data', (data: Buffer) => {
                this.buffers.push(data);
                this.emit('data', data);
            });

            this.audioInput.on('error', (err: Error) => {
                debugLog('Capture error:', err.message);
                this.emit('error', err);
            });

            this.audioInput.start();
            this.isCapturing = true;
            this.emit('started', device);
            debugLog('Capture started');
        } catch (error) {
            debugLog('Failed to start capture:', error);
            throw new Error(`Failed to start audio capture: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Stop audio capture and return captured audio data
     */
    async stopCapture(): Promise<CapturedAudio> {
        if (!this.isCapturing || !this.audioInput) {
            throw new Error('Not currently capturing audio');
        }

        return new Promise((resolve, reject) => {
            const durationMs = Date.now() - this.captureStartTime;

            this.audioInput!.quit(() => {
                debugLog(`Capture stopped after ${durationMs}ms`);

                try {
                    const capturedAudio = this.processBuffers(durationMs);
                    this.cleanup();
                    this.emit('stopped', capturedAudio);
                    resolve(capturedAudio);
                } catch (error) {
                    this.cleanup();
                    reject(error);
                }
            });
        });
    }

    /**
     * Capture audio for a specific duration and return the result
     */
    async captureForDuration(durationMs: number, config?: Partial<AudioCaptureConfig>): Promise<CapturedAudio> {
        await this.startCapture(config);

        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                try {
                    const audio = await this.stopCapture();
                    resolve(audio);
                } catch (error) {
                    reject(error);
                }
            }, durationMs);
        });
    }

    /**
     * Process collected buffers into CapturedAudio
     */
    private processBuffers(durationMs: number): CapturedAudio {
        if (!this.config || !this.currentDevice) {
            throw new Error('No capture configuration available');
        }

        // Concatenate all buffers
        const totalLength = this.buffers.reduce((sum, buf) => sum + buf.length, 0);
        const combinedBuffer = Buffer.concat(this.buffers, totalLength);

        // Convert to Float32Array based on bit depth
        let samples: Float32Array;

        if (this.config.bitDepth === 16) {
            const numSamples = combinedBuffer.length / 2;
            samples = new Float32Array(numSamples);
            for (let i = 0; i < numSamples; i++) {
                const int16 = combinedBuffer.readInt16LE(i * 2);
                samples[i] = int16 / 32768.0;
            }
        } else if (this.config.bitDepth === 32) {
            const numSamples = combinedBuffer.length / 4;
            samples = new Float32Array(numSamples);
            for (let i = 0; i < numSamples; i++) {
                samples[i] = combinedBuffer.readFloatLE(i * 4);
            }
        } else {
            throw new Error(`Unsupported bit depth: ${this.config.bitDepth}`);
        }

        debugLog(`Processed ${samples.length} samples from ${this.buffers.length} buffers`);

        return {
            samples,
            sampleRate: this.config.sampleRate,
            channels: this.config.channels,
            durationMs,
            deviceName: this.currentDevice.name,
            capturedAt: new Date().toISOString()
        };
    }

    /**
     * Cleanup internal state
     */
    private cleanup(): void {
        this.audioInput = null;
        this.isCapturing = false;
        this.buffers = [];
        this.captureStartTime = 0;
    }

    /**
     * Abort capture without returning data
     */
    async abortCapture(): Promise<void> {
        if (!this.isCapturing || !this.audioInput) {
            return;
        }

        return new Promise(resolve => {
            this.audioInput!.abort(() => {
                debugLog('Capture aborted');
                this.cleanup();
                this.emit('aborted');
                resolve();
            });
        });
    }

    /**
     * Get current capture status
     */
    getStatus(): AudioCaptureStatus {
        const capturedDurationMs = this.isCapturing ? Date.now() - this.captureStartTime : undefined;
        const bufferSize = this.buffers.reduce((sum, buf) => sum + buf.length, 0);

        return {
            isCapturing: this.isCapturing,
            deviceId: this.currentDevice?.id,
            deviceName: this.currentDevice?.name,
            sampleRate: this.config?.sampleRate,
            channels: this.config?.channels,
            capturedDurationMs,
            bufferSize
        };
    }

    /**
     * Check if currently capturing
     */
    get capturing(): boolean {
        return this.isCapturing;
    }

    /**
     * Get current device
     */
    get device(): AudioDevice | null {
        return this.currentDevice;
    }
}

// Export singleton instance for shared state
export const audioCaptureService = new AudioCaptureService();
