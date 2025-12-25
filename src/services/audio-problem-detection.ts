/**
 * Audio Problem Detection Service
 * Detects common mixing problems: muddy, harsh, boxy, thin, nasal, rumble, clipping, noise
 */

import Meyda from 'meyda';
import type {
    CapturedAudio,
    AudioProblem,
    AudioProblemType,
    ProblemSeverity,
    AudioProblemsReport,
    ClippingAnalysis,
    NoiseFloorAnalysis
} from '../types/audio.js';
import { PROBLEM_FREQUENCY_BANDS, calculateBandEnergy } from '../utils/frequency-bands.js';
import { calculateRms, calculatePeak, linearToDb, calculateTotalEnergy } from '../utils/audio-dsp.js';

/**
 * Default analysis configuration
 */
const DEFAULTS = {
    fftSize: 2048,
    hopSize: 512,
    sampleRate: 44100
};

/**
 * Problem detection thresholds (excess ratio compared to expected)
 */
const SEVERITY_THRESHOLDS = {
    mild: 1.3,
    moderate: 1.7,
    severe: 2.5
};

/**
 * Audio Problem Detection Service
 */
export class AudioProblemDetectionService {
    private fftSize: number;
    private hopSize: number;

    constructor(config?: { fftSize?: number; hopSize?: number }) {
        this.fftSize = config?.fftSize ?? DEFAULTS.fftSize;
        this.hopSize = config?.hopSize ?? DEFAULTS.hopSize;
    }

    /**
     * Calculate average spectrum from audio samples
     */
    private calculateAverageSpectrum(samples: Float32Array, _sampleRate: number): Float32Array {
        const numFrames = Math.floor((samples.length - this.fftSize) / this.hopSize);
        if (numFrames <= 0) {
            return new Float32Array(this.fftSize / 2);
        }

        const avgSpectrum = new Float32Array(this.fftSize / 2);

        for (let frame = 0; frame < numFrames; frame++) {
            const start = frame * this.hopSize;
            const frameData = samples.slice(start, start + this.fftSize);

            // Handle mono conversion if needed
            const monoFrame = frameData.length === this.fftSize ? frameData : new Float32Array(this.fftSize);
            if (frameData.length < this.fftSize) {
                monoFrame.set(frameData);
            }

            const features = Meyda.extract(['amplitudeSpectrum'], monoFrame);

            if (features && features.amplitudeSpectrum) {
                const spectrum = features.amplitudeSpectrum as number[] | Float32Array;
                for (let i = 0; i < avgSpectrum.length && i < spectrum.length; i++) {
                    avgSpectrum[i] += spectrum[i];
                }
            }
        }

        // Average the spectrum
        for (let i = 0; i < avgSpectrum.length; i++) {
            avgSpectrum[i] /= numFrames;
        }

        return avgSpectrum;
    }

    /**
     * Detect a specific frequency problem
     */
    private detectProblem(avgSpectrum: Float32Array, problemType: AudioProblemType, sampleRate: number): AudioProblem {
        // Find the problem band definition
        const bandDef = PROBLEM_FREQUENCY_BANDS.find(
            b => b.name.toLowerCase() === problemType || b.name.toLowerCase().includes(problemType)
        );

        if (!bandDef) {
            return {
                type: problemType,
                detected: false,
                severity: 'none',
                frequencyRange: { min: 0, max: 0 },
                energyDb: -100,
                excessPercentage: 0,
                recommendation: 'Unknown problem type'
            };
        }

        // Calculate energy in problem band
        const problemEnergy = calculateBandEnergy(avgSpectrum, bandDef, this.fftSize, sampleRate);
        const totalEnergy = calculateTotalEnergy(avgSpectrum);

        // Calculate percentage
        const problemPercentage = totalEnergy > 0 ? (problemEnergy / totalEnergy) * 100 : 0;

        // Expected percentage (assuming 6 main frequency bands, ~16.7% each)
        const expectedPercentage = 100 / 6;
        const excessRatio = problemPercentage / expectedPercentage;

        // Determine severity
        let severity: ProblemSeverity = 'none';
        if (excessRatio >= SEVERITY_THRESHOLDS.severe) {
            severity = 'severe';
        } else if (excessRatio >= SEVERITY_THRESHOLDS.moderate) {
            severity = 'moderate';
        } else if (excessRatio >= SEVERITY_THRESHOLDS.mild) {
            severity = 'mild';
        }

        const detected = severity !== 'none';
        const energyDb = problemEnergy > 0 ? 10 * Math.log10(problemEnergy) : -100;

        // Generate recommendation based on problem type
        const recommendation = this.generateProblemRecommendation(problemType, severity, bandDef.minHz, bandDef.maxHz);

        return {
            type: problemType,
            detected,
            severity,
            frequencyRange: { min: bandDef.minHz, max: bandDef.maxHz },
            energyDb: Math.round(energyDb * 10) / 10,
            excessPercentage: Math.round((excessRatio - 1) * 100 * 10) / 10,
            recommendation
        };
    }

