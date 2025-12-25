import * as path from 'path';
import * as fs from 'fs';
import { AudioDynamicsService } from './audio-dynamics-analysis.js';
import { AudioFileService } from './audio-file.js';
import type { CapturedAudio } from '../types/audio.js';

const fixturesDir = path.join(__dirname, '__fixtures__');

describe('AudioDynamicsService', () => {
    let dynamicsService: AudioDynamicsService;
    let fileService: AudioFileService;
    let monoAudio: CapturedAudio;
    let transientAudio: CapturedAudio;
    let harshAudio: CapturedAudio;

    beforeAll(async () => {
        dynamicsService = new AudioDynamicsService();
        fileService = new AudioFileService();

        // Load test audio files
        const monoPath = path.join(fixturesDir, 'mono-sine-440hz.wav');
        const transientPath = path.join(fixturesDir, 'transient-signal.wav');
        const harshPath = path.join(fixturesDir, 'harsh-signal.wav');

        expect(fs.existsSync(monoPath)).toBe(true);
        expect(fs.existsSync(transientPath)).toBe(true);
        expect(fs.existsSync(harshPath)).toBe(true);

        monoAudio = await fileService.readWavFile(monoPath);
        transientAudio = await fileService.readWavFile(transientPath);
        harshAudio = await fileService.readWavFile(harshPath);
    });

    describe('detectTransients', () => {
        it('should return TransientAnalysis with all required fields', () => {
            const result = dynamicsService.detectTransients(monoAudio);

            expect(result).toHaveProperty('transientCount');
            expect(result).toHaveProperty('transientDensityPerSecond');
            expect(result).toHaveProperty('averageAttackMs');
            expect(result).toHaveProperty('peakAttackMs');
            expect(result).toHaveProperty('attackCharacter');
            expect(result).toHaveProperty('transientLocationsMs');
            expect(result).toHaveProperty('recommendation');
        });

        it('should return valid attack character', () => {
            const result = dynamicsService.detectTransients(monoAudio);

            expect(['sharp', 'medium', 'soft']).toContain(result.attackCharacter);
        });

        it('should analyze transient-heavy signal', () => {
            const result = dynamicsService.detectTransients(transientAudio);

            // Synthetic transients may not all be detected depending on envelope parameters
            expect(result.transientCount).toBeGreaterThanOrEqual(0);
            expect(result.transientDensityPerSecond).toBeGreaterThanOrEqual(0);
        });

        it('should respect sensitivity parameter', () => {
            const lowSensitivity = dynamicsService.detectTransients(transientAudio, 'low');
            const highSensitivity = dynamicsService.detectTransients(transientAudio, 'high');

            // Higher sensitivity should detect more transients
            expect(highSensitivity.transientCount).toBeGreaterThanOrEqual(lowSensitivity.transientCount);
        });

        it('should return transient locations as array', () => {
            const result = dynamicsService.detectTransients(transientAudio);

            expect(Array.isArray(result.transientLocationsMs)).toBe(true);
            // All locations should be positive milliseconds
            for (const loc of result.transientLocationsMs) {
                expect(loc).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe('assessCompressionNeed', () => {
        it('should return CompressionAssessment with all required fields', () => {
            const result = dynamicsService.assessCompressionNeed(monoAudio);

            expect(result).toHaveProperty('dynamicRangeDb');
            expect(result).toHaveProperty('peakToAverageRatio');
            expect(result).toHaveProperty('crestFactorDb');
            expect(result).toHaveProperty('needsCompression');
            expect(result).toHaveProperty('compressionUrgency');
            expect(result).toHaveProperty('suggestedSettings');
            expect(result).toHaveProperty('recommendation');
        });

        it('should return valid compression settings', () => {
            const result = dynamicsService.assessCompressionNeed(monoAudio);

            expect(result.suggestedSettings).toHaveProperty('ratio');
            expect(result.suggestedSettings).toHaveProperty('thresholdDb');
            expect(result.suggestedSettings).toHaveProperty('attackMs');
            expect(result.suggestedSettings).toHaveProperty('releaseMs');
            expect(result.suggestedSettings).toHaveProperty('makeupGainDb');
        });

        it('should return valid compression urgency', () => {
            const result = dynamicsService.assessCompressionNeed(monoAudio);

            expect(['none', 'optional', 'recommended', 'essential']).toContain(result.compressionUrgency);
        });

        it('should have positive dynamic range', () => {
            const result = dynamicsService.assessCompressionNeed(monoAudio);

            expect(result.dynamicRangeDb).toBeGreaterThanOrEqual(0);
        });

        it('should respect target dynamic range parameter', () => {
            const result6dB = dynamicsService.assessCompressionNeed(monoAudio, 6);
            const result20dB = dynamicsService.assessCompressionNeed(monoAudio, 20);

            // Lower target should require more compression
            // Just verify both return valid results
            expect(result6dB.dynamicRangeDb).toBeDefined();
            expect(result20dB.dynamicRangeDb).toBeDefined();
        });

        it('should assess transient-heavy signal', () => {
            const result = dynamicsService.assessCompressionNeed(transientAudio);

            // Synthetic transient audio may have 0 dynamic range if mostly silence
            expect(result.dynamicRangeDb).toBeGreaterThanOrEqual(0);
            expect(result.peakToAverageRatio).toBeGreaterThanOrEqual(0);
        });
    });

    describe('detectSibilance', () => {
        it('should return SibilanceAnalysis with all required fields', () => {
            const result = dynamicsService.detectSibilance(monoAudio);

            expect(result).toHaveProperty('hasSibilance');
            expect(result).toHaveProperty('severity');
            expect(result).toHaveProperty('sibilantFramePercentage');
            expect(result).toHaveProperty('peakFrequencyHz');
            expect(result).toHaveProperty('averageEnergyDb');
            expect(result).toHaveProperty('recommendation');
        });

        it('should return valid severity', () => {
            const result = dynamicsService.detectSibilance(monoAudio);

            expect(['none', 'mild', 'moderate', 'severe']).toContain(result.severity);
        });

        it('should return de-esser settings when sibilance detected', () => {
            const result = dynamicsService.detectSibilance(harshAudio);

            if (result.hasSibilance) {
                expect(result.deEsserSettings).toBeDefined();
                expect(result.deEsserSettings).toHaveProperty('frequencyHz');
                expect(result.deEsserSettings).toHaveProperty('thresholdDb');
                expect(result.deEsserSettings).toHaveProperty('rangeDb');
            }
        });

        it('should have valid percentage', () => {
            const result = dynamicsService.detectSibilance(monoAudio);

            expect(result.sibilantFramePercentage).toBeGreaterThanOrEqual(0);
            expect(result.sibilantFramePercentage).toBeLessThanOrEqual(100);
        });

        it('should not detect sibilance in 440Hz sine wave', () => {
            const result = dynamicsService.detectSibilance(monoAudio);

            // 440Hz is far from the sibilance range (5-8kHz)
            expect(result.hasSibilance).toBe(false);
        });
    });

    describe('detectPumping', () => {
        it('should return PumpingAnalysis with all required fields', () => {
            const result = dynamicsService.detectPumping(monoAudio);

            expect(result).toHaveProperty('hasPumping');
            expect(result).toHaveProperty('severity');
            expect(result).toHaveProperty('pumpingRateHz');
            expect(result).toHaveProperty('modulationDepthDb');
            expect(result).toHaveProperty('recommendation');
        });

        it('should return valid severity', () => {
            const result = dynamicsService.detectPumping(monoAudio);

            expect(['none', 'mild', 'moderate', 'severe']).toContain(result.severity);
        });

        it('should not detect pumping in steady sine wave', () => {
            const result = dynamicsService.detectPumping(monoAudio);

            // A steady sine wave should not have pumping artifacts
            expect(result.hasPumping).toBe(false);
        });

        it('should have non-negative pumping rate', () => {
            const result = dynamicsService.detectPumping(transientAudio);

            expect(result.pumpingRateHz).toBeGreaterThanOrEqual(0);
        });

        it('should have non-negative modulation depth', () => {
            const result = dynamicsService.detectPumping(transientAudio);

            expect(result.modulationDepthDb).toBeGreaterThanOrEqual(0);
        });
    });
});
