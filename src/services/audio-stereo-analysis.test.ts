import * as path from 'path';
import * as fs from 'fs';
import { AudioStereoAnalysisService } from './audio-stereo-analysis.js';
import { AudioFileService } from './audio-file.js';
import type { CapturedAudio } from '../types/audio.js';

const fixturesDir = path.join(__dirname, '__fixtures__');

describe('AudioStereoAnalysisService', () => {
    let stereoService: AudioStereoAnalysisService;
    let fileService: AudioFileService;
    let monoAudio: CapturedAudio;
    let stereoAudio: CapturedAudio;

    beforeAll(async () => {
        stereoService = new AudioStereoAnalysisService();
        fileService = new AudioFileService();

        // Load test audio files
        const monoPath = path.join(fixturesDir, 'mono-sine-440hz.wav');
        const stereoPath = path.join(fixturesDir, 'stereo-mix.wav');

        expect(fs.existsSync(monoPath)).toBe(true);
        expect(fs.existsSync(stereoPath)).toBe(true);

        monoAudio = await fileService.readWavFile(monoPath);
        stereoAudio = await fileService.readWavFile(stereoPath);
    });

    describe('analyzePhaseCorrelation', () => {
        it('should return PhaseAnalysis with all required fields', () => {
            const result = stereoService.analyzePhaseCorrelation(stereoAudio);

            expect(result).toHaveProperty('correlationCoefficient');
            expect(result).toHaveProperty('correlationMin');
            expect(result).toHaveProperty('correlationMax');
            expect(result).toHaveProperty('monoCompatibility');
            expect(result).toHaveProperty('hasPhaseIssues');
            expect(result).toHaveProperty('problematicRegions');
            expect(result).toHaveProperty('recommendation');
        });

        it('should return correlation coefficient between -1 and 1', () => {
            const result = stereoService.analyzePhaseCorrelation(stereoAudio);

            expect(result.correlationCoefficient).toBeGreaterThanOrEqual(-1);
            expect(result.correlationCoefficient).toBeLessThanOrEqual(1);
        });

        it('should return valid mono compatibility', () => {
            const result = stereoService.analyzePhaseCorrelation(stereoAudio);

            expect(['excellent', 'good', 'fair', 'poor']).toContain(result.monoCompatibility);
        });

        it('should handle mono audio', () => {
            const result = stereoService.analyzePhaseCorrelation(monoAudio);

            expect(result.correlationCoefficient).toBe(1); // Mono is perfectly correlated with itself
            expect(result.monoCompatibility).toBe('excellent');
            expect(result.hasPhaseIssues).toBe(false);
        });

        it('should return problematic regions as array', () => {
            const result = stereoService.analyzePhaseCorrelation(stereoAudio);

            expect(Array.isArray(result.problematicRegions)).toBe(true);
            for (const region of result.problematicRegions) {
                expect(region).toHaveProperty('startMs');
                expect(region).toHaveProperty('endMs');
                expect(region).toHaveProperty('correlation');
            }
        });
    });

    describe('analyzeStereoWidth', () => {
        it('should return StereoWidthAnalysis with all required fields', () => {
            const result = stereoService.analyzeStereoWidth(stereoAudio);

            expect(result).toHaveProperty('widthPercentage');
            expect(result).toHaveProperty('sideMidRatio');
            expect(result).toHaveProperty('midRmsDb');
            expect(result).toHaveProperty('sideRmsDb');
            expect(result).toHaveProperty('widthCharacter');
            expect(result).toHaveProperty('recommendation');
        });

        it('should return valid width character', () => {
            const result = stereoService.analyzeStereoWidth(stereoAudio);

            expect(['mono', 'narrow', 'normal', 'wide', 'very-wide']).toContain(result.widthCharacter);
        });

        it('should have non-negative width percentage', () => {
            const result = stereoService.analyzeStereoWidth(stereoAudio);

            expect(result.widthPercentage).toBeGreaterThanOrEqual(0);
        });

        it('should report mono audio as mono', () => {
            const result = stereoService.analyzeStereoWidth(monoAudio);

            expect(result.widthCharacter).toBe('mono');
            expect(result.widthPercentage).toBe(0);
        });

        it('should have valid dB values', () => {
            const result = stereoService.analyzeStereoWidth(stereoAudio);

            expect(typeof result.midRmsDb).toBe('number');
            expect(typeof result.sideRmsDb).toBe('number');
        });
    });

    describe('analyzeStereoBalance', () => {
        it('should return StereoBalanceAnalysis with all required fields', () => {
            const result = stereoService.analyzeStereoBalance(stereoAudio);

            expect(result).toHaveProperty('balancePercentage');
            expect(result).toHaveProperty('leftRmsDb');
            expect(result).toHaveProperty('rightRmsDb');
            expect(result).toHaveProperty('differenceDb');
            expect(result).toHaveProperty('isBalanced');
            expect(result).toHaveProperty('panDirection');
            expect(result).toHaveProperty('recommendation');
        });

        it('should return valid pan direction', () => {
            const result = stereoService.analyzeStereoBalance(stereoAudio);

            expect(['center', 'left', 'right']).toContain(result.panDirection);
        });

        it('should have balance percentage between -100 and 100', () => {
            const result = stereoService.analyzeStereoBalance(stereoAudio);

            expect(result.balancePercentage).toBeGreaterThanOrEqual(-100);
            expect(result.balancePercentage).toBeLessThanOrEqual(100);
        });

        it('should report mono audio as balanced', () => {
            const result = stereoService.analyzeStereoBalance(monoAudio);

            expect(result.isBalanced).toBe(true);
            expect(result.differenceDb).toBe(0);
        });

        it('should have valid dB values', () => {
            const result = stereoService.analyzeStereoBalance(stereoAudio);

            expect(typeof result.leftRmsDb).toBe('number');
            expect(typeof result.rightRmsDb).toBe('number');
            expect(typeof result.differenceDb).toBe('number');
        });
    });

    describe('analyzeStereoField', () => {
        it('should return StereoFieldAnalysis with all required fields', () => {
            const result = stereoService.analyzeStereoField(stereoAudio);

            expect(result).toHaveProperty('width');
            expect(result).toHaveProperty('balance');
            expect(result).toHaveProperty('phase');
            expect(result).toHaveProperty('isStereo');
            expect(result).toHaveProperty('recommendation');
        });

        it('should correctly identify stereo audio', () => {
            const result = stereoService.analyzeStereoField(stereoAudio);

            expect(result.isStereo).toBe(true);
        });

        it('should correctly identify mono audio', () => {
            const result = stereoService.analyzeStereoField(monoAudio);

            expect(result.isStereo).toBe(false);
        });

        it('should include all sub-analyses', () => {
            const result = stereoService.analyzeStereoField(stereoAudio);

            // Width analysis
            expect(result.width).toHaveProperty('widthPercentage');
            expect(result.width).toHaveProperty('widthCharacter');

            // Balance analysis
            expect(result.balance).toHaveProperty('balancePercentage');
            expect(result.balance).toHaveProperty('isBalanced');

            // Phase analysis
            expect(result.phase).toHaveProperty('correlationCoefficient');
            expect(result.phase).toHaveProperty('monoCompatibility');
        });

        it('should provide recommendation string', () => {
            const result = stereoService.analyzeStereoField(stereoAudio);

            expect(typeof result.recommendation).toBe('string');
            expect(result.recommendation.length).toBeGreaterThan(0);
        });
    });
});
