import { createCanvas } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';
import type {
    SpectrogramData,
    MelSpectrogramData,
    FrequencyBalanceResult,
    RenderOptions,
    AUDIO_DEFAULTS,
    HiFiSpectrogramOptions,
    HiFiSpectrogramResult
} from '../types/audio.js';

// Debug logging
const DEBUG = process.env.DEBUG?.includes('audio') || process.env.DEBUG?.includes('viz') || process.env.DEBUG === '*';

const debugLog = (...args: unknown[]) => {
    if (DEBUG) {
        console.error('[AudioVisualization]', ...args);
    }
};

/**
 * Default configuration values
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
 * Colormap definitions for spectrograms
 */
type ColormapName = 'viridis' | 'plasma' | 'magma' | 'inferno' | 'grayscale';

interface RGB {
    r: number;
    g: number;
    b: number;
}

/**
 * Get color from colormap
 */
function getColormapColor(value: number, colormap: ColormapName): RGB {
    // Clamp value to 0-1
    const v = Math.max(0, Math.min(1, value));

    switch (colormap) {
        case 'viridis':
            return viridis(v);
        case 'plasma':
            return plasma(v);
        case 'magma':
            return magma(v);
        case 'inferno':
            return inferno(v);
        case 'grayscale':
        default: {
            const gray = Math.round(v * 255);
            return { r: gray, g: gray, b: gray };
        }
    }
}

/**
 * Viridis colormap (simplified)
 */
function viridis(t: number): RGB {
    const colors = [
        { r: 68, g: 1, b: 84 },
        { r: 59, g: 82, b: 139 },
        { r: 33, g: 145, b: 140 },
        { r: 94, g: 201, b: 98 },
        { r: 253, g: 231, b: 37 }
    ];
    return interpolateColormap(t, colors);
}

/**
 * Plasma colormap (simplified)
 */
function plasma(t: number): RGB {
    const colors = [
        { r: 13, g: 8, b: 135 },
        { r: 126, g: 3, b: 168 },
        { r: 204, g: 71, b: 120 },
        { r: 248, g: 149, b: 64 },
        { r: 240, g: 249, b: 33 }
    ];
    return interpolateColormap(t, colors);
}

/**
 * Magma colormap (simplified)
 */
function magma(t: number): RGB {
    const colors = [
        { r: 0, g: 0, b: 4 },
        { r: 81, g: 18, b: 124 },
        { r: 183, g: 55, b: 121 },
        { r: 254, g: 159, b: 109 },
        { r: 252, g: 253, b: 191 }
    ];
    return interpolateColormap(t, colors);
}

/**
 * Inferno colormap (simplified)
 */
function inferno(t: number): RGB {
    const colors = [
        { r: 0, g: 0, b: 4 },
        { r: 87, g: 16, b: 110 },
        { r: 188, g: 55, b: 84 },
        { r: 249, g: 142, b: 9 },
        { r: 252, g: 255, b: 164 }
    ];
    return interpolateColormap(t, colors);
}

/**
 * Interpolate between colormap stops
 */
function interpolateColormap(t: number, colors: RGB[]): RGB {
    const n = colors.length - 1;
    const i = Math.min(Math.floor(t * n), n - 1);
    const f = t * n - i;

    const c1 = colors[i];
    const c2 = colors[i + 1];

    return {
        r: Math.round(c1.r + (c2.r - c1.r) * f),
        g: Math.round(c1.g + (c2.g - c1.g) * f),
        b: Math.round(c1.b + (c2.b - c1.b) * f)
    };
}

// ============================================================================
// High-Fidelity Spectrogram Helper Functions
// ============================================================================

/**
 * Convert frequency to logarithmic Y position (0-1)
 * Maps minFreq -> 0, maxFreq -> 1 on log scale
 */
function freqToLogPosition(freq: number, minFreq: number, maxFreq: number): number {
    if (freq <= minFreq) return 0;
    if (freq >= maxFreq) return 1;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = Math.log10(freq);
    return (logFreq - logMin) / (logMax - logMin);
}

/**
 * Convert logarithmic Y position (0-1) back to frequency
 */
function logPositionToFreq(position: number, minFreq: number, maxFreq: number): number {
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = logMin + position * (logMax - logMin);
    return Math.pow(10, logFreq);
}

