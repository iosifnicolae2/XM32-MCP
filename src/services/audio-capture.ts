import { EventEmitter } from 'events';
import { FFmpegDriver } from './audio-drivers/ffmpeg-driver.js';
import type { AudioDriver } from './audio-drivers/types.js';
import type {
    AudioDevice,
    AudioCaptureConfig,
    CapturedAudio,
    AudioCaptureStatus,
    AUDIO_DEFAULTS,
    AudioRecordConfig,
    AudioRecordResult
} from '../types/audio.js';
import { AudioFileService } from './audio-file.js';

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
    outputHeight: 400,
    maxRecordingSeconds: 300
};

/**
 * AudioCaptureService
 * Manages audio device enumeration and capture via FFmpeg
 */
export class AudioCaptureService extends EventEmitter {
    private driver: AudioDriver;
    private isCapturing: boolean = false;
    private config: AudioCaptureConfig | null = null;
    private captureStartTime: number = 0;
    private currentDevice: AudioDevice | null = null;
    private cachedDevices: AudioDevice[] | null = null;
    private deviceCacheTime: number = 0;
    private readonly DEVICE_CACHE_TTL = 5000; // 5 seconds cache

    constructor(driver?: AudioDriver) {
        super();
        this.driver = driver ?? new FFmpegDriver();

        // Forward events from driver
        if (this.driver instanceof EventEmitter) {
            this.driver.on('data', data => this.emit('data', data));
            this.driver.on('error', err => this.emit('error', err));
        }
    }

    /**
     * Check if FFmpeg is available
     */
    async isDriverAvailable(): Promise<boolean> {
        return this.driver.isAvailable();
    }

    /**
     * List all available audio input devices
     * Includes loopback detection for system audio capture
     */
    async listDevices(includeLoopback: boolean = true): Promise<AudioDevice[]> {
        // Check cache
        const now = Date.now();
        if (this.cachedDevices && now - this.deviceCacheTime < this.DEVICE_CACHE_TTL) {
            debugLog('Using cached device list');
            const devices = this.cachedDevices;
            return includeLoopback ? devices : devices.filter(d => !d.isLoopback);
        }

        debugLog('Fetching device list from driver');
        const devices = await this.driver.listDevices();

        // Update cache
        this.cachedDevices = devices;
        this.deviceCacheTime = now;

        debugLog(`Found ${devices.length} audio devices`);
        const filtered = includeLoopback ? devices : devices.filter(d => !d.isLoopback);
        debugLog(`Returning ${filtered.length} devices (loopback filter: ${includeLoopback})`);

        return filtered;
    }

