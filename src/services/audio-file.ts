import * as fs from 'fs';
import * as path from 'path';
import type { CapturedAudio, AudioFileInfo } from '../types/audio.js';

const DEBUG = process.env.DEBUG?.includes('audio') || process.env.DEBUG?.includes('file') || process.env.DEBUG === '*';

const debugLog = (...args: unknown[]) => {
    if (DEBUG) {
        console.error('[AudioFile]', ...args);
    }
};

/**
 * WAV file header structure (44 bytes for standard PCM)
 */
interface WavHeader {
    riff: string;
    fileSize: number;
    wave: string;
    fmt: string;
    fmtSize: number;
    audioFormat: number;
    numChannels: number;
    sampleRate: number;
    byteRate: number;
    blockAlign: number;
    bitsPerSample: number;
    data: string;
    dataSize: number;
}

/**
 * AudioFileService
 * Handles reading and writing WAV audio files
 */
export class AudioFileService {
    private defaultRecordingsDir: string;

    constructor(defaultRecordingsDir?: string) {
        const workDir = process.env.AUDIO_WORKDIR || path.join(process.cwd(), 'output', 'audio');
        this.defaultRecordingsDir = defaultRecordingsDir || path.join(workDir, 'recordings');
    }

    /**
     * Resolve file path - handles relative paths by prepending recordings directory
     */
    resolveFilePath(inputPath: string): string {
        if (path.isAbsolute(inputPath)) {
            return inputPath;
        }
        return path.resolve(this.defaultRecordingsDir, inputPath);
    }