    /**
     * Generate problem-specific recommendation
     */
    private generateProblemRecommendation(problemType: AudioProblemType, severity: ProblemSeverity, minHz: number, maxHz: number): string {
        if (severity === 'none') {
            return `No ${problemType} issues detected.`;
        }

        const cutAmount = severity === 'severe' ? '4-6' : severity === 'moderate' ? '2-4' : '1-2';
        const centerFreq = Math.round((minHz + maxHz) / 2);

        const recommendations: Record<AudioProblemType, string> = {
            muddy: `Cut ${cutAmount}dB around ${minHz}-${maxHz}Hz with a wide Q (0.5-1.0). Consider high-pass filtering up to ${minHz}Hz.`,
            harsh: `Apply dynamic EQ or de-esser at ${centerFreq}Hz. Cut ${cutAmount}dB with narrow Q (2-4). Consider multiband compression.`,
            boxy: `Cut ${cutAmount}dB at ${centerFreq}Hz with moderate Q (1-2). This "cardboard box" resonance is common in untreated rooms.`,
            thin: `Boost 100-200Hz by ${cutAmount}dB to add body. Consider harmonic saturation to enhance fundamentals.`,
            nasal: `Cut ${cutAmount}dB around ${centerFreq}Hz with moderate Q (1.5-2.5). This "honky" quality masks clarity.`,
            rumble: `Apply high-pass filter at ${maxHz}Hz with 18-24dB/octave slope. This removes unwanted low-frequency noise.`,
            sibilant: `Apply de-esser targeting ${minHz}-${maxHz}Hz. Start with 4-6dB reduction on "S" and "T" sounds.`
        };

        return recommendations[problemType];
    }

    /**
     * Detect muddy frequencies (200-400 Hz excess)
     */
    detectMuddy(audio: CapturedAudio): AudioProblem {
        const avgSpectrum = this.calculateAverageSpectrum(audio.samples, audio.sampleRate);
        return this.detectProblem(avgSpectrum, 'muddy', audio.sampleRate);
    }

    /**
     * Detect harsh frequencies (2.5-4 kHz excess)
     */
    detectHarsh(audio: CapturedAudio): AudioProblem {
        const avgSpectrum = this.calculateAverageSpectrum(audio.samples, audio.sampleRate);
        return this.detectProblem(avgSpectrum, 'harsh', audio.sampleRate);
    }

    /**
     * Detect boxy frequencies (400-800 Hz resonance)
     */
    detectBoxy(audio: CapturedAudio): AudioProblem {
        const avgSpectrum = this.calculateAverageSpectrum(audio.samples, audio.sampleRate);
        return this.detectProblem(avgSpectrum, 'boxy', audio.sampleRate);
    }

    /**
     * Detect thin sound (lacking fundamentals 100-200 Hz)
     */
    detectThin(audio: CapturedAudio): AudioProblem {
        const avgSpectrum = this.calculateAverageSpectrum(audio.samples, audio.sampleRate);

        // For "thin", we look at bass energy being too LOW
        const bassBand = { name: 'Bass', minHz: 60, maxHz: 250, description: 'Fundamental warmth' };
        const bassEnergy = calculateBandEnergy(avgSpectrum, bassBand, this.fftSize, audio.sampleRate);
        const totalEnergy = calculateTotalEnergy(avgSpectrum);

        const bassPercentage = totalEnergy > 0 ? (bassEnergy / totalEnergy) * 100 : 0;
        const expectedPercentage = 100 / 6; // ~16.7%
        const deficitRatio = expectedPercentage / (bassPercentage || 0.1);

        let severity: ProblemSeverity = 'none';
        if (deficitRatio >= SEVERITY_THRESHOLDS.severe) {
            severity = 'severe';
        } else if (deficitRatio >= SEVERITY_THRESHOLDS.moderate) {
            severity = 'moderate';
        } else if (deficitRatio >= SEVERITY_THRESHOLDS.mild) {
            severity = 'mild';
        }

        const detected = severity !== 'none';
        const energyDb = bassEnergy > 0 ? 10 * Math.log10(bassEnergy) : -100;

        return {
            type: 'thin',
            detected,
            severity,
            frequencyRange: { min: 60, max: 250 },
            energyDb: Math.round(energyDb * 10) / 10,
            excessPercentage: -Math.round((deficitRatio - 1) * 100 * 10) / 10,
            recommendation: this.generateProblemRecommendation('thin', severity, 100, 200)
        };
    }

