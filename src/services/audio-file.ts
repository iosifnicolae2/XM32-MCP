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
    dataOffset: number; // Actual byte offset where audio data starts
}

/**
 * AudioFileService
 * Handles reading and writing WAV audio files
 */
export class AudioFileService {
    private defaultRecordingsDir: string;

    constructor(defaultRecordingsDir?: string) {
        const workDir = path.resolve(process.env.AUDIO_WORKDIR || path.join(process.cwd(), 'output', 'audio'));
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
     * Handles WAV files with extra metadata chunks (LIST, INFO, etc.) between fmt and data
     */
    private readWavHeader(filePath: string): WavHeader {
        const fd = fs.openSync(filePath, 'r');
        const stats = fs.fstatSync(fd);

        // Read enough bytes to parse header and find data chunk
        // Most WAV files have data within first 1000 bytes, but some have extensive metadata
        const headerSize = Math.min(stats.size, 10000);
        const buffer = Buffer.alloc(headerSize);
        fs.readSync(fd, buffer, 0, headerSize, 0);
        fs.closeSync(fd);

        // Parse basic RIFF header
        const riff = buffer.toString('ascii', 0, 4);
        const fileSize = buffer.readUInt32LE(4);
        const wave = buffer.toString('ascii', 8, 12);
        const fmt = buffer.toString('ascii', 12, 16);
        const fmtSize = buffer.readUInt32LE(16);

        // Parse fmt chunk data
        const audioFormat = buffer.readUInt16LE(20);
        const numChannels = buffer.readUInt16LE(22);
        const sampleRate = buffer.readUInt32LE(24);
        const byteRate = buffer.readUInt32LE(28);
        const blockAlign = buffer.readUInt16LE(32);
        const bitsPerSample = buffer.readUInt16LE(34);

        // Scan for the 'data' chunk starting after fmt chunk
        // fmt chunk ends at offset 20 + fmtSize (20 = 12 bytes RIFF header + 8 bytes fmt header)
        let offset = 20 + fmtSize;
        let dataChunkFound = false;
        let dataSize = 0;
        let dataOffset = 0;

        debugLog(`Scanning for data chunk starting at offset ${offset}`);

        while (offset < headerSize - 8) {
            const chunkName = buffer.toString('ascii', offset, offset + 4);
            const chunkSize = buffer.readUInt32LE(offset + 4);

            debugLog(`Found chunk '${chunkName}' at offset ${offset}, size ${chunkSize}`);

            if (chunkName === 'data') {
                dataSize = chunkSize;
                dataOffset = offset + 8; // Data starts after 8-byte chunk header
                dataChunkFound = true;
                debugLog(`Data chunk found at offset ${dataOffset}, size ${dataSize}`);
                break;
            }

            // Move to next chunk (8 bytes header + chunk size)
            offset += 8 + chunkSize;

            // WAV chunks should be aligned to 2-byte boundaries (word-aligned)
            if (chunkSize % 2 !== 0) {
                offset += 1;
            }
        }

        if (!dataChunkFound) {
            throw new Error(`Invalid WAV file: Could not find 'data' chunk in ${filePath}`);
        }

        return {
            riff,
            fileSize,
            wave,
            fmt,
            fmtSize,
            audioFormat,
            numChannels,
            sampleRate,
            byteRate,
            blockAlign,
            bitsPerSample,
            data: 'data',
            dataSize,
            dataOffset
        };
    }

    /**
     * Read WAV samples and convert to Float32Array
     */
    private readWavSamples(filePath: string, header: WavHeader): Float32Array {
        const fd = fs.openSync(filePath, 'r');

        // Use the dataOffset calculated during header parsing
        const dataBuffer = Buffer.alloc(header.dataSize);
        fs.readSync(fd, dataBuffer, 0, header.dataSize, header.dataOffset);
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