    /**
     * Find a device by ID or name
     */
    async findDevice(deviceIdOrName: number | string): Promise<AudioDevice | null> {
        const devices = await this.listDevices(true);

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
    async getDefaultLoopbackDevice(): Promise<AudioDevice | null> {
        const devices = await this.listDevices(true);
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

        // Check driver availability
        const available = await this.driver.isAvailable();
        if (!available) {
            throw new Error(
                'FFmpeg is not available. Please install FFmpeg:\n' +
                    '  macOS: brew install ffmpeg\n' +
                    '  Windows: choco install ffmpeg\n' +
                    '  Linux: apt install ffmpeg'
            );
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
            device = await this.findDevice(this.config.deviceId);
            if (!device) {
                throw new Error(`Device not found: ${this.config.deviceId}`);
            }
        } else {
            // Try to get default loopback, fall back to default input
            device = await this.getDefaultLoopbackDevice();
            if (!device) {
                const devices = await this.listDevices(true);
                device = devices.find(d => d.maxInputChannels > 0) || null;
            }
        }

        if (!device) {
            throw new Error('No audio input device available');
        }

        this.currentDevice = device;
        this.captureStartTime = Date.now();
        debugLog(`Starting capture on device: ${device.name} (ID: ${device.id})`);

        try {
            await this.driver.startCapture(this.config, device.id);
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
        if (!this.isCapturing) {
            throw new Error('Not currently capturing audio');
        }

        debugLog('Stopping capture...');
        const audio = await this.driver.stopCapture();
        this.isCapturing = false;
        this.emit('stopped', audio);
        debugLog(`Capture stopped after ${audio.durationMs}ms`);

        return audio;
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
     * Record audio for a specific duration and save to WAV file
     * Uses direct FFmpeg file output for highest quality (no Node.js pipe overhead)
     */
    async recordToFile(config: AudioRecordConfig, fileService?: AudioFileService): Promise<AudioRecordResult> {
        const { deviceId, durationSeconds, outputPath, sampleRate = DEFAULTS.sampleRate, channels = DEFAULTS.channels } = config;

        if (durationSeconds <= 0 || durationSeconds > DEFAULTS.maxRecordingSeconds) {
            throw new Error(`Duration must be between 0 and ${DEFAULTS.maxRecordingSeconds} seconds`);
        }

        // Check driver availability
        const available = await this.driver.isAvailable();
        if (!available) {
            throw new Error(
                'FFmpeg is not available. Please install FFmpeg:\n' +
                    '  macOS: brew install ffmpeg\n' +
                    '  Windows: choco install ffmpeg\n' +
                    '  Linux: apt install ffmpeg'
            );
        }

        debugLog(`Recording ${durationSeconds}s to file (direct mode)...`);

        const fs = fileService ?? new AudioFileService();
        fs.ensureRecordingsDir();

        const filePath = outputPath ? fs.resolveFilePath(outputPath) : fs.generateRecordingPath();

        // Resolve device
        let resolvedDeviceId: number | undefined;
        if (deviceId !== undefined) {
            const device = await this.findDevice(deviceId);
            if (!device) {
                throw new Error(`Device not found: ${deviceId}`);
            }
            resolvedDeviceId = device.id;
        } else {
            // Try to get default loopback, fall back to first input device
            const loopback = await this.getDefaultLoopbackDevice();
            if (loopback) {
                resolvedDeviceId = loopback.id;
            } else {
                const devices = await this.listDevices(true);
                const inputDevice = devices.find(d => d.maxInputChannels > 0);
                resolvedDeviceId = inputDevice?.id;
            }
        }

        // Use direct file recording if driver supports it (bypasses Node.js pipe)
        if (this.driver.recordToFile) {
            const result = await this.driver.recordToFile(
                filePath,
                durationSeconds,
                { sampleRate, channels, bitDepth: 16 },
                resolvedDeviceId
            );

            const stats = await import('fs').then(fsModule => fsModule.statSync(filePath));

            debugLog(`Recording saved: ${filePath} (${stats.size} bytes)`);

            return {
                filePath: result.filePath,
                durationMs: result.durationSeconds * 1000,
                sampleRate: result.sampleRate,
                channels: result.channels,
                deviceName: result.deviceName,
                recordedAt: new Date().toISOString(),
                fileSize: stats.size
            };
        }

        // Fallback to pipe-based capture for drivers that don't support direct recording
        debugLog('Direct recording not supported, falling back to pipe-based capture');

        const captureConfig: Partial<AudioCaptureConfig> = {
            deviceId: resolvedDeviceId,
            sampleRate,
            channels,
            bitDepth: 16
        };

        const audio = await this.captureForDuration(durationSeconds * 1000, captureConfig);

        await fs.writeWavFile(filePath, audio);

        const stats = await import('fs').then(fsModule => fsModule.statSync(filePath));

        debugLog(`Recording saved: ${filePath} (${stats.size} bytes)`);

        return {
            filePath,
            durationMs: audio.durationMs,
            sampleRate: audio.sampleRate,
            channels: audio.channels,
            deviceName: audio.deviceName,
            recordedAt: audio.capturedAt,
            fileSize: stats.size
        };
    }

    /**
     * Abort capture without returning data
     */
    async abortCapture(): Promise<void> {
        if (!this.isCapturing) {
            return;
        }

        debugLog('Aborting capture...');
        await this.driver.abortCapture();
        this.isCapturing = false;
        this.emit('aborted');
        debugLog('Capture aborted');
    }

    /**
     * Get current capture status
     */
    getStatus(): AudioCaptureStatus {
        const capturedDurationMs = this.isCapturing ? Date.now() - this.captureStartTime : undefined;

        return {
            isCapturing: this.isCapturing,
            deviceId: this.currentDevice?.id,
            deviceName: this.currentDevice?.name,
            sampleRate: this.config?.sampleRate,
            channels: this.config?.channels,
            capturedDurationMs,
            bufferSize: undefined // Not easily available with FFmpeg
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

    /**
     * Clear device cache to force refresh
     */
    clearDeviceCache(): void {
        this.cachedDevices = null;
        this.deviceCacheTime = 0;
    }
}

// Export singleton instance for shared state
export const audioCaptureService = new AudioCaptureService();