    /**
     * Detect nasal frequencies (800-1500 Hz)
     */
    detectNasal(audio: CapturedAudio): AudioProblem {
        const avgSpectrum = this.calculateAverageSpectrum(audio.samples, audio.sampleRate);
        return this.detectProblem(avgSpectrum, 'nasal', audio.sampleRate);
    }

    /**
     * Detect rumble (20-80 Hz unwanted noise)
     */
    detectRumble(audio: CapturedAudio): AudioProblem {
        const avgSpectrum = this.calculateAverageSpectrum(audio.samples, audio.sampleRate);
        return this.detectProblem(avgSpectrum, 'rumble', audio.sampleRate);
    }

    /**
     * Detect sibilance (5-8 kHz)
     */
    detectSibilant(audio: CapturedAudio): AudioProblem {
        const avgSpectrum = this.calculateAverageSpectrum(audio.samples, audio.sampleRate);
        return this.detectProblem(avgSpectrum, 'sibilant', audio.sampleRate);
    }

    /**
     * Detect digital clipping
     */
    detectClipping(audio: CapturedAudio, threshold: number = 0.99): ClippingAnalysis {
        const samples = audio.samples;
        let clippedSamples = 0;
        let consecutiveClips = 0;
        let currentConsecutive = 0;
        let maxConsecutive = 0;

        for (let i = 0; i < samples.length; i++) {
            const absValue = Math.abs(samples[i]);

            if (absValue >= threshold) {
                clippedSamples++;
                currentConsecutive++;

                if (currentConsecutive > maxConsecutive) {
                    maxConsecutive = currentConsecutive;
                }

                // Count consecutive clip events (3+ samples in a row)
                if (currentConsecutive === 3) {
                    consecutiveClips++;
                }
            } else {
                currentConsecutive = 0;
            }
        }

        const clippingPercentage = (clippedSamples / samples.length) * 100;
        const peakValue = calculatePeak(samples);
        const peakDb = linearToDb(peakValue);
        const hasClipping = clippingPercentage > 0.01 || consecutiveClips > 5;

        let recommendation: string;
        if (!hasClipping) {
            recommendation = 'No significant clipping detected. Headroom is adequate.';
        } else if (clippingPercentage > 1) {
            recommendation = `Severe clipping detected (${clippingPercentage.toFixed(2)}%). Reduce input gain by at least ${Math.ceil(peakDb)}dB. Re-record if possible.`;
        } else if (consecutiveClips > 20) {
            recommendation = `Digital clipping detected with ${consecutiveClips} clipped regions. Reduce input gain by 3-6dB.`;
        } else {
            recommendation = `Minor clipping detected. Reduce input gain by 1-3dB or apply a limiter before the signal clips.`;
        }

        return {
            hasClipping,
            clippedSamples,
            clippingPercentage: Math.round(clippingPercentage * 1000) / 1000,
            peakValue: Math.round(peakValue * 1000) / 1000,
            peakDb: Math.round(peakDb * 10) / 10,
            consecutiveClips,
            recommendation
        };
    }

