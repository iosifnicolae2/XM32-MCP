/**
 * Audio Dynamics Analysis Service
 * Analyzes transients, compression needs, sibilance, and pumping artifacts
 */

import Meyda from 'meyda';
import type {
    CapturedAudio,
    TransientAnalysis,
    CompressionAssessment,
    CompressionSettings,
    SibilanceAnalysis,
    PumpingAnalysis,
    ProblemSeverity,
    AttackCharacter
} from '../types/audio.js';
import {
    calculateEnvelope,
    calculateDerivative,
    findPeaks,
    calculateRms,
    calculatePeak,
    linearToDb,
    calculateFrequencyRangeEnergy
} from '../utils/audio-dsp.js';

/**
 * Default analysis configuration
 */
const DEFAULTS = {
    fftSize: 2048,
    hopSize: 512,
    sampleRate: 44100
};

/**
 * Transient detection sensitivity thresholds
 */
const TRANSIENT_THRESHOLDS = {
    low: 0.1,
    medium: 0.05,
    high: 0.02
};

/**
 * Audio Dynamics Analysis Service
 */
export class AudioDynamicsService {
    private fftSize: number;
    private hopSize: number;

    constructor(config?: { fftSize?: number; hopSize?: number }) {
        this.fftSize = config?.fftSize ?? DEFAULTS.fftSize;
        this.hopSize = config?.hopSize ?? DEFAULTS.hopSize;
    }

    /**
     * Detect transients and analyze attack characteristics
     */
    detectTransients(audio: CapturedAudio, sensitivity: 'low' | 'medium' | 'high' = 'medium'): TransientAnalysis {
        const samples = audio.samples;
        const sampleRate = audio.sampleRate;

        // Calculate envelope with fast attack for transient detection
        const attackMs = 0.1; // Very fast attack
        const releaseMs = 50; // Moderate release
        const envelope = calculateEnvelope(samples, attackMs, releaseMs, sampleRate);

        // Calculate derivative (rate of change)
        const derivative = calculateDerivative(envelope);

        // Find peaks in derivative
        const threshold = TRANSIENT_THRESHOLDS[sensitivity];
        const minDistanceSamples = Math.floor(sampleRate * 0.05); // 50ms minimum between transients
        const transientIndices = findPeaks(derivative, threshold, minDistanceSamples);

        // Calculate attack times for each transient
        const attackTimes: number[] = [];
        for (const idx of transientIndices) {
            if (idx >= envelope.length) continue;

            const peakValue = envelope[idx];
            const attackThreshold = peakValue * 0.1; // 10% of peak

            // Find where the attack started (looking backwards)
            let attackStart = idx;
            for (let j = idx; j > 0; j--) {
                if (envelope[j] < attackThreshold) {
                    attackStart = j;
                    break;
                }
            }

            const attackSamples = idx - attackStart;
            const attackMs = (attackSamples / sampleRate) * 1000;
            if (attackMs > 0 && attackMs < 100) {
                // Reasonable attack time
                attackTimes.push(attackMs);
            }
        }

        const transientCount = transientIndices.length;
        const durationSec = samples.length / sampleRate;
        const transientDensityPerSecond = transientCount / durationSec;

        const averageAttackMs = attackTimes.length > 0 ? attackTimes.reduce((a, b) => a + b, 0) / attackTimes.length : 0;
        const peakAttackMs = attackTimes.length > 0 ? Math.min(...attackTimes) : 0;

        // Determine attack character
        let attackCharacter: AttackCharacter;
        if (averageAttackMs < 5) {
            attackCharacter = 'sharp';
        } else if (averageAttackMs < 20) {
            attackCharacter = 'medium';
        } else {
            attackCharacter = 'soft';
        }

        // Convert transient indices to milliseconds
        const transientLocationsMs = transientIndices
            .slice(0, 50) // Limit to first 50 for readability
            .map(idx => Math.round((idx / sampleRate) * 1000));

        // Generate recommendation
        const recommendation = this.generateTransientRecommendation(attackCharacter, averageAttackMs, transientDensityPerSecond);

        return {
            transientCount,
            transientDensityPerSecond: Math.round(transientDensityPerSecond * 10) / 10,
            averageAttackMs: Math.round(averageAttackMs * 100) / 100,
            peakAttackMs: Math.round(peakAttackMs * 100) / 100,
            attackCharacter,
            transientLocationsMs,
            recommendation
        };
    }

