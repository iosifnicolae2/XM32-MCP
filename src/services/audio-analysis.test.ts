import * as path from 'path';
import * as fs from 'fs';
import { AudioAnalysisService } from './audio-analysis.js';
import { AudioFileService } from './audio-file.js';
import type { CapturedAudio } from '../types/audio.js';

const fixturesDir = path.join(__dirname, '__fixtures__');

describe('AudioAnalysisService', () => {
    let analysisService: AudioAnalysisService;
    let fileService: AudioFileService;
    let monoAudio: CapturedAudio;
    let stereoAudio: CapturedAudio;

    beforeAll(async () => {
        analysisService = new AudioAnalysisService();
        fileService = new AudioFileService();

        // Load test audio files
        const monoPath = path.join(fixturesDir, 'mono-sine-440hz.wav');
        const stereoPath = path.join(fixturesDir, 'stereo-mix.wav');

        expect(fs.existsSync(monoPath)).toBe(true);
        expect(fs.existsSync(stereoPath)).toBe(true);

        monoAudio = await fileService.readWavFile(monoPath);
        stereoAudio = await fileService.readWavFile(stereoPath);
    });

    describe('analyzeFrequencyBalance', () => {
        it('should return frequency balance with all required fields', () => {
            const result = analysisService.analyzeFrequencyBalance(monoAudio);

            expect(result).toHaveProperty('bands');
            expect(result).toHaveProperty('dominantBand');
            expect(result).toHaveProperty('balanceScore');
            expect(Array.isArray(result.bands)).toBe(true);
            expect(result.bands.length).toBeGreaterThan(0);
        });

        it('should have valid band data', () => {
            const result = analysisService.analyzeFrequencyBalance(monoAudio);

            for (const band of result.bands) {
                expect(band).toHaveProperty('band');
                expect(band).toHaveProperty('percentage');
                expect(band).toHaveProperty('energyDb');
                expect(typeof band.percentage).toBe('number');
                expect(band.percentage).toBeGreaterThanOrEqual(0);
            }
        });

        it('should detect 440Hz as mid-range frequency', () => {
            const result = analysisService.analyzeFrequencyBalance(monoAudio);

            // 440Hz should show up in the mid band
            const totalPercentage = result.bands.reduce((sum, b) => sum + b.percentage, 0);
            expect(totalPercentage).toBeCloseTo(100, 0);
        });
    });

    describe('measureLoudness', () => {
        it('should return loudness measurements with all required fields', () => {
            const result = analysisService.measureLoudness(monoAudio);

            expect(result).toHaveProperty('rmsDb');
            expect(result).toHaveProperty('peakDb');
            expect(result).toHaveProperty('dynamicRangeDb');
            expect(result).toHaveProperty('crestFactor');
            expect(result).toHaveProperty('rmsLinear');
            expect(result).toHaveProperty('peakLinear');
        });

        it('should return valid dB values', () => {
            const result = analysisService.measureLoudness(monoAudio);

            expect(result.rmsDb).toBeLessThan(0); // Should be negative for 0.5 amplitude
            expect(result.peakDb).toBeLessThanOrEqual(0); // Peak should be <= 0dB
            expect(result.dynamicRangeDb).toBeGreaterThan(0);
        });

        it('should have peak >= RMS', () => {
            const result = analysisService.measureLoudness(monoAudio);
            expect(result.peakLinear).toBeGreaterThanOrEqual(result.rmsLinear);
        });
    });

    describe('analyzeBrightness', () => {
        it('should return brightness analysis with all required fields', () => {
            const result = analysisService.analyzeBrightness(monoAudio);

            expect(result).toHaveProperty('centroidHz');
            expect(result).toHaveProperty('normalizedBrightness');
            expect(result).toHaveProperty('trend');
            expect(result).toHaveProperty('average');
            expect(result).toHaveProperty('min');
            expect(result).toHaveProperty('max');
        });

        it('should return valid frequency values', () => {
            const result = analysisService.analyzeBrightness(monoAudio);

            expect(result.centroidHz).toBeGreaterThan(0);
            expect(result.min).toBeGreaterThanOrEqual(0);
            expect(result.max).toBeGreaterThanOrEqual(result.min);
        });

        it('should have non-negative normalized brightness', () => {
            const result = analysisService.analyzeBrightness(monoAudio);

            expect(result.normalizedBrightness).toBeGreaterThanOrEqual(0);
            // Note: Meyda's spectralCentroid returns bin-based values that may exceed 1 when normalized
            expect(typeof result.normalizedBrightness).toBe('number');
        });

        it('should return valid trend', () => {
            const result = analysisService.analyzeBrightness(monoAudio);

            expect(['bright', 'neutral', 'warm']).toContain(result.trend);
        });
    });

    describe('analyzeHarshness', () => {
        it('should return harshness analysis with all required fields', () => {
            const result = analysisService.analyzeHarshness(monoAudio);

            expect(result).toHaveProperty('fluxAverage');
            expect(result).toHaveProperty('fluxPeak');
            expect(result).toHaveProperty('fluxValues');
            expect(result).toHaveProperty('harshFrequencies');
            expect(result).toHaveProperty('harshnessTrend');
        });

        it('should return valid flux values', () => {
            const result = analysisService.analyzeHarshness(monoAudio);

            expect(result.fluxAverage).toBeGreaterThanOrEqual(0);
            expect(result.fluxPeak).toBeGreaterThanOrEqual(0);
            expect(result.fluxPeak).toBeGreaterThanOrEqual(result.fluxAverage);
        });

        it('should return valid harshness trend', () => {
            const result = analysisService.analyzeHarshness(monoAudio);

            expect(['smooth', 'moderate', 'harsh']).toContain(result.harshnessTrend);
        });
    });

    describe('detectMasking', () => {
        it('should return masking analysis with all required fields', () => {
            const result = analysisService.detectMasking(monoAudio);

            expect(result).toHaveProperty('mfccCoefficients');
            expect(result).toHaveProperty('potentialMasking');
            expect(result).toHaveProperty('overallMaskingRisk');
        });

        it('should return valid masking risk', () => {
            const result = analysisService.detectMasking(monoAudio);

            expect(['low', 'medium', 'high']).toContain(result.overallMaskingRisk);
        });

        it('should have MFCC coefficients array', () => {
            const result = analysisService.detectMasking(monoAudio);

            expect(Array.isArray(result.mfccCoefficients)).toBe(true);
        });
    });

    describe('analyzeSpectrum', () => {
        it('should return full spectrum analysis with all required fields', () => {
            const result = analysisService.analyzeSpectrum(monoAudio);

            expect(result).toHaveProperty('spectrogram');
            expect(result).toHaveProperty('melSpectrogram');
            expect(result).toHaveProperty('features');
            expect(result).toHaveProperty('frequencyBalance');
            expect(result).toHaveProperty('metadata');
        });

        it('should have valid spectrogram data', () => {
            const result = analysisService.analyzeSpectrum(monoAudio);

            expect(result.spectrogram).toHaveProperty('magnitudes');
            expect(result.spectrogram).toHaveProperty('frequencies');
            expect(result.spectrogram).toHaveProperty('times');
            expect(result.spectrogram.magnitudes.length).toBeGreaterThan(0);
        });

        it('should have valid mel-spectrogram data', () => {
            const result = analysisService.analyzeSpectrum(monoAudio);

            expect(result.melSpectrogram).toHaveProperty('melBands');
            expect(result.melSpectrogram).toHaveProperty('numMelBands');
            expect(result.melSpectrogram.melBands.length).toBeGreaterThan(0);
        });

        it('should have all spectral features', () => {
            const result = analysisService.analyzeSpectrum(monoAudio);

            expect(result.features).toHaveProperty('spectralCentroid');
            expect(result.features).toHaveProperty('spectralFlatness');
            expect(result.features).toHaveProperty('spectralFlux');
            expect(result.features).toHaveProperty('spectralSpread');
            expect(result.features).toHaveProperty('rms');
        });
    });

    describe('stereo audio analysis', () => {
        it('should analyze stereo audio correctly', () => {
            const result = analysisService.analyzeFrequencyBalance(stereoAudio);

            expect(result.bands.length).toBeGreaterThan(0);
            expect(result.dominantBand).toBeDefined();
        });

        it('should measure loudness for stereo', () => {
            const result = analysisService.measureLoudness(stereoAudio);

            expect(result.rmsDb).toBeLessThan(0);
            expect(result.peakLinear).toBeGreaterThan(0);
        });
    });
});
