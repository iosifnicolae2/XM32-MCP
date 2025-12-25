/**
 * Audio Stereo/Spatial Analysis Service
 * Analyzes phase correlation, stereo width, and stereo balance
 */

import type {
    CapturedAudio,
    PhaseAnalysis,
    StereoWidthAnalysis,
    StereoBalanceAnalysis,
    StereoFieldAnalysis,
    MonoCompatibility,
    StereoWidthCharacter
} from '../types/audio.js';
import { splitStereoChannels, calculatePhaseCorrelation, calculateMidSide, calculateRms, linearToDb } from '../utils/audio-dsp.js';

/**
 * Default analysis configuration
 */
const DEFAULTS = {
    windowSizeMs: 100,
    sampleRate: 44100
};

/**
 * Audio Stereo Analysis Service
 */
export class AudioStereoAnalysisService {
    private windowSizeMs: number;

    constructor(config?: { windowSizeMs?: number }) {
        this.windowSizeMs = config?.windowSizeMs ?? DEFAULTS.windowSizeMs;
    }

    /**
     * Analyze phase correlation between stereo channels
     */
    analyzePhaseCorrelation(audio: CapturedAudio): PhaseAnalysis {
        // Check if audio is stereo
        if (audio.channels < 2) {
            return {
                correlationCoefficient: 1,
                correlationMin: 1,
                correlationMax: 1,
                monoCompatibility: 'excellent',
                hasPhaseIssues: false,
                problematicRegions: [],
                recommendation: 'Audio is mono - no phase issues possible.'
            };
        }

        const { left, right } = splitStereoChannels(audio.samples, audio.channels);
        const sampleRate = audio.sampleRate;

        // Calculate overall correlation
        const overallCorrelation = calculatePhaseCorrelation(left, right);

        // Calculate windowed correlation to find problematic regions
        const windowSize = Math.floor(sampleRate * (this.windowSizeMs / 1000));
        const numWindows = Math.floor(left.length / windowSize);

        const windowCorrelations: number[] = [];
        const problematicRegions: Array<{ startMs: number; endMs: number; correlation: number }> = [];

        let correlationMin = 1;
        let correlationMax = -1;

        for (let i = 0; i < numWindows; i++) {
            const start = i * windowSize;
            const leftWindow = left.slice(start, start + windowSize);
            const rightWindow = right.slice(start, start + windowSize);

            const correlation = calculatePhaseCorrelation(leftWindow, rightWindow);
            windowCorrelations.push(correlation);

            if (correlation < correlationMin) correlationMin = correlation;
            if (correlation > correlationMax) correlationMax = correlation;

            // Track problematic regions (correlation < 0.3)
            if (correlation < 0.3) {
                const startMs = (start / sampleRate) * 1000;
                const endMs = ((start + windowSize) / sampleRate) * 1000;
                problematicRegions.push({
                    startMs: Math.round(startMs),
                    endMs: Math.round(endMs),
                    correlation: Math.round(correlation * 100) / 100
                });
            }
        }

        // Determine mono compatibility
        let monoCompatibility: MonoCompatibility;
        if (overallCorrelation > 0.8) {
            monoCompatibility = 'excellent';
        } else if (overallCorrelation > 0.5) {
            monoCompatibility = 'good';
        } else if (overallCorrelation > 0.0) {
            monoCompatibility = 'fair';
        } else {
            monoCompatibility = 'poor';
        }

        const hasPhaseIssues = overallCorrelation < 0.5 || correlationMin < 0;

        // Generate recommendation
        let recommendation: string;
        if (monoCompatibility === 'excellent') {
            recommendation = `Excellent mono compatibility (correlation: ${overallCorrelation.toFixed(2)}). Mix will translate well to mono systems.`;
        } else if (monoCompatibility === 'good') {
            recommendation = `Good mono compatibility (correlation: ${overallCorrelation.toFixed(2)}). Some width may be lost in mono.`;
        } else if (monoCompatibility === 'fair') {
            recommendation = `Fair mono compatibility (correlation: ${overallCorrelation.toFixed(2)}). Check critical elements in mono. ${problematicRegions.length} problematic regions found.`;
        } else {
            recommendation = `Poor mono compatibility (correlation: ${overallCorrelation.toFixed(2)}). Significant phase cancellation likely in mono. Review stereo processing.`;
        }

        // Limit problematic regions in output
        const limitedProblematicRegions = problematicRegions.slice(0, 10);

        return {
            correlationCoefficient: Math.round(overallCorrelation * 1000) / 1000,
            correlationMin: Math.round(correlationMin * 1000) / 1000,
            correlationMax: Math.round(correlationMax * 1000) / 1000,
            monoCompatibility,
            hasPhaseIssues,
            problematicRegions: limitedProblematicRegions,
            recommendation
        };
    }