    /**
     * Generate recommendation based on transient analysis
     */
    private generateTransientRecommendation(attackCharacter: AttackCharacter, averageAttackMs: number, density: number): string {
        const parts: string[] = [];

        if (attackCharacter === 'sharp') {
            parts.push(`Sharp transients detected (${averageAttackMs.toFixed(1)}ms average attack).`);
            parts.push('Use fast attack (1-5ms) to control peaks, or slow attack (20-50ms) to preserve punch.');
        } else if (attackCharacter === 'medium') {
            parts.push(`Medium transients detected (${averageAttackMs.toFixed(1)}ms average attack).`);
            parts.push('Use attack time around 10-20ms for balanced compression.');
        } else {
            parts.push(`Soft transients detected (${averageAttackMs.toFixed(1)}ms average attack).`);
            parts.push('Slower attack (20-50ms) works well. Consider parallel compression for added punch.');
        }

        if (density > 10) {
            parts.push(`High transient density (${density.toFixed(1)}/sec) - consider faster release to recover between hits.`);
        } else if (density < 2) {
            parts.push(`Low transient density (${density.toFixed(1)}/sec) - slower release times will sound more natural.`);
        }

        return parts.join(' ');
    }

    /**
     * Assess compression needs and suggest settings
     */
    assessCompressionNeed(audio: CapturedAudio, targetDynamicRangeDb: number = 12): CompressionAssessment {
        const samples = audio.samples;
        const sampleRate = audio.sampleRate;

        // Calculate dynamics metrics
        const peak = calculatePeak(samples);
        const rms = calculateRms(samples);
        const peakDb = linearToDb(peak);
        const rmsDb = linearToDb(rms);

        // Dynamic range (simplified: difference between peak and average RMS)
        // For more accuracy, we calculate percentile-based range
        const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
        const numWindows = Math.floor(samples.length / windowSize);
        const windowRms: number[] = [];

        for (let i = 0; i < numWindows; i++) {
            const start = i * windowSize;
            const window = samples.slice(start, start + windowSize);
            const rms = calculateRms(window);
            if (rms > 0) {
                windowRms.push(linearToDb(rms));
            }
        }

        windowRms.sort((a, b) => a - b);
        const p10 = windowRms[Math.floor(windowRms.length * 0.1)] ?? rmsDb;
        const p90 = windowRms[Math.floor(windowRms.length * 0.9)] ?? peakDb;
        const dynamicRangeDb = p90 - p10;

        // Peak to average ratio
        const peakToAverageRatio = peak / (rms || 0.0001);
        const crestFactorDb = peakDb - rmsDb;

        // Determine if compression is needed
        let needsCompression = false;
        let compressionUrgency: 'none' | 'optional' | 'recommended' | 'essential' = 'none';

        if (dynamicRangeDb > targetDynamicRangeDb + 12) {
            needsCompression = true;
            compressionUrgency = 'essential';
        } else if (dynamicRangeDb > targetDynamicRangeDb + 6) {
            needsCompression = true;
            compressionUrgency = 'recommended';
        } else if (dynamicRangeDb > targetDynamicRangeDb) {
            needsCompression = true;
            compressionUrgency = 'optional';
        }

        // Calculate suggested compression settings
        const suggestedSettings = this.calculateCompressionSettings(dynamicRangeDb, targetDynamicRangeDb, peakDb, rmsDb);

        // Generate recommendation
        const recommendation = this.generateCompressionRecommendation(
            dynamicRangeDb,
            targetDynamicRangeDb,
            compressionUrgency,
            suggestedSettings
        );

        return {
            dynamicRangeDb: Math.round(dynamicRangeDb * 10) / 10,
            peakToAverageRatio: Math.round(peakToAverageRatio * 100) / 100,
            crestFactorDb: Math.round(crestFactorDb * 10) / 10,
            needsCompression,
            compressionUrgency,
            suggestedSettings,
            recommendation
        };
    }

