import Meyda from 'meyda';
import type { MeydaFeaturesObject, MeydaAudioFeature } from 'meyda';
import type {
    CapturedAudio,
    SpectrogramData,
    MelSpectrogramData,
    FrequencyBalanceResult,
    SpectrumAnalysisResult,
    LoudnessResult,
    BrightnessResult,
    HarshnessResult,
    MaskingResult,
    MaskingIssue,
    AnalysisMetadata,
    AUDIO_DEFAULTS
} from '../types/audio.js';
import {
    STANDARD_FREQUENCY_BANDS,
    analyzeFrequencyBalance,
    calculateBalanceScore,
    findDominantBand,
    generateBalanceRecommendation
} from '../utils/frequency-bands.js';

// Debug logging
const DEBUG = process.env.DEBUG?.includes('audio') || process.env.DEBUG?.includes('analysis') || process.env.DEBUG === '*';

const debugLog = (...args: unknown[]) => {
    if (DEBUG) {
        console.error('[AudioAnalysis]', ...args);
    }
};

/**
 * Check if value is array-like (Array or TypedArray like Float32Array)
 * Meyda returns Float32Array for spectrum data, which fails Array.isArray()
 */
function isArrayLike(value: unknown): value is ArrayLike<number> {
    return (
        value !== null &&
        typeof value === 'object' &&
        'length' in value &&
        typeof (value as { length: unknown }).length === 'number' &&
        (value as { length: number }).length > 0
    );
}

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
 * AudioAnalysisService
 * Performs audio analysis using Meyda for feature extraction
 */
export class AudioAnalysisService {
    private fftSize: number;
    private hopSize: number;
    private sampleRate: number;
    private numMelBands: number;

    constructor(config?: { fftSize?: number; hopSize?: number; sampleRate?: number; numMelBands?: number }) {
        this.fftSize = config?.fftSize ?? DEFAULTS.fftSize;
        this.hopSize = config?.hopSize ?? DEFAULTS.hopSize;
        this.sampleRate = config?.sampleRate ?? DEFAULTS.sampleRate;
        this.numMelBands = config?.numMelBands ?? DEFAULTS.numMelBands;

        // Configure Meyda
        Meyda.bufferSize = this.fftSize;
        Meyda.sampleRate = this.sampleRate;
        Meyda.melBands = this.numMelBands;
        Meyda.numberOfMFCCCoefficients = 13;
    }

    /**
     * Update sample rate configuration
     */
    setSampleRate(sampleRate: number): void {
        this.sampleRate = sampleRate;
        Meyda.sampleRate = sampleRate;
    }

    /**
     * Compute STFT spectrogram from audio data
     */
    computeSpectrogram(audio: CapturedAudio): SpectrogramData {
        const { samples, sampleRate } = audio;
        this.setSampleRate(sampleRate);

        const numFrames = Math.floor((samples.length - this.fftSize) / this.hopSize) + 1;
        const numBins = this.fftSize / 2;
        const magnitudes: Float32Array[] = [];
        const times: number[] = [];
        const frequencies: number[] = [];

        // Calculate frequency bin centers
        for (let i = 0; i < numBins; i++) {
            frequencies.push((i * sampleRate) / this.fftSize);
        }

        debugLog(`Computing spectrogram: ${numFrames} frames, ${numBins} bins`);

        // Process each frame
        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * this.hopSize;
            const endSample = startSample + this.fftSize;
            const frameData = samples.slice(startSample, endSample);

            // Extract amplitude spectrum using Meyda
            const features = Meyda.extract(['amplitudeSpectrum'], frameData);
            if (features && isArrayLike(features.amplitudeSpectrum)) {
                magnitudes.push(new Float32Array(features.amplitudeSpectrum));
            } else {
                magnitudes.push(new Float32Array(numBins));
            }

            times.push((startSample / sampleRate) * 1000); // Time in ms
        }