    /**
     * Analyze noise floor and signal-to-noise ratio
     */
    analyzeNoiseFloor(audio: CapturedAudio, quietThresholdDb: number = -40): NoiseFloorAnalysis {
        const samples = audio.samples;
        const windowSize = Math.floor(audio.sampleRate * 0.1); // 100ms windows
        const numWindows = Math.floor(samples.length / windowSize);

        const windowRms: number[] = [];
        const quietWindows: number[] = [];

        // Calculate RMS for each window
        for (let i = 0; i < numWindows; i++) {
            const start = i * windowSize;
            const window = samples.slice(start, start + windowSize);
            const rms = calculateRms(window);
            const rmsDb = linearToDb(rms);
            windowRms.push(rmsDb);

            if (rmsDb < quietThresholdDb) {
                quietWindows.push(rmsDb);
            }
        }

        // Calculate signal levels
        const signalPeak = calculatePeak(samples);
        const signalRms = calculateRms(samples);
        const signalPeakDb = linearToDb(signalPeak);
        const signalRmsDb = linearToDb(signalRms);

        // Estimate noise floor from quiet sections or lowest 10% of windows
        let noiseFloorDb: number;
        if (quietWindows.length > 0) {
            // Average of quiet sections
            noiseFloorDb = quietWindows.reduce((a, b) => a + b, 0) / quietWindows.length;
        } else {
            // Use lowest 10% of windows
            const sortedRms = [...windowRms].sort((a, b) => a - b);
            const lowCount = Math.max(1, Math.floor(sortedRms.length * 0.1));
            noiseFloorDb = sortedRms.slice(0, lowCount).reduce((a, b) => a + b, 0) / lowCount;
        }

        const signalToNoiseDb = signalRmsDb - noiseFloorDb;
        const suggestGate = noiseFloorDb > -50;
        const gateThresholdDb = suggestGate ? noiseFloorDb + 6 : undefined;

        let recommendation: string;
        if (signalToNoiseDb > 60) {
            recommendation = 'Excellent signal-to-noise ratio. No noise reduction needed.';
        } else if (signalToNoiseDb > 40) {
            recommendation = 'Good signal-to-noise ratio. Minimal noise reduction may help in quiet passages.';
        } else if (signalToNoiseDb > 20) {
            recommendation = `Moderate noise floor at ${noiseFloorDb.toFixed(1)}dB. Consider using a noise gate at ${gateThresholdDb?.toFixed(1)}dB or noise reduction processing.`;
        } else {
            recommendation = `High noise floor at ${noiseFloorDb.toFixed(1)}dB. Apply noise reduction. Use a gate at ${gateThresholdDb?.toFixed(1)}dB for spoken/sung sections.`;
        }

        return {
            noiseFloorDb: Math.round(noiseFloorDb * 10) / 10,
            signalPeakDb: Math.round(signalPeakDb * 10) / 10,
            signalRmsDb: Math.round(signalRmsDb * 10) / 10,
            signalToNoiseDb: Math.round(signalToNoiseDb * 10) / 10,
            quietSectionCount: quietWindows.length,
            suggestGate,
            gateThresholdDb: gateThresholdDb !== undefined ? Math.round(gateThresholdDb * 10) / 10 : undefined,
            recommendation
        };
    }

    /**
     * Detect all problems and generate comprehensive report
     */
    detectAllProblems(audio: CapturedAudio): AudioProblemsReport {
        const problems: AudioProblem[] = [
            this.detectMuddy(audio),
            this.detectHarsh(audio),
            this.detectBoxy(audio),
            this.detectThin(audio),
            this.detectNasal(audio),
            this.detectRumble(audio),
            this.detectSibilant(audio)
        ];

        // Count detected problems by severity
        const detectedProblems = problems.filter(p => p.detected);
        const severeCount = detectedProblems.filter(p => p.severity === 'severe').length;
        const moderateCount = detectedProblems.filter(p => p.severity === 'moderate').length;

        // Determine overall quality
        let overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
        if (severeCount > 0 || detectedProblems.length > 3) {
            overallQuality = 'poor';
        } else if (moderateCount > 1 || detectedProblems.length > 2) {
            overallQuality = 'fair';
        } else if (detectedProblems.length > 0) {
            overallQuality = 'good';
        } else {
            overallQuality = 'excellent';
        }

        // Prioritize actions (severe first, then by energy)
        const prioritizedActions = detectedProblems
            .sort((a, b) => {
                const severityOrder = { severe: 0, moderate: 1, mild: 2, none: 3 };
                return severityOrder[a.severity] - severityOrder[b.severity];
            })
            .map(p => p.recommendation);

        return {
            problems,
            overallQuality,
            prioritizedActions
        };
    }
}