    /**
     * Analyze stereo width using M/S analysis
     */
    analyzeStereoWidth(audio: CapturedAudio): StereoWidthAnalysis {
        // Check if audio is stereo
        if (audio.channels < 2) {
            return {
                widthPercentage: 0,
                sideMidRatio: 0,
                midRmsDb: linearToDb(calculateRms(audio.samples)),
                sideRmsDb: -Infinity,
                widthCharacter: 'mono',
                recommendation: 'Audio is mono. Consider stereo enhancement if width is desired.'
            };
        }

        const { left, right } = splitStereoChannels(audio.samples, audio.channels);
        const { mid, side } = calculateMidSide(left, right);

        const midRms = calculateRms(mid);
        const sideRms = calculateRms(side);

        const midRmsDb = linearToDb(midRms);
        const sideRmsDb = linearToDb(sideRms);

        // Width percentage: ratio of side to mid energy
        // 0% = pure mono, 100% = normal stereo, >100% = wide
        const sideMidRatio = sideRms / (midRms || 0.0001);
        const widthPercentage = sideMidRatio * 100;

        // Determine width character
        let widthCharacter: StereoWidthCharacter;
        if (widthPercentage < 10) {
            widthCharacter = 'mono';
        } else if (widthPercentage < 50) {
            widthCharacter = 'narrow';
        } else if (widthPercentage < 120) {
            widthCharacter = 'normal';
        } else if (widthPercentage < 180) {
            widthCharacter = 'wide';
        } else {
            widthCharacter = 'very-wide';
        }

        // Generate recommendation
        let recommendation: string;
        if (widthCharacter === 'mono') {
            recommendation = 'Audio is effectively mono. Apply stereo widening, reverb, or delay for more width.';
        } else if (widthCharacter === 'narrow') {
            recommendation = `Narrow stereo image (${widthPercentage.toFixed(0)}%). Consider M/S EQ boost on sides or stereo widening.`;
        } else if (widthCharacter === 'normal') {
            recommendation = `Normal stereo width (${widthPercentage.toFixed(0)}%). Good balance between center focus and stereo spread.`;
        } else if (widthCharacter === 'wide') {
            recommendation = `Wide stereo image (${widthPercentage.toFixed(0)}%). Check mono compatibility - some elements may disappear in mono.`;
        } else {
            recommendation = `Very wide stereo (${widthPercentage.toFixed(0)}%). High risk of phase issues in mono. Consider narrowing or checking correlation.`;
        }

        return {
            widthPercentage: Math.round(widthPercentage * 10) / 10,
            sideMidRatio: Math.round(sideMidRatio * 1000) / 1000,
            midRmsDb: Math.round(midRmsDb * 10) / 10,
            sideRmsDb: Math.round(sideRmsDb * 10) / 10,
            widthCharacter,
            recommendation
        };
    }

    /**
     * Analyze stereo balance (left/right distribution)
     */
    analyzeStereoBalance(audio: CapturedAudio): StereoBalanceAnalysis {
        // Check if audio is stereo
        if (audio.channels < 2) {
            return {
                balancePercentage: 0,
                leftRmsDb: linearToDb(calculateRms(audio.samples)),
                rightRmsDb: linearToDb(calculateRms(audio.samples)),
                differenceDb: 0,
                isBalanced: true,
                panDirection: 'center',
                recommendation: 'Audio is mono - perfectly balanced.'
            };
        }

        const { left, right } = splitStereoChannels(audio.samples, audio.channels);

        const leftRms = calculateRms(left);
        const rightRms = calculateRms(right);

        const leftRmsDb = linearToDb(leftRms);
        const rightRmsDb = linearToDb(rightRms);
        const differenceDb = leftRmsDb - rightRmsDb;

        // Balance percentage: -100 (full left) to +100 (full right)
        const totalRms = leftRms + rightRms;
        const balancePercentage = totalRms > 0 ? ((rightRms - leftRms) / totalRms) * 100 : 0;

        // Determine if balanced (within 1.5dB)
        const isBalanced = Math.abs(differenceDb) < 1.5;

        // Determine pan direction
        let panDirection: 'center' | 'left' | 'right';
        if (Math.abs(differenceDb) < 0.5) {
            panDirection = 'center';
        } else if (differenceDb > 0) {
            panDirection = 'left';
        } else {
            panDirection = 'right';
        }

        // Generate recommendation
        let recommendation: string;
        if (isBalanced) {
            recommendation = `Stereo balance is good (${Math.abs(differenceDb).toFixed(1)}dB difference). Mix is well centered.`;
        } else if (Math.abs(differenceDb) < 3) {
            recommendation = `Slight imbalance toward ${panDirection} (${Math.abs(differenceDb).toFixed(1)}dB). May be intentional for artistic effect.`;
        } else {
            recommendation = `Significant imbalance toward ${panDirection} (${Math.abs(differenceDb).toFixed(1)}dB). Review panning or check for recording issues.`;
        }

        return {
            balancePercentage: Math.round(balancePercentage * 10) / 10,
            leftRmsDb: Math.round(leftRmsDb * 10) / 10,
            rightRmsDb: Math.round(rightRmsDb * 10) / 10,
            differenceDb: Math.round(differenceDb * 10) / 10,
            isBalanced,
            panDirection,
            recommendation
        };
    }

    /**
     * Comprehensive stereo field analysis
     */
    analyzeStereoField(audio: CapturedAudio): StereoFieldAnalysis {
        const isStereo = audio.channels >= 2;

        const width = this.analyzeStereoWidth(audio);
        const balance = this.analyzeStereoBalance(audio);
        const phase = this.analyzePhaseCorrelation(audio);

        // Generate overall recommendation
        const issues: string[] = [];

        if (!isStereo) {
            issues.push('Audio is mono');
        } else {
            if (phase.hasPhaseIssues) {
                issues.push('phase issues detected');
            }
            if (!balance.isBalanced) {
                issues.push(`imbalanced toward ${balance.panDirection}`);
            }
            if (width.widthCharacter === 'mono' || width.widthCharacter === 'narrow') {
                issues.push('narrow stereo image');
            }
            if (width.widthCharacter === 'very-wide') {
                issues.push('very wide stereo may cause mono compatibility issues');
            }
        }

        let recommendation: string;
        if (issues.length === 0) {
            recommendation = 'Stereo field is healthy. Good width, balance, and phase correlation.';
        } else {
            recommendation = `Stereo field concerns: ${issues.join(', ')}. Review stereo processing.`;
        }

        return {
            width,
            balance,
            phase,
            isStereo,
            recommendation
        };
    }
}