/**
 * Get standard frequency grid lines for logarithmic scale
 * Returns ISO 1/3 octave frequencies
 */
function getLogFrequencyGridLines(minFreq: number, maxFreq: number): number[] {
    const standardFreqs = [
        20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000,
        6300, 8000, 10000, 12500, 16000, 20000
    ];
    return standardFreqs.filter(f => f >= minFreq && f <= maxFreq);
}

/**
 * Format frequency for display
 */
function formatFrequency(hz: number): string {
    if (hz >= 1000) {
        const kHz = hz / 1000;
        return kHz % 1 === 0 ? `${kHz}k` : `${kHz.toFixed(1)}k`;
    }
    return `${Math.round(hz)}`;
}

/**
 * Get time grid intervals based on duration
 * Returns appropriate tick interval in seconds
 */
function getTimeGridInterval(durationSeconds: number): number {
    if (durationSeconds <= 1) return 0.1;
    if (durationSeconds <= 5) return 0.5;
    if (durationSeconds <= 10) return 1;
    if (durationSeconds <= 30) return 2;
    if (durationSeconds <= 60) return 5;
    if (durationSeconds <= 300) return 30;
    return 60;
}

/**
 * AudioVisualizationService
 * Generates PNG visualizations of audio analysis data
 */
export class AudioVisualizationService {
    private defaultOutputDir: string;

    constructor(defaultOutputDir?: string) {
        const workDir = path.resolve(process.env.AUDIO_WORKDIR || path.join(process.cwd(), 'output', 'audio'));
        this.defaultOutputDir = defaultOutputDir || path.join(workDir, 'visualizations');
    }