    /**
     * Calculate suggested compression settings
     */
    private calculateCompressionSettings(
        dynamicRangeDb: number,
        targetDynamicRangeDb: number,
        peakDb: number,
        rmsDb: number
    ): CompressionSettings {
        const reductionNeeded = dynamicRangeDb - targetDynamicRangeDb;

        // Calculate ratio based on reduction needed
        let ratio: string;
        if (reductionNeeded > 12) {
            ratio = '8:1';
        } else if (reductionNeeded > 8) {
            ratio = '4:1';
        } else if (reductionNeeded > 4) {
            ratio = '3:1';
        } else {
            ratio = '2:1';
        }

        // Threshold: typically set so loudest parts get compressed
        // Aim for 3-6dB of gain reduction on peaks
        const thresholdDb = Math.round((rmsDb + (peakDb - rmsDb) / 2) * 10) / 10;

        // Attack and release based on material (these are starting points)
        const attackMs = 10; // Medium attack
        const releaseMs = 100; // Medium release

        // Makeup gain to compensate for compression
        const avgReduction = reductionNeeded / 2;
        const makeupGainDb = Math.round(avgReduction * 10) / 10;

        return {
            ratio,
            thresholdDb,
            attackMs,
            releaseMs,
            makeupGainDb
        };
    }

    /**
     * Generate compression recommendation
     */
    private generateCompressionRecommendation(
        dynamicRangeDb: number,
        targetDynamicRangeDb: number,
        urgency: 'none' | 'optional' | 'recommended' | 'essential',
        settings: CompressionSettings
    ): string {
        if (urgency === 'none') {
            return `Dynamic range (${dynamicRangeDb.toFixed(1)}dB) is within target (${targetDynamicRangeDb}dB). Compression is optional for character only.`;
        }

        const parts: string[] = [];
        parts.push(`Dynamic range is ${dynamicRangeDb.toFixed(1)}dB (target: ${targetDynamicRangeDb}dB).`);

        if (urgency === 'essential') {
            parts.push('Compression is essential to control dynamics.');
        } else if (urgency === 'recommended') {
            parts.push('Compression is recommended for consistency.');
        } else {
            parts.push('Light compression may help with consistency.');
        }

        parts.push(
            `Try: ${settings.ratio} ratio, ${settings.thresholdDb}dB threshold, ${settings.attackMs}ms attack, ${settings.releaseMs}ms release.`
        );

        return parts.join(' ');
    }

    /**
     * Detect sibilance in audio (typically vocals)
     */
    detectSibilance(audio: CapturedAudio): SibilanceAnalysis {
        const samples = audio.samples;
        const sampleRate = audio.sampleRate;

        const sibilanceBand = { min: 5000, max: 8000 };
        const referenceBand = { min: 2000, max: 4000 }; // Presence for comparison

        const numFrames = Math.floor((samples.length - this.fftSize) / this.hopSize);
        if (numFrames <= 0) {
            return {
                hasSibilance: false,
                severity: 'none',
                sibilantFramePercentage: 0,
                peakFrequencyHz: 6000,
                averageEnergyDb: -100,
                recommendation: 'Audio too short for sibilance analysis.'
            };
        }

        let sibilantFrames = 0;
        let totalSibilanceEnergy = 0;

        for (let frame = 0; frame < numFrames; frame++) {
            const start = frame * this.hopSize;
            const frameData = samples.slice(start, start + this.fftSize);

            const features = Meyda.extract(['amplitudeSpectrum'], frameData);

            if (features && features.amplitudeSpectrum) {
                const spectrum = features.amplitudeSpectrum as number[] | Float32Array;

                const sibilanceEnergy = calculateFrequencyRangeEnergy(
                    spectrum as Float32Array,
                    sibilanceBand.min,
                    sibilanceBand.max,
                    this.fftSize,
                    sampleRate
                );

                const presenceEnergy = calculateFrequencyRangeEnergy(
                    spectrum as Float32Array,
                    referenceBand.min,
                    referenceBand.max,
                    this.fftSize,
                    sampleRate
                );

                totalSibilanceEnergy += sibilanceEnergy;

                // Sibilance detected when 5-8kHz significantly exceeds presence
                const ratio = sibilanceEnergy / (presenceEnergy || 0.0001);
                if (ratio > 2.0) {
                    sibilantFrames++;
                }
            }
        }

        const sibilantFramePercentage = (sibilantFrames / numFrames) * 100;
        const averageEnergyDb = linearToDb(Math.sqrt(totalSibilanceEnergy / numFrames));

        // Determine severity
        let severity: ProblemSeverity = 'none';
        let hasSibilance = false;
        if (sibilantFramePercentage > 30) {
            severity = 'severe';
            hasSibilance = true;
        } else if (sibilantFramePercentage > 15) {
            severity = 'moderate';
            hasSibilance = true;
        } else if (sibilantFramePercentage > 5) {
            severity = 'mild';
            hasSibilance = true;
        }

        // Estimate peak frequency (simplified)
        const peakFrequencyHz = 6500; // Common sibilance peak

        // De-esser settings if needed
        const deEsserSettings = hasSibilance
            ? {
                  frequencyHz: peakFrequencyHz,
                  thresholdDb: severity === 'severe' ? -20 : severity === 'moderate' ? -25 : -30,
                  rangeDb: severity === 'severe' ? 8 : severity === 'moderate' ? 6 : 4
              }
            : undefined;

        // Generate recommendation
        let recommendation: string;
        if (!hasSibilance) {
            recommendation = 'No significant sibilance detected. De-esser not required.';
        } else if (severity === 'severe') {
            recommendation = `Severe sibilance detected (${sibilantFramePercentage.toFixed(1)}% of frames). Apply de-esser at ${peakFrequencyHz}Hz with ${deEsserSettings?.rangeDb}dB range.`;
        } else if (severity === 'moderate') {
            recommendation = `Moderate sibilance detected. Apply de-esser at ${peakFrequencyHz}Hz with ${deEsserSettings?.rangeDb}dB range. Consider split-band processing.`;
        } else {
            recommendation = `Mild sibilance detected. Light de-essing at ${peakFrequencyHz}Hz may improve clarity.`;
        }

        return {
            hasSibilance,
            severity,
            sibilantFramePercentage: Math.round(sibilantFramePercentage * 10) / 10,
            peakFrequencyHz,
            averageEnergyDb: Math.round(averageEnergyDb * 10) / 10,
            deEsserSettings,
            recommendation
        };
    }

