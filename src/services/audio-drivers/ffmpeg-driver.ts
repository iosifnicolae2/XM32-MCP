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
    private cachedDevices: AudioDevice[] = [];
    private captureDuration: number | null = null; // Duration in seconds when using -t flag

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
            const devices = rawDevices.map((raw, idx) => this.convertToAudioDevice(raw, idx));
            this.cachedDevices = devices;
            return devices;
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
            // FFmpeg outputs device list to stderr and exits with error code
            // We need to capture both stdout and stderr
            const { stdout, stderr } = await execAsync('ffmpeg -f dshow -list_devices true -i dummy 2>&1');
            const output = stdout || stderr;
            debugLog('Windows device list output length:', output.length);
            return this.parseDShowOutput(output);
        } catch (error) {
            // FFmpeg always exits with error when listing devices (no input file)
            // The device list is in stdout (due to 2>&1 redirect) or stderr
            const err = error as { stdout?: string; stderr?: string };
            const output = err.stdout || err.stderr || '';
            debugLog('Windows device list from error:', output.length, 'chars');
            if (output) {
                return this.parseDShowOutput(output);
            }
            throw error;
        }
    }

    /**
     * Parse DirectShow device list output
     * Modern FFmpeg format: [dshow @ ...] "Device Name" (audio)
     * Legacy format: DirectShow audio devices / DirectShow video devices sections
     */
    private parseDShowOutput(output: string): RawDeviceInfo[] {
        const devices: RawDeviceInfo[] = [];
        const lines = output.split('\n');

        let index = 0;

        // Check if using modern format (lines ending with (audio) or (video))
        const usesModernFormat = lines.some(line => line.includes('(audio)') || line.includes('(video)'));

        if (usesModernFormat) {
            // Modern format: [dshow @ ...] "Device Name" (audio)
            for (const line of lines) {
                // Only process audio devices, skip "Alternative name" lines
                if (line.includes('(audio)') && !line.includes('Alternative name')) {
                    // Extract device name from quotes
                    const match = line.match(/\[dshow[^\]]*\]\s+"([^"]+)"\s+\(audio\)/);
                    if (match) {
                        devices.push({
                            index: index++,
                            name: match[1],
                            type: 'audio'
                        });
                    }
                }
            }
        } else {
            // Legacy format with section headers
            let inAudioSection = false;

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
     * @param config - Audio capture configuration
     * @param deviceId - Optional device ID to capture from
     * @param durationSeconds - Optional duration in seconds (uses FFmpeg -t flag for reliable stopping)
     */
    async startCapture(config: AudioCaptureConfig, deviceId?: number, durationSeconds?: number): Promise<void> {
        if (this.capturing) {
            throw new Error('Already capturing audio');
        }

        // List devices first to populate cache (needed for Windows device name lookup)
        const devices = await this.listDevices();
        const device = deviceId !== undefined ? devices.find(d => d.id === deviceId) : devices[0];
        this.currentDeviceName = device?.name ?? 'Unknown Device';

        const format = getPlatformAudioFormat();
        const inputDevice = this.buildInputDevice(format, deviceId);

        this.currentConfig = config;
        this.chunks = [];
        this.captureStartTime = Date.now();
        this.captureDuration = durationSeconds ?? null;

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

        // Add duration flag if specified (reliable way to stop recording on all platforms)
        if (durationSeconds !== undefined && durationSeconds > 0) {
            // Insert -t before output (after input options)
            args.splice(args.indexOf('pipe:1'), 0, '-t', String(durationSeconds));
            debugLog(`Recording for ${durationSeconds} seconds using -t flag`);
        }

        debugLog('Starting FFmpeg capture:', 'ffmpeg', args.join(' '));

        // Explicitly configure stdio for reliable pipe handling on all platforms
        this.process = spawn('ffmpeg', args, {
            stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr all as pipes
            windowsHide: true // Hide console window on Windows
        });

        if (!this.process.stdout) {
            throw new Error('Failed to create stdout pipe for FFmpeg process');
        }

        this.process.stdout.on('data', (chunk: Buffer) => {
            this.chunks.push(chunk);
            debugLog(`Received ${chunk.length} bytes from FFmpeg stdout`);
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
            const totalBytes = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            debugLog(`FFmpeg process closed with code ${code}, total bytes captured: ${totalBytes}`);
        });

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
            case 'dshow': {
                // On Windows, need to specify device name
                // Note: Don't add quotes here - spawn handles argument passing correctly
                // Quotes are only needed in shell commands, not with spawn()
                const device = deviceId !== undefined
                    ? this.cachedDevices.find(d => d.id === deviceId)
                    : this.cachedDevices[0];
                if (!device) {
                    throw new Error(`No audio device found with id ${deviceId}. Call listDevices() first.`);
                }
                return `audio=${device.name}`;
            }
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

            // Handle case where process already exited (e.g., when -t duration was used)
            if (this.process?.exitCode !== null) {
                handleClose();
                return;
            }

            this.process?.once('close', handleClose);

            // If duration was specified with -t flag, FFmpeg will exit on its own
            // Just wait for it to finish naturally
            if (this.captureDuration !== null) {
                debugLog('Waiting for FFmpeg to finish (duration-based recording)...');
                // Set a generous timeout (duration + 5 seconds buffer)
                const timeoutMs = (this.captureDuration * 1000) + 5000;
                setTimeout(() => {
                    if (this.capturing && this.process?.exitCode === null) {
                        debugLog('FFmpeg timeout, force killing...');
                        this.process?.kill('SIGKILL');
                    }
                }, timeoutMs);
                return;
            }

            // Stop FFmpeg gracefully (for indefinite recordings without -t flag)
            // On Windows, SIGTERM doesn't work reliably - try stdin 'q' then SIGTERM
            if (process.platform === 'win32') {
                // Try sending 'q' to stdin first
                try {
                    this.process?.stdin?.write('q\n');
                    this.process?.stdin?.end();
                } catch {
                    // Ignore stdin errors
                }
                // Also send SIGTERM as backup
                setTimeout(() => {
                    if (this.capturing && this.process?.exitCode === null) {
                        this.process?.kill('SIGTERM');
                    }
                }, 500);
            } else {
                this.process?.kill('SIGTERM');
            }

            // Timeout fallback
            setTimeout(() => {
                if (this.capturing && this.process?.exitCode === null) {
                    debugLog('Force killing FFmpeg process...');
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
        this.captureDuration = null;
    }
}

// Export singleton instance
export const ffmpegDriver = new FFmpegDriver();