    /**
     * Ensure output directory exists
     */
    private ensureOutputDir(outputPath: string): void {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            debugLog(`Created output directory: ${dir}`);
        }
    }

    /**
     * Resolve output path for a file
     */
    resolveOutputPath(filename: string, customPath?: string): string {
        if (customPath) {
            // If customPath is a directory, append filename
            if (customPath.endsWith('/') || customPath.endsWith('\\') || !path.extname(customPath)) {
                return path.resolve(customPath, filename);
            }
            // If customPath is a full file path, use it
            return path.resolve(customPath);
        }

        return path.join(this.defaultOutputDir, filename);
    }

    /**
     * Generate timestamp-based filename
     */
    private generateFilename(prefix: string, extension: string = 'png'): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `${prefix}-${timestamp}.${extension}`;
    }

    /**
     * Render STFT spectrogram to PNG
     */
    async renderSpectrogram(data: SpectrogramData, options?: RenderOptions): Promise<string> {
        const width = options?.width ?? DEFAULTS.outputWidth;
        const height = options?.height ?? DEFAULTS.outputHeight;
        const colormap = options?.colormap ?? 'viridis';
        const showLabels = options?.showLabels ?? true;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Calculate dimensions for the plot area
        const labelPadding = showLabels ? 60 : 10;
        const plotWidth = width - labelPadding - 20;
        const plotHeight = height - (showLabels ? 50 : 20);
        const plotX = labelPadding;
        const plotY = 10;

        // Draw background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        // Find min/max values for normalization
        let minMag = Infinity;
        let maxMag = -Infinity;
        for (const frame of data.magnitudes) {
            for (let i = 0; i < frame.length; i++) {
                const dbVal = frame[i] > 0 ? 20 * Math.log10(frame[i]) : -100;
                minMag = Math.min(minMag, dbVal);
                maxMag = Math.max(maxMag, dbVal);
            }
        }

        // Clamp dynamic range
        minMag = Math.max(minMag, -80);
        const range = maxMag - minMag;

        // Draw spectrogram
        const numFrames = data.magnitudes.length;
        const numBins = data.numBins;
        const pixelWidth = plotWidth / numFrames;
        const pixelHeight = plotHeight / numBins;

        for (let frame = 0; frame < numFrames; frame++) {
            for (let bin = 0; bin < numBins; bin++) {
                const magnitude = data.magnitudes[frame][bin];
                const dbVal = magnitude > 0 ? 20 * Math.log10(magnitude) : minMag;
                const normalized = range > 0 ? (dbVal - minMag) / range : 0;

                const color = getColormapColor(normalized, colormap);
                ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;

                // Draw from bottom (low freq) to top (high freq)
                const x = plotX + frame * pixelWidth;
                const y = plotY + plotHeight - (bin + 1) * pixelHeight;
                ctx.fillRect(x, y, Math.ceil(pixelWidth), Math.ceil(pixelHeight));
            }
        }

        // Draw labels if enabled
        if (showLabels) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px sans-serif';

            // Y-axis label (Frequency)
            ctx.save();
            ctx.translate(15, plotY + plotHeight / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.fillText('Frequency (Hz)', 0, 0);
            ctx.restore();

            // Y-axis ticks
            const freqTicks = [100, 500, 1000, 2000, 5000, 10000];
            ctx.textAlign = 'right';
            for (const freq of freqTicks) {
                if (freq < data.sampleRate / 2) {
                    const binIndex = Math.round((freq / data.sampleRate) * data.fftSize);
                    const y = plotY + plotHeight - (binIndex / numBins) * plotHeight;
                    ctx.fillText(`${freq >= 1000 ? freq / 1000 + 'k' : freq}`, plotX - 5, y + 4);
                }
            }

            // X-axis label (Time)
            ctx.textAlign = 'center';
            ctx.fillText('Time (s)', plotX + plotWidth / 2, height - 10);

            // X-axis ticks
            const totalDuration = (data.times[data.times.length - 1] || 0) / 1000;
            const numTicks = 5;
            for (let i = 0; i <= numTicks; i++) {
                const time = (i / numTicks) * totalDuration;
                const x = plotX + (i / numTicks) * plotWidth;
                ctx.fillText(time.toFixed(1), x, height - 25);
            }

            // Title
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText('Spectrogram', width / 2, height - 5);
        }

        // Save to file
        const filename = options?.filename ?? this.generateFilename('spectrogram');
        const outputPath = this.resolveOutputPath(filename, options?.outputPath);
        this.ensureOutputDir(outputPath);

        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);

        debugLog(`Saved spectrogram to: ${outputPath}`);
        return outputPath;
    }

    /**
     * Render mel-spectrogram to PNG
     */
    async renderMelSpectrogram(data: MelSpectrogramData, options?: RenderOptions): Promise<string> {
        const width = options?.width ?? DEFAULTS.outputWidth;
        const height = options?.height ?? DEFAULTS.outputHeight;
        const colormap = options?.colormap ?? 'magma';
        const showLabels = options?.showLabels ?? true;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Calculate dimensions for the plot area
        const labelPadding = showLabels ? 60 : 10;
        const plotWidth = width - labelPadding - 20;
        const plotHeight = height - (showLabels ? 50 : 20);
        const plotX = labelPadding;
        const plotY = 10;

        // Draw background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        // Find min/max values for normalization
        let minVal = Infinity;
        let maxVal = -Infinity;
        for (const frame of data.melBands) {
            for (let i = 0; i < frame.length; i++) {
                const dbVal = frame[i] > 0 ? 20 * Math.log10(frame[i]) : -100;
                minVal = Math.min(minVal, dbVal);
                maxVal = Math.max(maxVal, dbVal);
            }
        }

        minVal = Math.max(minVal, -80);
        const range = maxVal - minVal;

        // Draw mel-spectrogram
        const numFrames = data.melBands.length;
        const numBands = data.numMelBands;
        const pixelWidth = plotWidth / numFrames;
        const pixelHeight = plotHeight / numBands;

        for (let frame = 0; frame < numFrames; frame++) {
            for (let band = 0; band < numBands; band++) {
                const value = data.melBands[frame][band];
                const dbVal = value > 0 ? 20 * Math.log10(value) : minVal;
                const normalized = range > 0 ? (dbVal - minVal) / range : 0;

                const color = getColormapColor(normalized, colormap);
                ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;

                const x = plotX + frame * pixelWidth;
                const y = plotY + plotHeight - (band + 1) * pixelHeight;
                ctx.fillRect(x, y, Math.ceil(pixelWidth), Math.ceil(pixelHeight));
            }
        }

        // Draw labels if enabled
        if (showLabels) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px sans-serif';

            // Y-axis label
            ctx.save();
            ctx.translate(15, plotY + plotHeight / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.fillText('Mel Band', 0, 0);
            ctx.restore();

            // X-axis label (Time)
            ctx.textAlign = 'center';
            ctx.fillText('Time (s)', plotX + plotWidth / 2, height - 10);

            // X-axis ticks
            const totalDuration = (data.times[data.times.length - 1] || 0) / 1000;
            const numTicks = 5;
            for (let i = 0; i <= numTicks; i++) {
                const time = (i / numTicks) * totalDuration;
                const x = plotX + (i / numTicks) * plotWidth;
                ctx.fillText(time.toFixed(1), x, height - 25);
            }

            // Title
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText('Mel Spectrogram', width / 2, height - 5);
        }

        // Save to file
        const filename = options?.filename ?? this.generateFilename('mel-spectrogram');
        const outputPath = this.resolveOutputPath(filename, options?.outputPath);
        this.ensureOutputDir(outputPath);

        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);

        debugLog(`Saved mel-spectrogram to: ${outputPath}`);
        return outputPath;
    }

    /**
     * Render frequency balance bar chart
     */
    async renderFrequencyBalance(data: FrequencyBalanceResult, options?: RenderOptions): Promise<string> {
        const width = options?.width ?? 600;
        const height = options?.height ?? 400;
        const showLabels = options?.showLabels ?? true;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Calculate dimensions
        const labelPadding = showLabels ? 80 : 20;
        const plotWidth = width - labelPadding - 40;
        const plotHeight = height - (showLabels ? 80 : 40);
        const plotX = labelPadding;
        const plotY = 30;

        // Draw background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        // Draw bars
        const numBands = data.bands.length;
        const barWidth = (plotWidth / numBands) * 0.8;
        const barGap = (plotWidth / numBands) * 0.2;

        // Color gradient for bars
        const bandColors = [
            '#3b0764', // Sub-bass (purple)
            '#4f46e5', // Bass (indigo)
            '#0891b2', // Low-mid (cyan)
            '#10b981', // Mid (emerald)
            '#f59e0b', // High-mid (amber)
            '#ef4444', // Presence (red)
            '#ec4899' // Brilliance (pink)
        ];

        for (let i = 0; i < numBands; i++) {
            const bandEnergy = data.bands[i];
            const barHeight = (bandEnergy.percentage / 100) * plotHeight;

            const x = plotX + i * (barWidth + barGap) + barGap / 2;
            const y = plotY + plotHeight - barHeight;

            // Draw bar
            ctx.fillStyle = bandColors[i % bandColors.length];
            ctx.fillRect(x, y, barWidth, barHeight);

            // Draw percentage label on bar
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${bandEnergy.percentage.toFixed(1)}%`, x + barWidth / 2, y - 5);

            // Draw band name
            if (showLabels) {
                ctx.save();
                ctx.translate(x + barWidth / 2, plotY + plotHeight + 10);
                ctx.rotate(-Math.PI / 4);
                ctx.textAlign = 'right';
                ctx.font = '11px sans-serif';
                ctx.fillText(bandEnergy.band.name, 0, 0);
                ctx.restore();
            }
        }

        // Draw axes
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plotX, plotY);
        ctx.lineTo(plotX, plotY + plotHeight);
        ctx.lineTo(plotX + plotWidth, plotY + plotHeight);
        ctx.stroke();

        // Draw labels
        if (showLabels) {
            ctx.fillStyle = '#ffffff';

            // Y-axis label
            ctx.save();
            ctx.translate(20, plotY + plotHeight / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.font = '12px sans-serif';
            ctx.fillText('Energy (%)', 0, 0);
            ctx.restore();

            // Y-axis ticks
            ctx.textAlign = 'right';
            for (let i = 0; i <= 4; i++) {
                const percent = i * 25;
                const y = plotY + plotHeight - (percent / 100) * plotHeight;
                ctx.fillText(`${percent}%`, plotX - 5, y + 4);

                // Grid line
                ctx.strokeStyle = '#333333';
                ctx.beginPath();
                ctx.moveTo(plotX, y);
                ctx.lineTo(plotX + plotWidth, y);
                ctx.stroke();
            }

            // Title and score
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Frequency Balance', width / 2, 20);

            ctx.font = '12px sans-serif';
            ctx.fillText(`Balance Score: ${data.balanceScore}/100 | Dominant: ${data.dominantBand}`, width / 2, height - 10);
        }

        // Save to file
        const filename = options?.filename ?? this.generateFilename('frequency-balance');
        const outputPath = this.resolveOutputPath(filename, options?.outputPath);
        this.ensureOutputDir(outputPath);

        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);

        debugLog(`Saved frequency balance chart to: ${outputPath}`);
        return outputPath;
    }

    /**
     * Render waveform visualization
     */
    async renderWaveform(samples: Float32Array, sampleRate: number, options?: RenderOptions): Promise<string> {
        const width = options?.width ?? DEFAULTS.outputWidth;
        const height = options?.height ?? 200;
        const showLabels = options?.showLabels ?? true;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Calculate dimensions
        const labelPadding = showLabels ? 50 : 10;
        const plotWidth = width - labelPadding - 20;
        const plotHeight = height - (showLabels ? 40 : 20);
        const plotX = labelPadding;
        const plotY = 10;
        const centerY = plotY + plotHeight / 2;

        // Draw background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        // Draw center line
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plotX, centerY);
        ctx.lineTo(plotX + plotWidth, centerY);
        ctx.stroke();

        // Draw waveform
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1;
        ctx.beginPath();

        const samplesPerPixel = Math.ceil(samples.length / plotWidth);

        for (let x = 0; x < plotWidth; x++) {
            const startSample = Math.floor((x / plotWidth) * samples.length);
            const endSample = Math.min(startSample + samplesPerPixel, samples.length);

            let min = 0;
            let max = 0;
            for (let i = startSample; i < endSample; i++) {
                min = Math.min(min, samples[i]);
                max = Math.max(max, samples[i]);
            }

            const yMin = centerY - min * (plotHeight / 2);
            const yMax = centerY - max * (plotHeight / 2);

            if (x === 0) {
                ctx.moveTo(plotX + x, yMin);
            }
            ctx.lineTo(plotX + x, yMax);
            ctx.lineTo(plotX + x, yMin);
        }
        ctx.stroke();

        // Draw labels
        if (showLabels) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px sans-serif';

            // Y-axis label
            ctx.save();
            ctx.translate(15, centerY);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.fillText('Amplitude', 0, 0);
            ctx.restore();

            // X-axis label
            ctx.textAlign = 'center';
            ctx.fillText('Time (s)', plotX + plotWidth / 2, height - 5);

            // X-axis ticks
            const totalDuration = samples.length / sampleRate;
            const numTicks = 5;
            for (let i = 0; i <= numTicks; i++) {
                const time = (i / numTicks) * totalDuration;
                const x = plotX + (i / numTicks) * plotWidth;
                ctx.fillText(time.toFixed(2), x, height - 20);
            }
        }

        // Save to file
        const filename = options?.filename ?? this.generateFilename('waveform');
        const outputPath = this.resolveOutputPath(filename, options?.outputPath);
        this.ensureOutputDir(outputPath);

        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);

        debugLog(`Saved waveform to: ${outputPath}`);
        return outputPath;
    }

    /**
     * Render high-fidelity spectrogram with logarithmic frequency scale
     * Supports configurable FFT size, dB range, and grid overlays
     */
    async renderHiFiSpectrogram(data: SpectrogramData, options?: HiFiSpectrogramOptions): Promise<HiFiSpectrogramResult> {
        // Apply defaults with HD resolution
        const width = options?.width ?? 1920;
        const height = options?.height ?? 1080;
        const colormap = options?.colormap ?? 'viridis';
        const frequencyScale = options?.frequencyScale ?? 'logarithmic';
        const minDb = options?.minDb ?? -90;
        const maxDb = options?.maxDb ?? 0;
        const showFrequencyLabels = options?.showFrequencyLabels ?? true;
        const showTimeLabels = options?.showTimeLabels ?? true;
        const showFrequencyGrid = options?.showFrequencyGrid ?? true;
        const showTimeGrid = options?.showTimeGrid ?? true;
        const showColorbar = options?.showColorbar ?? true;
        const showTitle = options?.showTitle ?? true;
        const title = options?.title ?? 'Spectrogram';
        const minFreqHz = options?.minFrequencyHz ?? 20;
        const maxFreqHz = options?.maxFrequencyHz ?? data.sampleRate / 2;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Calculate layout dimensions
        const leftMargin = showFrequencyLabels ? 80 : 20;
        const rightMargin = showColorbar ? 100 : 20;
        const topMargin = showTitle ? 50 : 20;
        const bottomMargin = showTimeLabels ? 60 : 20;

        const plotWidth = width - leftMargin - rightMargin;
        const plotHeight = height - topMargin - bottomMargin;
        const plotX = leftMargin;
        const plotY = topMargin;

        // Draw dark background
        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, 0, width, height);

        // Calculate dB range
        const dbRange = maxDb - minDb;

        // Create image data for the spectrogram
        const imageData = ctx.createImageData(plotWidth, plotHeight);
        const pixels = imageData.data;

        debugLog(`Rendering HiFi spectrogram: ${plotWidth}x${plotHeight}, ${data.numFrames} frames, ${data.numBins} bins`);

        // Render spectrogram with logarithmic frequency mapping
        for (let py = 0; py < plotHeight; py++) {
            // Map pixel Y to frequency (inverted: top = high freq)
            const freqPosition = 1 - py / plotHeight;

            let targetFreqHz: number;
            if (frequencyScale === 'logarithmic') {
                targetFreqHz = logPositionToFreq(freqPosition, minFreqHz, maxFreqHz);
            } else {
                // Linear scale
                targetFreqHz = minFreqHz + freqPosition * (maxFreqHz - minFreqHz);
            }

            // Convert frequency to bin index
            const binIndex = (targetFreqHz * data.fftSize) / data.sampleRate;
            const binFloor = Math.floor(binIndex);
            const binCeil = Math.min(binFloor + 1, data.numBins - 1);
            const binFrac = binIndex - binFloor;

            for (let px = 0; px < plotWidth; px++) {
                // Map pixel X to time frame
                const frameIndex = (px / plotWidth) * (data.numFrames - 1);
                const frameFloor = Math.floor(frameIndex);
                const frameCeil = Math.min(frameFloor + 1, data.numFrames - 1);
                const frameFrac = frameIndex - frameFloor;

                // Bilinear interpolation for smoother rendering
                const getMagnitude = (frame: number, bin: number): number => {
                    if (frame < 0 || frame >= data.numFrames || bin < 0 || bin >= data.numBins) {
                        return 0;
                    }
                    return data.magnitudes[frame]?.[bin] || 0;
                };

                const m00 = getMagnitude(frameFloor, binFloor);
                const m01 = getMagnitude(frameFloor, binCeil);
                const m10 = getMagnitude(frameCeil, binFloor);
                const m11 = getMagnitude(frameCeil, binCeil);

                const magnitude =
                    (1 - frameFrac) * ((1 - binFrac) * m00 + binFrac * m01) + frameFrac * ((1 - binFrac) * m10 + binFrac * m11);

                // Convert to dB and normalize
                const dbValue = magnitude > 0 ? 20 * Math.log10(magnitude) : minDb;
                const normalized = Math.max(0, Math.min(1, (dbValue - minDb) / dbRange));

                // Get color from colormap
                const color = getColormapColor(normalized, colormap);

                // Set pixel
                const pixelIndex = (py * plotWidth + px) * 4;
                pixels[pixelIndex] = color.r;
                pixels[pixelIndex + 1] = color.g;
                pixels[pixelIndex + 2] = color.b;
                pixels[pixelIndex + 3] = 255;
            }
        }

        // Draw spectrogram image
        ctx.putImageData(imageData, plotX, plotY);

        // Draw grid overlays
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;

        // Frequency grid lines
        if (showFrequencyGrid) {
            const gridFreqs = getLogFrequencyGridLines(minFreqHz, maxFreqHz);
            for (const freq of gridFreqs) {
                let yPos: number;
                if (frequencyScale === 'logarithmic') {
                    yPos = freqToLogPosition(freq, minFreqHz, maxFreqHz);
                } else {
                    yPos = (freq - minFreqHz) / (maxFreqHz - minFreqHz);
                }
                const y = plotY + plotHeight * (1 - yPos);
                ctx.beginPath();
                ctx.moveTo(plotX, y);
                ctx.lineTo(plotX + plotWidth, y);
                ctx.stroke();
            }
        }

        // Time grid lines
        if (showTimeGrid) {
            const durationSeconds = (data.times[data.times.length - 1] || 0) / 1000;
            const interval = getTimeGridInterval(durationSeconds);
            for (let t = 0; t <= durationSeconds; t += interval) {
                const x = plotX + (t / durationSeconds) * plotWidth;
                ctx.beginPath();
                ctx.moveTo(x, plotY);
                ctx.lineTo(x, plotY + plotHeight);
                ctx.stroke();
            }
        }

        // Draw axis border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(plotX, plotY, plotWidth, plotHeight);

        // Draw labels
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px sans-serif';

        // Frequency axis labels
        if (showFrequencyLabels) {
            const gridFreqs = getLogFrequencyGridLines(minFreqHz, maxFreqHz);
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            for (const freq of gridFreqs) {
                let yPos: number;
                if (frequencyScale === 'logarithmic') {
                    yPos = freqToLogPosition(freq, minFreqHz, maxFreqHz);
                } else {
                    yPos = (freq - minFreqHz) / (maxFreqHz - minFreqHz);
                }
                const y = plotY + plotHeight * (1 - yPos);
                ctx.fillText(formatFrequency(freq), plotX - 10, y);
            }

            // Y-axis title
            ctx.save();
            ctx.translate(20, plotY + plotHeight / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText('Frequency (Hz)', 0, 0);
            ctx.restore();
        }

        // Time axis labels
        if (showTimeLabels) {
            const durationSeconds = (data.times[data.times.length - 1] || 0) / 1000;
            const interval = getTimeGridInterval(durationSeconds);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.font = '14px sans-serif';
            for (let t = 0; t <= durationSeconds; t += interval) {
                const x = plotX + (t / durationSeconds) * plotWidth;
                ctx.fillText(t.toFixed(t < 10 ? 1 : 0) + 's', x, plotY + plotHeight + 10);
            }

            // X-axis title
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText('Time', plotX + plotWidth / 2, height - 15);
        }

        // Draw colorbar
        if (showColorbar) {
            const colorbarX = width - rightMargin + 20;
            const colorbarWidth = 20;
            const colorbarHeight = plotHeight;

            // Draw colorbar gradient
            for (let y = 0; y < colorbarHeight; y++) {
                const normalized = 1 - y / colorbarHeight;
                const color = getColormapColor(normalized, colormap);
                ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
                ctx.fillRect(colorbarX, plotY + y, colorbarWidth, 1);
            }

            // Colorbar border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(colorbarX, plotY, colorbarWidth, colorbarHeight);

            // Colorbar labels
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            const dbTicks = 5;
            for (let i = 0; i <= dbTicks; i++) {
                const normalized = i / dbTicks;
                const dbValue = minDb + normalized * dbRange;
                const y = plotY + plotHeight * (1 - normalized);
                ctx.fillText(`${Math.round(dbValue)} dB`, colorbarX + colorbarWidth + 5, y);
            }
        }

        // Draw title
        if (showTitle) {
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(title, width / 2, 15);
        }

        // Save to file
        const filename = options?.filename ?? this.generateFilename('hifi-spectrogram');
        const outputPath = this.resolveOutputPath(filename, options?.outputPath);
        this.ensureOutputDir(outputPath);

        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);

        debugLog(`Saved high-fidelity spectrogram to: ${outputPath}`);

        const durationSeconds = (data.times[data.times.length - 1] || 0) / 1000;

        return {
            imagePath: outputPath,
            width,
            height,
            fftSize: data.fftSize,
            hopSize: data.hopSize,
            numFrames: data.numFrames,
            numBins: data.numBins,
            dbRange: { min: minDb, max: maxDb },
            frequencyRange: { min: minFreqHz, max: maxFreqHz },
            durationSeconds,
            sampleRate: data.sampleRate
        };
    }
}

// Export singleton instance
export const audioVisualizationService = new AudioVisualizationService();