    /**
     * Detect compression pumping/breathing artifacts
     */
    detectPumping(audio: CapturedAudio): PumpingAnalysis {
        const samples = audio.samples;
        const sampleRate = audio.sampleRate;

        // Calculate envelope with settings typical of problematic compression
        const attackMs = 10;
        const releaseMs = 100;
        const envelope = calculateEnvelope(samples, attackMs, releaseMs, sampleRate);

        // Analyze envelope for rhythmic fluctuations
        const windowSize = Math.floor(sampleRate * 0.5); // 500ms windows
        const numWindows = Math.floor(envelope.length / windowSize);

        if (numWindows < 4) {
            return {
                hasPumping: false,
                severity: 'none',
                pumpingRateHz: 0,
                modulationDepthDb: 0,
                recommendation: 'Audio too short for pumping analysis.'
            };
        }

        const windowAverages: number[] = [];
        for (let i = 0; i < numWindows; i++) {
            const start = i * windowSize;
            const windowData = envelope.slice(start, start + windowSize);
            const avg = Array.from(windowData).reduce((a, b) => a + b, 0) / windowData.length;
            windowAverages.push(avg);
        }

        // Look for periodic fluctuations
        let maxModulation = 0;
        let fluctuationCount = 0;

        for (let i = 1; i < windowAverages.length; i++) {
            const diff = Math.abs(linearToDb(windowAverages[i]) - linearToDb(windowAverages[i - 1]));
            if (diff > 3) {
                // 3dB swing
                fluctuationCount++;
                if (diff > maxModulation) {
                    maxModulation = diff;
                }
            }
        }

        const fluctuationRate = fluctuationCount / (samples.length / sampleRate);
        const hasPumping = fluctuationRate > 0.5 && maxModulation > 4;

        // Determine severity
        let severity: ProblemSeverity = 'none';
        if (maxModulation > 8 && fluctuationRate > 1) {
            severity = 'severe';
        } else if (maxModulation > 6 || fluctuationRate > 0.8) {
            severity = 'moderate';
        } else if (hasPumping) {
            severity = 'mild';
        }

        // Generate recommendation
        let recommendation: string;
        if (!hasPumping) {
            recommendation = 'No compression pumping detected. Dynamics processing sounds natural.';
        } else if (severity === 'severe') {
            recommendation = `Severe pumping detected (${maxModulation.toFixed(1)}dB swings). Increase release time, raise threshold, or reduce ratio.`;
        } else if (severity === 'moderate') {
            recommendation = `Moderate pumping detected. Try longer release time or lower ratio. Consider parallel compression instead.`;
        } else {
            recommendation = 'Mild pumping detected. Fine-tune release time to match tempo for more natural sound.';
        }

        return {
            hasPumping,
            severity,
            pumpingRateHz: Math.round(fluctuationRate * 100) / 100,
            modulationDepthDb: Math.round(maxModulation * 10) / 10,
            recommendation
        };
    }
}