        return {
            magnitudes,
            frequencies,
            times,
            fftSize: this.fftSize,
            hopSize: this.hopSize,
            sampleRate,
            numBins,
            numFrames
        };
    }

    /**
     * Compute STFT spectrogram with configurable FFT size
     * @param audio Audio data to analyze
     * @param customFftSize Optional custom FFT size (1024, 2048, 4096, 8192)
     * @param hopFraction Hop size as fraction of FFT (default: 0.25 for 75% overlap)
     */
    computeSpectrogramWithConfig(
        audio: CapturedAudio,
        customFftSize?: 1024 | 2048 | 4096 | 8192,
        hopFraction: number = 0.25
    ): SpectrogramData {
        const { samples, sampleRate } = audio;

        // Use custom FFT size or fall back to default
        const fftSize = customFftSize ?? this.fftSize;
        const hopSize = Math.floor(fftSize * hopFraction);

        // Temporarily update Meyda buffer size
        const originalBufferSize = Meyda.bufferSize;
        Meyda.bufferSize = fftSize;
        Meyda.sampleRate = sampleRate;

        const numFrames = Math.floor((samples.length - fftSize) / hopSize) + 1;
        const numBins = fftSize / 2;
        const magnitudes: Float32Array[] = [];
        const times: number[] = [];
        const frequencies: number[] = [];

        // Calculate frequency bin centers
        for (let i = 0; i < numBins; i++) {
            frequencies.push((i * sampleRate) / fftSize);
        }

        debugLog(`Computing HiFi spectrogram: ${numFrames} frames, ${numBins} bins, FFT ${fftSize}, hop ${hopSize}`);

        // Process each frame
        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * hopSize;
            const endSample = startSample + fftSize;
            const frameData = samples.slice(startSample, endSample);

            // Extract amplitude spectrum using Meyda
            const features = Meyda.extract(['amplitudeSpectrum'], frameData);
            if (features && isArrayLike(features.amplitudeSpectrum)) {
                magnitudes.push(new Float32Array(features.amplitudeSpectrum));
            } else {
                magnitudes.push(new Float32Array(numBins));
            }

            times.push((startSample / sampleRate) * 1000); // Time in ms
        }

        // Restore original buffer size
        Meyda.bufferSize = originalBufferSize;

        return {
            magnitudes,
            frequencies,
            times,
            fftSize,
            hopSize,
            sampleRate,
            numBins,
            numFrames
        };
    }

    /**
     * Compute mel-spectrogram from audio data
     */
    computeMelSpectrogram(audio: CapturedAudio): MelSpectrogramData {
        const { samples, sampleRate } = audio;
        this.setSampleRate(sampleRate);

        const numFrames = Math.floor((samples.length - this.fftSize) / this.hopSize) + 1;
        const melBands: Float32Array[] = [];
        const times: number[] = [];

        debugLog(`Computing mel-spectrogram: ${numFrames} frames, ${this.numMelBands} mel bands`);

        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * this.hopSize;
            const endSample = startSample + this.fftSize;
            const frameData = samples.slice(startSample, endSample);

            // Meyda's melBands feature
            const features = Meyda.extract(['melBands'], frameData);
            if (features && isArrayLike(features.melBands)) {
                melBands.push(new Float32Array(features.melBands as ArrayLike<number>));
            } else {
                melBands.push(new Float32Array(this.numMelBands));
            }

            times.push((startSample / sampleRate) * 1000);
        }

        return {
            melBands,
            numMelBands: this.numMelBands,
            times,
            minFreq: 20,
            maxFreq: sampleRate / 2,
            sampleRate,
            numFrames
        };
    }

    /**
     * Extract multiple features for a single buffer
     */
    extractFeatures(samples: Float32Array, featuresToExtract: MeydaAudioFeature[]): Partial<MeydaFeaturesObject> | null {
        if (samples.length < this.fftSize) {
            debugLog(`Warning: Buffer too small (${samples.length} < ${this.fftSize})`);
            return null;
        }

        // Use only the first fftSize samples
        const buffer = samples.slice(0, this.fftSize);
        return Meyda.extract(featuresToExtract, buffer);
    }

    /**
     * Analyze frequency balance using standard bands
     */
    analyzeFrequencyBalance(audio: CapturedAudio): FrequencyBalanceResult {
        const { samples, sampleRate } = audio;
        this.setSampleRate(sampleRate);

        // Get average spectrum across all frames
        const numFrames = Math.floor((samples.length - this.fftSize) / this.hopSize) + 1;
        const numBins = this.fftSize / 2;
        const avgSpectrum = new Float32Array(numBins);

        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * this.hopSize;
            const frameData = samples.slice(startSample, startSample + this.fftSize);

            const features = Meyda.extract(['amplitudeSpectrum'], frameData);
            if (features && isArrayLike(features.amplitudeSpectrum)) {
                const spectrum = features.amplitudeSpectrum as ArrayLike<number>;
                for (let i = 0; i < numBins && i < spectrum.length; i++) {
                    avgSpectrum[i] += spectrum[i];
                }
            }
        }

        // Normalize
        for (let i = 0; i < numBins; i++) {
            avgSpectrum[i] /= numFrames;
        }

        // Analyze using frequency bands utility
        const bandEnergies = analyzeFrequencyBalance(avgSpectrum, STANDARD_FREQUENCY_BANDS, this.fftSize, sampleRate);

        return {
            bands: bandEnergies,
            dominantBand: findDominantBand(bandEnergies),
            balanceScore: calculateBalanceScore(bandEnergies),
            recommendation: generateBalanceRecommendation(bandEnergies)
        };
    }

    /**
     * Measure loudness (RMS and peak)
     */
    measureLoudness(audio: CapturedAudio): LoudnessResult {
        const { samples, sampleRate } = audio;
        this.setSampleRate(sampleRate);

        const numFrames = Math.floor((samples.length - this.fftSize) / this.hopSize) + 1;
        let rmsSum = 0;
        let peakLinear = 0;
        let rmsMax = 0;
        let rmsMin = Infinity;

        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * this.hopSize;
            const frameData = samples.slice(startSample, startSample + this.fftSize);

            const features = Meyda.extract(['rms'], frameData);
            if (features && typeof features.rms === 'number') {
                rmsSum += features.rms;
                rmsMax = Math.max(rmsMax, features.rms);
                rmsMin = Math.min(rmsMin, features.rms);
            }

            // Find peak sample in frame
            for (let i = 0; i < frameData.length; i++) {
                const absVal = Math.abs(frameData[i]);
                if (absVal > peakLinear) {
                    peakLinear = absVal;
                }
            }
        }

        const rmsLinear = rmsSum / numFrames;
        const rmsDb = rmsLinear > 0 ? 20 * Math.log10(rmsLinear) : -100;
        const peakDb = peakLinear > 0 ? 20 * Math.log10(peakLinear) : -100;
        const dynamicRangeDb = peakDb - rmsDb;
        const crestFactor = peakLinear / (rmsLinear || 1);

        return {
            rmsDb: Math.round(rmsDb * 10) / 10,
            peakDb: Math.round(peakDb * 10) / 10,
            dynamicRangeDb: Math.round(dynamicRangeDb * 10) / 10,
            crestFactor: Math.round(crestFactor * 100) / 100,
            rmsLinear,
            peakLinear
        };
    }

    /**
     * Analyze brightness (spectral centroid)
     */
    analyzeBrightness(audio: CapturedAudio): BrightnessResult {
        const { samples, sampleRate } = audio;
        this.setSampleRate(sampleRate);

        const numFrames = Math.floor((samples.length - this.fftSize) / this.hopSize) + 1;
        const centroids: number[] = [];

        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * this.hopSize;
            const frameData = samples.slice(startSample, startSample + this.fftSize);

            const features = Meyda.extract(['spectralCentroid'], frameData);
            if (features && typeof features.spectralCentroid === 'number') {
                // Meyda returns normalized centroid (0-1), convert to Hz
                const centroidHz = (features.spectralCentroid * sampleRate) / 2;
                centroids.push(centroidHz);
            }
        }

        if (centroids.length === 0) {
            return {
                centroidHz: 0,
                normalizedBrightness: 0,
                trend: 'neutral',
                average: 0,
                min: 0,
                max: 0
            };
        }

        const average = centroids.reduce((a, b) => a + b, 0) / centroids.length;
        const min = Math.min(...centroids);
        const max = Math.max(...centroids);

        // Normalize to 0-1 (assuming max frequency is Nyquist)
        const nyquist = sampleRate / 2;
        const normalizedBrightness = average / nyquist;

        // Determine trend
        let trend: 'bright' | 'neutral' | 'warm';
        if (normalizedBrightness > 0.3) {
            trend = 'bright';
        } else if (normalizedBrightness < 0.15) {
            trend = 'warm';
        } else {
            trend = 'neutral';
        }

        let recommendation: string | undefined;
        if (trend === 'bright') {
            recommendation = 'Audio is bright/treble-heavy. Consider reducing high frequencies if too harsh.';
        } else if (trend === 'warm') {
            recommendation = 'Audio is warm/bass-heavy. Consider adding high frequency content for more clarity.';
        }

        return {
            centroidHz: Math.round(average),
            normalizedBrightness: Math.round(normalizedBrightness * 1000) / 1000,
            trend,
            average: Math.round(average),
            min: Math.round(min),
            max: Math.round(max),
            recommendation
        };
    }

    /**
     * Analyze harshness (spectral flux)
     * Spectral flux measures the change in spectrum between consecutive frames
     */
    analyzeHarshness(audio: CapturedAudio): HarshnessResult {
        const { samples, sampleRate } = audio;
        this.setSampleRate(sampleRate);

        const numFrames = Math.floor((samples.length - this.fftSize) / this.hopSize) + 1;
        const fluxValues: number[] = [];

        // Store previous spectrum for flux calculation
        // Meyda.extract('spectralFlux') requires internal state we don't have,
        // so we calculate it manually by comparing consecutive amplitude spectra
        let prevSpectrum: Float32Array | null = null;

        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * this.hopSize;
            const frameData = samples.slice(startSample, startSample + this.fftSize);

            const features = Meyda.extract(['amplitudeSpectrum'], frameData);
            if (features && isArrayLike(features.amplitudeSpectrum)) {
                const currentSpectrum = new Float32Array(features.amplitudeSpectrum);

                if (prevSpectrum !== null) {
                    // Calculate spectral flux: sum of positive differences
                    let flux = 0;
                    for (let i = 0; i < currentSpectrum.length && i < prevSpectrum.length; i++) {
                        const diff = currentSpectrum[i] - prevSpectrum[i];
                        if (diff > 0) {
                            flux += diff;
                        }
                    }
                    // Normalize by spectrum length
                    flux /= currentSpectrum.length;
                    fluxValues.push(flux);
                }

                prevSpectrum = currentSpectrum;
            }
        }

        if (fluxValues.length === 0) {
            return {
                fluxAverage: 0,
                fluxPeak: 0,
                fluxValues: [],
                harshFrequencies: [],
                harshnessTrend: 'smooth'
            };
        }

        const fluxAverage = fluxValues.reduce((a, b) => a + b, 0) / fluxValues.length;
        const fluxPeak = Math.max(...fluxValues);

        // Determine harshness trend
        let harshnessTrend: 'smooth' | 'moderate' | 'harsh';
        let recommendation: string | undefined;

        if (fluxAverage > 0.5) {
            harshnessTrend = 'harsh';
            recommendation =
                'High spectral flux detected. Audio may contain harsh transients or distortion. Consider compression or de-essing.';
        } else if (fluxAverage > 0.2) {
            harshnessTrend = 'moderate';
            recommendation = 'Moderate spectral variation. Audio has good dynamics.';
        } else {
            harshnessTrend = 'smooth';
        }

        // Identify potentially harsh frequency regions (2-4 kHz typically)
        const harshFrequencies: number[] = [];
        if (harshnessTrend !== 'smooth') {
            harshFrequencies.push(2500, 3000, 3500, 4000);
        }

        return {
            fluxAverage: Math.round(fluxAverage * 1000) / 1000,
            fluxPeak: Math.round(fluxPeak * 1000) / 1000,
            fluxValues,
            harshFrequencies,
            harshnessTrend,
            recommendation
        };
    }

    /**
     * Detect frequency masking using MFCC analysis
     */
    detectMasking(audio: CapturedAudio): MaskingResult {
        const { samples, sampleRate } = audio;
        this.setSampleRate(sampleRate);

        const numFrames = Math.floor((samples.length - this.fftSize) / this.hopSize) + 1;
        const mfccFrames: number[][] = [];

        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * this.hopSize;
            const frameData = samples.slice(startSample, startSample + this.fftSize);

            const features = Meyda.extract(['mfcc'], frameData);
            if (features && isArrayLike(features.mfcc)) {
                mfccFrames.push(Array.from(features.mfcc as ArrayLike<number>));
            }
        }

        if (mfccFrames.length === 0) {
            return {
                mfccCoefficients: [],
                potentialMasking: [],
                overallMaskingRisk: 'low'
            };
        }

        // Analyze MFCC variance to detect potential masking
        const numCoeffs = mfccFrames[0].length;
        const coeffVariances: number[] = [];

        for (let i = 0; i < numCoeffs; i++) {
            const values = mfccFrames.map(frame => frame[i]);
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
            coeffVariances.push(variance);
        }

        // Identify potential masking issues based on low variance in certain bands
        const potentialMasking: MaskingIssue[] = [];

        // Low variance in certain MFCC coefficients can indicate masking
        const lowVarianceThreshold = 0.1;
        for (let i = 1; i < numCoeffs; i++) {
            // Skip first coefficient (energy)
            if (coeffVariances[i] < lowVarianceThreshold) {
                const freqRange = this.mfccCoefficientToFrequencyRange(i, sampleRate);
                potentialMasking.push({
                    frequencyRange: freqRange,
                    severity: coeffVariances[i] < 0.05 ? 'high' : 'medium',
                    description: `Low variation in frequency range ${freqRange.min}-${freqRange.max} Hz may indicate frequency masking.`
                });
            }
        }

        // Determine overall masking risk
        let overallMaskingRisk: 'low' | 'medium' | 'high';
        const highSeverityCount = potentialMasking.filter(m => m.severity === 'high').length;

        if (highSeverityCount >= 2) {
            overallMaskingRisk = 'high';
        } else if (potentialMasking.length >= 2) {
            overallMaskingRisk = 'medium';
        } else {
            overallMaskingRisk = 'low';
        }

        let recommendation: string | undefined;
        if (overallMaskingRisk !== 'low') {
            recommendation =
                'Potential frequency masking detected. Consider using EQ to separate overlapping instruments, or try panning elements apart.';
        }

        return {
            mfccCoefficients: mfccFrames,
            potentialMasking,
            overallMaskingRisk,
            recommendation
        };
    }

    /**
     * Approximate frequency range for an MFCC coefficient
     * This is a rough approximation since MFCC uses mel scale
     */
    private mfccCoefficientToFrequencyRange(coefficient: number, sampleRate: number): { min: number; max: number } {
        const nyquist = sampleRate / 2;
        const numCoeffs = Meyda.numberOfMFCCCoefficients;

        // Rough approximation using mel scale
        const melMax = 2595 * Math.log10(1 + nyquist / 700);
        const bandWidth = melMax / numCoeffs;

        const melMin = coefficient * bandWidth;
        const melMaxBand = (coefficient + 1) * bandWidth;

        // Convert mel back to Hz
        const freqMin = 700 * (Math.pow(10, melMin / 2595) - 1);
        const freqMax = 700 * (Math.pow(10, melMaxBand / 2595) - 1);

        return {
            min: Math.round(freqMin),
            max: Math.round(freqMax)
        };
    }

    /**
     * Perform full spectrum analysis
     */
    analyzeSpectrum(audio: CapturedAudio): Omit<SpectrumAnalysisResult, 'images'> {
        debugLog(`Analyzing audio: ${audio.durationMs}ms, ${audio.sampleRate}Hz`);

        const spectrogram = this.computeSpectrogram(audio);
        const melSpectrogram = this.computeMelSpectrogram(audio);
        const frequencyBalance = this.analyzeFrequencyBalance(audio);

        // Extract features for full audio
        const numFrames = spectrogram.numFrames;
        let spectralCentroidAvg = 0;
        let spectralFlatnessAvg = 0;
        let spectralFluxAvg = 0;
        let spectralSpreadAvg = 0;
        let spectralRolloffAvg = 0;
        let rmsAvg = 0;

        // Track previous spectrum for flux calculation
        let prevSpectrum: Float32Array | null = null;

        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * this.hopSize;
            const frameData = audio.samples.slice(startSample, startSample + this.fftSize);

            // Extract features without spectralFlux (requires previous frame state)
            const features = Meyda.extract(
                ['spectralCentroid', 'spectralFlatness', 'spectralSpread', 'spectralRolloff', 'rms', 'amplitudeSpectrum'],
                frameData
            );

            if (features) {
                spectralCentroidAvg += features.spectralCentroid ?? 0;
                spectralFlatnessAvg += features.spectralFlatness ?? 0;
                spectralSpreadAvg += features.spectralSpread ?? 0;
                spectralRolloffAvg += features.spectralRolloff ?? 0;
                rmsAvg += features.rms ?? 0;

                // Calculate spectral flux manually
                if (isArrayLike(features.amplitudeSpectrum)) {
                    const currentSpectrum = new Float32Array(features.amplitudeSpectrum);
                    if (prevSpectrum !== null) {
                        let flux = 0;
                        for (let i = 0; i < currentSpectrum.length && i < prevSpectrum.length; i++) {
                            const diff = currentSpectrum[i] - prevSpectrum[i];
                            if (diff > 0) {
                                flux += diff;
                            }
                        }
                        flux /= currentSpectrum.length;
                        spectralFluxAvg += flux;
                    }
                    prevSpectrum = currentSpectrum;
                }
            }
        }

        // Normalize averages
        spectralCentroidAvg /= numFrames;
        spectralFlatnessAvg /= numFrames;
        spectralFluxAvg /= numFrames;
        spectralSpreadAvg /= numFrames;
        spectralRolloffAvg /= numFrames;
        rmsAvg /= numFrames;

        const metadata: AnalysisMetadata = {
            capturedAt: audio.capturedAt,
            durationMs: audio.durationMs,
            sampleRate: audio.sampleRate,
            deviceName: audio.deviceName,
            fftSize: this.fftSize,
            hopSize: this.hopSize
        };

        return {
            spectrogram,
            melSpectrogram,
            features: {
                spectralCentroid: {
                    feature: 'spectralCentroid',
                    values: spectralCentroidAvg,
                    average: spectralCentroidAvg,
                    unit: 'normalized (0-1)',
                    description: 'Brightness indicator (0 = bass-heavy, 1 = treble-heavy)'
                },
                spectralFlatness: {
                    feature: 'spectralFlatness',
                    values: spectralFlatnessAvg,
                    average: spectralFlatnessAvg,
                    unit: 'ratio (0-1)',
                    description: 'Tone vs noise (0 = pure tone, 1 = white noise)'
                },
                spectralFlux: {
                    feature: 'spectralFlux',
                    values: spectralFluxAvg,
                    average: spectralFluxAvg,
                    unit: 'normalized',
                    description: 'Rate of spectral change (higher = more dynamic)'
                },
                spectralSpread: {
                    feature: 'spectralSpread',
                    values: spectralSpreadAvg,
                    average: spectralSpreadAvg,
                    unit: 'normalized',
                    description: 'Frequency bandwidth distribution'
                },
                spectralRolloff: {
                    feature: 'spectralRolloff',
                    values: spectralRolloffAvg,
                    average: spectralRolloffAvg,
                    unit: 'normalized',
                    description: 'Frequency below which 99% of energy resides'
                },
                rms: {
                    feature: 'rms',
                    values: rmsAvg,
                    average: rmsAvg,
                    unit: 'linear',
                    description: 'Root mean square (loudness)'
                }
            },
            frequencyBalance,
            metadata
        };
    }
}

// Export singleton instance
export const audioAnalysisService = new AudioAnalysisService();