    /**
     * Generate a unique recording file path with timestamp
     */
    generateRecordingPath(customFilename?: string): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = customFilename || `recording-${timestamp}.wav`;
        return path.join(this.defaultRecordingsDir, filename);
    }

    /**
     * Ensure the recordings directory exists
     */
    ensureRecordingsDir(): void {
        if (!fs.existsSync(this.defaultRecordingsDir)) {
            fs.mkdirSync(this.defaultRecordingsDir, { recursive: true });
            debugLog(`Created recordings directory: ${this.defaultRecordingsDir}`);
        }
    }

    /**
     * Validate that a file exists and is a valid WAV file
     */
    async validateWavFile(filePath: string): Promise<{ valid: boolean; error?: string }> {
        const resolvedPath = this.resolveFilePath(filePath);

        if (!fs.existsSync(resolvedPath)) {
            return { valid: false, error: `File not found: ${resolvedPath}` };
        }

        const stats = fs.statSync(resolvedPath);
        if (stats.size < 44) {
            return { valid: false, error: 'File too small to be a valid WAV file (minimum 44 bytes for header)' };
        }

        try {
            const fd = fs.openSync(resolvedPath, 'r');
            const headerBuffer = Buffer.alloc(12);
            fs.readSync(fd, headerBuffer, 0, 12, 0);
            fs.closeSync(fd);

            const riff = headerBuffer.toString('ascii', 0, 4);
            const wave = headerBuffer.toString('ascii', 8, 12);

            if (riff !== 'RIFF') {
                return { valid: false, error: 'Invalid WAV file: Missing RIFF header' };
            }
            if (wave !== 'WAVE') {
                return { valid: false, error: 'Invalid WAV file: Missing WAVE identifier' };
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}` };
        }
    }

    /**
     * Get file info without loading audio samples
     */
    async getFileInfo(filePath: string): Promise<AudioFileInfo> {
        const resolvedPath = this.resolveFilePath(filePath);
        const validation = await this.validateWavFile(resolvedPath);

        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const stats = fs.statSync(resolvedPath);
        const header = this.readWavHeader(resolvedPath);

        const numSamples = header.dataSize / (header.bitsPerSample / 8) / header.numChannels;
        const durationMs = (numSamples / header.sampleRate) * 1000;

        return {
            filePath: resolvedPath,
            format: 'wav',
            sampleRate: header.sampleRate,
            channels: header.numChannels,
            bitDepth: header.bitsPerSample,
            durationMs,
            fileSize: stats.size
        };
    }

    /**
     * Read a WAV file and return CapturedAudio for analysis
     */
    async readWavFile(filePath: string): Promise<CapturedAudio> {
        const resolvedPath = this.resolveFilePath(filePath);
        debugLog(`Reading WAV file: ${resolvedPath}`);

        const validation = await this.validateWavFile(resolvedPath);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const header = this.readWavHeader(resolvedPath);
        debugLog(`WAV header: ${header.sampleRate}Hz, ${header.numChannels}ch, ${header.bitsPerSample}bit`);

        if (header.audioFormat !== 1) {
            throw new Error(`Unsupported WAV format: Only PCM (format=1) is supported, got format=${header.audioFormat}`);
        }

        const samples = this.readWavSamples(resolvedPath, header);
        const durationMs = (samples.length / header.numChannels / header.sampleRate) * 1000;

        debugLog(`Read ${samples.length} samples, duration: ${durationMs.toFixed(2)}ms`);

        return {
            samples,
            sampleRate: header.sampleRate,
            channels: header.numChannels,
            durationMs,
            deviceName: `file:${path.basename(resolvedPath)}`,
            capturedAt: new Date().toISOString()
        };
    }

    /**
     * Write audio data to a WAV file
     */
    async writeWavFile(filePath: string, audio: CapturedAudio): Promise<void> {
        const resolvedPath = this.resolveFilePath(filePath);
        debugLog(`Writing WAV file: ${resolvedPath}`);

        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const numSamples = audio.samples.length;
        const dataSize = numSamples * bytesPerSample;
        const fileSize = 36 + dataSize;

        const buffer = Buffer.alloc(44 + dataSize);
        let offset = 0;

        // RIFF header
        buffer.write('RIFF', offset);
        offset += 4;
        buffer.writeUInt32LE(fileSize, offset);
        offset += 4;
        buffer.write('WAVE', offset);
        offset += 4;

        // fmt subchunk
        buffer.write('fmt ', offset);
        offset += 4;
        buffer.writeUInt32LE(16, offset);
        offset += 4;
        buffer.writeUInt16LE(1, offset);
        offset += 2;
        buffer.writeUInt16LE(audio.channels, offset);
        offset += 2;
        buffer.writeUInt32LE(audio.sampleRate, offset);
        offset += 4;
        buffer.writeUInt32LE(audio.sampleRate * audio.channels * bytesPerSample, offset);
        offset += 4;
        buffer.writeUInt16LE(audio.channels * bytesPerSample, offset);
        offset += 2;
        buffer.writeUInt16LE(bitsPerSample, offset);
        offset += 2;

        // data subchunk
        buffer.write('data', offset);
        offset += 4;
        buffer.writeUInt32LE(dataSize, offset);
        offset += 4;

        // Write samples (convert Float32 -1.0 to 1.0 -> Int16)
        for (let i = 0; i < numSamples; i++) {
            const sample = Math.max(-1, Math.min(1, audio.samples[i]));
            const int16 = Math.round(sample * 32767);
            buffer.writeInt16LE(int16, offset);
            offset += 2;
        }

        fs.writeFileSync(resolvedPath, buffer);
        debugLog(`Wrote ${numSamples} samples to ${resolvedPath}`);
    }

    /**
     * Read WAV file header
     */
    private readWavHeader(filePath: string): WavHeader {
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(44);
        fs.readSync(fd, buffer, 0, 44, 0);
        fs.closeSync(fd);

        const header: WavHeader = {
            riff: buffer.toString('ascii', 0, 4),
            fileSize: buffer.readUInt32LE(4),
            wave: buffer.toString('ascii', 8, 12),
            fmt: buffer.toString('ascii', 12, 16),
            fmtSize: buffer.readUInt32LE(16),
            audioFormat: buffer.readUInt16LE(20),
            numChannels: buffer.readUInt16LE(22),
            sampleRate: buffer.readUInt32LE(24),
            byteRate: buffer.readUInt32LE(28),
            blockAlign: buffer.readUInt16LE(32),
            bitsPerSample: buffer.readUInt16LE(34),
            data: buffer.toString('ascii', 36, 40),
            dataSize: buffer.readUInt32LE(40)
        };

        // Handle extended fmt chunk (some WAV files have fmtSize > 16)
        if (header.fmtSize > 16) {
            const extendedFd = fs.openSync(filePath, 'r');
            const extOffset = 20 + header.fmtSize;
            const dataHeaderBuffer = Buffer.alloc(8);
            fs.readSync(extendedFd, dataHeaderBuffer, 0, 8, extOffset);
            fs.closeSync(extendedFd);

            header.data = dataHeaderBuffer.toString('ascii', 0, 4);
            header.dataSize = dataHeaderBuffer.readUInt32LE(4);
        }

        return header;
    }

    /**
     * Read WAV samples and convert to Float32Array
     */
    private readWavSamples(filePath: string, header: WavHeader): Float32Array {
        const fd = fs.openSync(filePath, 'r');

        // Calculate data offset (header + possible extended fmt)
        const dataOffset = header.fmtSize > 16 ? 20 + header.fmtSize + 8 : 44;

        const dataBuffer = Buffer.alloc(header.dataSize);
        fs.readSync(fd, dataBuffer, 0, header.dataSize, dataOffset);
        fs.closeSync(fd);

        const bytesPerSample = header.bitsPerSample / 8;
        const numSamples = header.dataSize / bytesPerSample;
        const samples = new Float32Array(numSamples);

        for (let i = 0; i < numSamples; i++) {
            const byteOffset = i * bytesPerSample;

            if (header.bitsPerSample === 16) {
                const int16 = dataBuffer.readInt16LE(byteOffset);
                samples[i] = int16 / 32768.0;
            } else if (header.bitsPerSample === 24) {
                const byte1 = dataBuffer.readUInt8(byteOffset);
                const byte2 = dataBuffer.readUInt8(byteOffset + 1);
                const byte3 = dataBuffer.readInt8(byteOffset + 2);
                const int24 = byte1 | (byte2 << 8) | (byte3 << 16);
                samples[i] = int24 / 8388608.0;
            } else if (header.bitsPerSample === 32) {
                const int32 = dataBuffer.readInt32LE(byteOffset);
                samples[i] = int32 / 2147483648.0;
            } else {
                throw new Error(`Unsupported bit depth: ${header.bitsPerSample}`);
            }
        }

        return samples;
    }

    /**
     * Get the default recordings directory
     */
    getRecordingsDir(): string {
        return this.defaultRecordingsDir;
    }
}
