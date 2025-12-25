import type { AudioDevice, AudioCaptureConfig, CapturedAudio } from '../../types/audio.js';

/**
 * Audio driver interface
 * Abstraction layer for different audio backends (FFmpeg, SoX, etc.)
 */
export interface AudioDriver {
    /** Driver name for logging/debugging */
    readonly name: string;

    /**
     * Check if this driver is available on the system
     */
    isAvailable(): Promise<boolean>;

    /**
     * List all available audio input devices
     */
    listDevices(): Promise<AudioDevice[]>;

    /**
     * Start audio capture from a device
     * Returns when capture has started
     * @param config - Audio capture configuration
     * @param deviceId - Optional device ID to capture from
     * @param durationSeconds - Optional duration in seconds (uses FFmpeg -t flag for reliable stopping)
     */
    startCapture(config: AudioCaptureConfig, deviceId?: number, durationSeconds?: number): Promise<void>;

    /**
     * Stop capture and return the captured audio data
     */
    stopCapture(): Promise<CapturedAudio>;

    /**
     * Abort capture without returning data
     */
    abortCapture(): Promise<void>;

    /**
     * Check if currently capturing
     */
    isCapturing(): boolean;
}

/**
 * Platform-specific audio format identifier
 */
export type AudioFormat = 'avfoundation' | 'dshow' | 'alsa' | 'pulse';

/**
 * Get the audio format for the current platform
 */
export function getPlatformAudioFormat(): AudioFormat {
    switch (process.platform) {
        case 'darwin':
            return 'avfoundation';
        case 'win32':
            return 'dshow';
        case 'linux':
            // Could also be 'alsa' depending on system configuration
            return 'pulse';
        default:
            throw new Error(`Unsupported platform: ${process.platform}`);
    }
}

/**
 * Raw device info from FFmpeg output parsing
 */
export interface RawDeviceInfo {
    index: number;
    name: string;
    type: 'audio' | 'video';
}
