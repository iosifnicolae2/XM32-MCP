import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import type { AudioDriver, RawDeviceInfo } from './types.js';
import { getPlatformAudioFormat } from './types.js';
import type { AudioDevice, AudioCaptureConfig, CapturedAudio } from '../../types/audio.js';

const execAsync = promisify(exec);

// Debug logging
const DEBUG = process.env.DEBUG?.includes('audio') || process.env.DEBUG?.includes('ffmpeg') || process.env.DEBUG === '*';
const debugLog = (...args: unknown[]) => {
    if (DEBUG) {
        console.error('[FFmpegDriver]', ...args);
    }
};

/**
 * FFmpeg-based audio driver
 * Uses FFmpeg child_process for device listing and audio capture
 */
export class FFmpegDriver extends EventEmitter implements AudioDriver {
    readonly name = 'ffmpeg';

    private process: ChildProcess | null = null;
    private chunks: Buffer[] = [];
    private captureStartTime = 0;
    private currentConfig: AudioCaptureConfig | null = null;
    private currentDeviceName = '';
    private capturing = false;

    /**
     * Check if FFmpeg is available on the system
     */
    async isAvailable(): Promise<boolean> {
        try {
            await execAsync('ffmpeg -version');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * List all available audio input devices
     */
    async listDevices(): Promise<AudioDevice[]> {
        const format = getPlatformAudioFormat();
        debugLog(`Listing devices using format: ${format}`);

        try {
            const rawDevices = await this.listDevicesForPlatform(format);
            return rawDevices.map((raw, idx) => this.convertToAudioDevice(raw, idx));
        } catch (error) {
            debugLog('Failed to list devices:', error);
            throw new Error(`Failed to list audio devices: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * List devices based on platform
     */
    private async listDevicesForPlatform(format: string): Promise<RawDeviceInfo[]> {
        switch (format) {
            case 'avfoundation':
                return this.listMacOSDevices();
            case 'dshow':
                return this.listWindowsDevices();
            case 'pulse':
            case 'alsa':
                return this.listLinuxDevices();
            default:
                throw new Error(`Unsupported audio format: ${format}`);
        }
    }

    /**
     * List macOS audio devices using avfoundation
     */
    private async listMacOSDevices(): Promise<RawDeviceInfo[]> {
        try {
            // FFmpeg outputs device list to stderr, redirect to stdout with 2>&1
            // Use || true to prevent error on non-zero exit (FFmpeg exits with error when listing)
            const { stdout } = await execAsync('ffmpeg -f avfoundation -list_devices true -i "" 2>&1 || true');
            return this.parseAVFoundationOutput(stdout);
        } catch (error) {
            // Fallback: check both stdout and stderr
            const err = error as { stdout?: string; stderr?: string };
            const output = err.stdout || err.stderr || '';
            if (output) {
                return this.parseAVFoundationOutput(output);
            }
            throw error;
        }
    }

    /**
     * Parse AVFoundation device list output
     * Example output:
     * [AVFoundation indev @ 0x...] AVFoundation audio devices:
     * [AVFoundation indev @ 0x...] [0] BlackHole 2ch
     * [AVFoundation indev @ 0x...] [1] MacBook Pro Microphone
     */
    private parseAVFoundationOutput(output: string): RawDeviceInfo[] {
        const devices: RawDeviceInfo[] = [];
        const lines = output.split('\n');

        let inAudioSection = false;

        for (const line of lines) {
            // Check for audio devices section
            if (line.includes('AVFoundation audio devices:')) {
                inAudioSection = true;
                continue;
            }

            // Check for video devices section (exit audio section)
            if (line.includes('AVFoundation video devices:')) {
                inAudioSection = false;
                continue;
            }

            // Parse device entries in audio section
            // Format: [AVFoundation indev @ 0x...] [0] Device Name
            if (inAudioSection) {
                // Match pattern: [0] Device Name (after any prefix)
                const match = line.match(/\[(\d+)\]\s+(.+?)$/);
                if (match) {
                    const name = match[2].trim();
                    // Skip if this is just a section header or error message
                    if (name && !name.includes('Error') && !name.includes('indev')) {
                        devices.push({
                            index: parseInt(match[1], 10),
                            name,
                            type: 'audio'
                        });
                    }
                }
            }
        }

        debugLog(`Parsed ${devices.length} macOS audio devices`);
        return devices;
    }

    /**
     * List Windows audio devices using dshow
     */
    private async listWindowsDevices(): Promise<RawDeviceInfo[]> {
        try {
            const { stderr } = await execAsync('ffmpeg -f dshow -list_devices true -i dummy 2>&1 || true');
            return this.parseDShowOutput(stderr);
        } catch (error) {
            const err = error as { stderr?: string };
            if (err.stderr) {
                return this.parseDShowOutput(err.stderr);
            }
            throw error;
        }
    }

    /**
     * Parse DirectShow device list output
     */
    private parseDShowOutput(output: string): RawDeviceInfo[] {
        const devices: RawDeviceInfo[] = [];
        const lines = output.split('\n');

        let inAudioSection = false;
        let index = 0;

        for (const line of lines) {
            if (line.includes('DirectShow audio devices')) {
                inAudioSection = true;
                continue;
            }
            if (line.includes('DirectShow video devices')) {
                inAudioSection = false;
                continue;
            }

            if (inAudioSection) {
                // Match pattern: "Device Name" or [dshow @ ...] "Device Name"
                const match = line.match(/"(.+?)"/);
                if (match) {
                    devices.push({
                        index: index++,
                        name: match[1],
                        type: 'audio'
                    });
                }
            }
        }

        debugLog(`Parsed ${devices.length} Windows audio devices`);
        return devices;
    }

    /**
     * List Linux audio devices using PulseAudio/ALSA
     */
    private async listLinuxDevices(): Promise<RawDeviceInfo[]> {
        const devices: RawDeviceInfo[] = [];

        // Try PulseAudio first
        try {
            const { stdout } = await execAsync('pactl list sources short');
            const lines = stdout.split('\n').filter(l => l.trim());

            lines.forEach((line, index) => {
                const parts = line.split('\t');
                if (parts.length >= 2) {
                    devices.push({
                        index,
                        name: parts[1],
                        type: 'audio'
                    });
                }
            });
        } catch {
            // Try ALSA as fallback
            try {
                const { stdout } = await execAsync('arecord -l');
                const lines = stdout.split('\n');

                let index = 0;
                for (const line of lines) {
                    const match = line.match(/card (\d+): (.+?) \[(.+?)\]/);
                    if (match) {
                        devices.push({
                            index: index++,
                            name: `${match[2]} - ${match[3]}`,
                            type: 'audio'
                        });
                    }
                }
            } catch {
                debugLog('Neither PulseAudio nor ALSA device listing available');
            }
        }

        debugLog(`Parsed ${devices.length} Linux audio devices`);
        return devices;
    }

    /**
     * Convert raw device info to AudioDevice type
     */
    private convertToAudioDevice(raw: RawDeviceInfo, fallbackId: number): AudioDevice {
        return {
            id: raw.index >= 0 ? raw.index : fallbackId,
            name: raw.name,
            hostApi: this.getHostApiName(),
            maxInputChannels: 2, // Assume stereo, FFmpeg doesn't expose this
            maxOutputChannels: 0,
            defaultSampleRate: 44100,
            defaultLowInputLatency: 0.01,
            defaultHighInputLatency: 0.1,
            defaultLowOutputLatency: 0,
            defaultHighOutputLatency: 0,
            isLoopback: this.detectLoopback(raw.name)
        };
    }

    /**
     * Get host API name based on platform
     */
    private getHostApiName(): string {
        switch (process.platform) {
            case 'darwin':
                return 'Core Audio';
            case 'win32':
                return 'DirectShow';
            case 'linux':
                return 'PulseAudio';
            default:
                return 'Unknown';
        }
    }

    /**
     * Detect if a device is a loopback/monitor device
     */
    private detectLoopback(name: string): boolean {
        const lowerName = name.toLowerCase();

        const loopbackPatterns = [
            // macOS
            'blackhole',
            'soundflower',
            'loopback',
            'existential audio',
            'aggregate device',
            'multi-output',
            // Windows
            'stereo mix',
            'what u hear',
            'wave out mix',
            'virtual audio cable',
            'vb-cable',
            // Linux
            'monitor of',
            '.monitor'
        ];

        return loopbackPatterns.some(pattern => lowerName.includes(pattern));
    }

    /**
     * Start audio capture from a device
     */
    async startCapture(config: AudioCaptureConfig, deviceId?: number): Promise<void> {
        if (this.capturing) {
            throw new Error('Already capturing audio');
        }

        const format = getPlatformAudioFormat();
        const inputDevice = this.buildInputDevice(format, deviceId);

        this.currentConfig = config;
        this.chunks = [];
        this.captureStartTime = Date.now();

        // Build FFmpeg command
        const args = [
            '-hide_banner',
            '-loglevel',
            'error',
            '-f',
            format,
            '-i',
            inputDevice,
            '-ar',
            String(config.sampleRate),
            '-ac',
            String(config.channels),
            '-f',
            's16le', // 16-bit signed little-endian PCM
            'pipe:1' // Output to stdout
        ];

        debugLog('Starting FFmpeg capture:', 'ffmpeg', args.join(' '));

        this.process = spawn('ffmpeg', args);

        this.process.stdout?.on('data', (chunk: Buffer) => {
            this.chunks.push(chunk);
            this.emit('data', chunk);
        });

        this.process.stderr?.on('data', (data: Buffer) => {
            const message = data.toString();
            if (message.trim()) {
                debugLog('FFmpeg stderr:', message);
            }
        });

        this.process.on('error', (err: Error) => {
            debugLog('FFmpeg process error:', err.message);
            this.emit('error', err);
        });

        this.process.on('close', (code: number) => {
            debugLog(`FFmpeg process closed with code ${code}`);
        });

        // Get device name for the captured audio metadata
        const devices = await this.listDevices();
        const device = deviceId !== undefined ? devices.find(d => d.id === deviceId) : devices[0];
        this.currentDeviceName = device?.name ?? 'Unknown Device';

        this.capturing = true;
        this.emit('started', { deviceId, deviceName: this.currentDeviceName });
    }

    /**
     * Build the input device string based on platform
     */
    private buildInputDevice(format: string, deviceId?: number): string {
        switch (format) {
            case 'avfoundation':
                // On macOS, use :deviceId for audio-only (: prefix means audio)
                return deviceId !== undefined ? `:${deviceId}` : ':0';
            case 'dshow':
                // On Windows, need to specify device name
                // TODO: Get device name from deviceId
                return 'audio="Microphone"';
            case 'pulse':
                // On Linux with PulseAudio
                return deviceId !== undefined ? `${deviceId}` : 'default';
            case 'alsa':
                return deviceId !== undefined ? `hw:${deviceId}` : 'default';
            default:
                return 'default';
        }
    }

    /**
     * Stop capture and return the captured audio data
     */
    async stopCapture(): Promise<CapturedAudio> {
        if (!this.capturing || !this.process) {
            throw new Error('Not currently capturing audio');
        }

        return new Promise((resolve, reject) => {
            const durationMs = Date.now() - this.captureStartTime;

            const handleClose = () => {
                try {
                    const audio = this.processBuffers(durationMs);
                    this.cleanup();
                    this.emit('stopped', audio);
                    resolve(audio);
                } catch (error) {
                    this.cleanup();
                    reject(error);
                }
            };

            // Handle case where process already exited
            if (this.process?.exitCode !== null) {
                handleClose();
                return;
            }

            this.process?.once('close', handleClose);

            // Send SIGTERM to stop FFmpeg gracefully
            this.process?.kill('SIGTERM');

            // Timeout fallback
            setTimeout(() => {
                if (this.capturing) {
                    this.process?.kill('SIGKILL');
                }
            }, 2000);
        });
    }

    /**
     * Abort capture without returning data
     */
    async abortCapture(): Promise<void> {
        if (!this.capturing || !this.process) {
            return;
        }

        return new Promise(resolve => {
            this.process?.once('close', () => {
                this.cleanup();
                this.emit('aborted');
                resolve();
            });

            this.process?.kill('SIGKILL');

            // Timeout fallback
            setTimeout(() => {
                this.cleanup();
                resolve();
            }, 1000);
        });
    }

    /**
     * Check if currently capturing
     */
    isCapturing(): boolean {
        return this.capturing;
    }

    /**
     * Process collected buffers into CapturedAudio
     */
    private processBuffers(durationMs: number): CapturedAudio {
        if (!this.currentConfig) {
            throw new Error('No capture configuration available');
        }

        // Concatenate all buffers
        const totalLength = this.chunks.reduce((sum, buf) => sum + buf.length, 0);
        const combinedBuffer = Buffer.concat(this.chunks, totalLength);

        // Convert 16-bit PCM to Float32Array
        const numSamples = combinedBuffer.length / 2;
        const samples = new Float32Array(numSamples);

        for (let i = 0; i < numSamples; i++) {
            const int16 = combinedBuffer.readInt16LE(i * 2);
            samples[i] = int16 / 32768.0;
        }

        debugLog(`Processed ${samples.length} samples from ${this.chunks.length} chunks`);

        return {
            samples,
            sampleRate: this.currentConfig.sampleRate,
            channels: this.currentConfig.channels,
            durationMs,
            deviceName: this.currentDeviceName,
            capturedAt: new Date().toISOString()
        };
    }

    /**
     * Cleanup internal state
     */
    private cleanup(): void {
        this.process = null;
        this.capturing = false;
        this.chunks = [];
        this.captureStartTime = 0;
        this.currentConfig = null;
    }
}

// Export singleton instance
export const ffmpegDriver = new FFmpegDriver();
