import { createCanvas } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { SpectrogramData, MelSpectrogramData, FrequencyBalanceResult, RenderOptions, AUDIO_DEFAULTS } from '../types/audio.js';

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

/**
 * AudioVisualizationService
 * Generates PNG visualizations of audio analysis data
 */
export class AudioVisualizationService {
    private defaultOutputDir: string;

    constructor(defaultOutputDir?: string) {
        const workDir = process.env.AUDIO_WORKDIR || path.join(process.cwd(), 'output', 'audio');
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
}

// Export singleton instance
export const audioVisualizationService = new AudioVisualizationService();
