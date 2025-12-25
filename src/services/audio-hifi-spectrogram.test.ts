import * as path from 'path';
import * as fs from 'fs';
import { AudioAnalysisService } from './audio-analysis.js';
import { AudioVisualizationService } from './audio-visualization.js';
import { AudioFileService } from './audio-file.js';
import type { CapturedAudio, SpectrogramData } from '../types/audio.js';

const fixturesDir = path.join(__dirname, '__fixtures__');
const outputDir = path.join(__dirname, '__test_output__');

describe('High-Fidelity Spectrogram', () => {
    let analysisService: AudioAnalysisService;
    let visualizationService: AudioVisualizationService;
    let fileService: AudioFileService;
    let monoAudio: CapturedAudio;
    let stereoAudio: CapturedAudio;

    beforeAll(async () => {
        analysisService = new AudioAnalysisService();
        visualizationService = new AudioVisualizationService(outputDir);
        fileService = new AudioFileService();

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Load test audio files
        const monoPath = path.join(fixturesDir, 'mono-sine-440hz.wav');
        const stereoPath = path.join(fixturesDir, 'stereo-mix.wav');

        expect(fs.existsSync(monoPath)).toBe(true);
        expect(fs.existsSync(stereoPath)).toBe(true);

        monoAudio = await fileService.readWavFile(monoPath);
        stereoAudio = await fileService.readWavFile(stereoPath);
    });

    afterAll(() => {
        // Clean up test output files
        if (fs.existsSync(outputDir)) {
            const files = fs.readdirSync(outputDir);
            for (const file of files) {
                if (file.endsWith('.png')) {
                    fs.unlinkSync(path.join(outputDir, file));
                }
            }
        }
    });

    describe('computeSpectrogramWithConfig', () => {
        it('should compute spectrogram with default FFT size', () => {
            const result = analysisService.computeSpectrogramWithConfig(monoAudio);

            expect(result).toHaveProperty('magnitudes');
            expect(result).toHaveProperty('frequencies');
            expect(result).toHaveProperty('times');
            expect(result).toHaveProperty('fftSize');
            expect(result).toHaveProperty('hopSize');
            expect(result).toHaveProperty('numBins');
            expect(result).toHaveProperty('numFrames');
        });

        it('should compute spectrogram with FFT size 1024', () => {
            const result = analysisService.computeSpectrogramWithConfig(monoAudio, 1024);

            expect(result.fftSize).toBe(1024);
            expect(result.numBins).toBe(512); // FFT size / 2
        });

        it('should compute spectrogram with FFT size 2048', () => {
            const result = analysisService.computeSpectrogramWithConfig(monoAudio, 2048);

            expect(result.fftSize).toBe(2048);
            expect(result.numBins).toBe(1024);
        });

        it('should compute spectrogram with FFT size 4096', () => {
            const result = analysisService.computeSpectrogramWithConfig(monoAudio, 4096);

            expect(result.fftSize).toBe(4096);
            expect(result.numBins).toBe(2048);
        });

        it('should compute spectrogram with FFT size 8192', () => {
            const result = analysisService.computeSpectrogramWithConfig(monoAudio, 8192);

            expect(result.fftSize).toBe(8192);
            expect(result.numBins).toBe(4096);
        });

        it('should respect hop fraction parameter', () => {
            const result25 = analysisService.computeSpectrogramWithConfig(monoAudio, 2048, 0.25);
            const result50 = analysisService.computeSpectrogramWithConfig(monoAudio, 2048, 0.5);

            // Smaller hop = more frames
            expect(result25.numFrames).toBeGreaterThan(result50.numFrames);
            expect(result25.hopSize).toBe(512); // 2048 * 0.25
            expect(result50.hopSize).toBe(1024); // 2048 * 0.5
        });

        it('should have correct frequency bin centers', () => {
            const result = analysisService.computeSpectrogramWithConfig(monoAudio, 2048);

            // First bin should be 0 Hz, last bin should be near Nyquist
            expect(result.frequencies[0]).toBe(0);
            expect(result.frequencies[result.frequencies.length - 1]).toBeLessThan(monoAudio.sampleRate / 2);
        });

        it('should have magnitude data for all frames', () => {
            const result = analysisService.computeSpectrogramWithConfig(monoAudio, 2048);

            expect(result.magnitudes.length).toBe(result.numFrames);
            for (const frame of result.magnitudes) {
                expect(frame.length).toBe(result.numBins);
            }
        });

        it('should work with stereo audio', () => {
            const result = analysisService.computeSpectrogramWithConfig(stereoAudio, 2048);

            expect(result.numFrames).toBeGreaterThan(0);
            expect(result.magnitudes.length).toBe(result.numFrames);
        });
    });

    describe('renderHiFiSpectrogram', () => {
        let spectrogram: SpectrogramData;

        beforeAll(() => {
            spectrogram = analysisService.computeSpectrogramWithConfig(monoAudio, 2048);
        });

        it('should render spectrogram with default options', async () => {
            const result = await visualizationService.renderHiFiSpectrogram(spectrogram);

            expect(result).toHaveProperty('imagePath');
            expect(result).toHaveProperty('width');
            expect(result).toHaveProperty('height');
            expect(result).toHaveProperty('fftSize');
            expect(result).toHaveProperty('dbRange');
            expect(result).toHaveProperty('frequencyRange');

            // Default resolution is 1920x1080
            expect(result.width).toBe(1920);
            expect(result.height).toBe(1080);

            // File should exist
            expect(fs.existsSync(result.imagePath)).toBe(true);
        });

        it('should render with custom resolution', async () => {
            const result = await visualizationService.renderHiFiSpectrogram(spectrogram, {
                width: 800,
                height: 600
            });

            expect(result.width).toBe(800);
            expect(result.height).toBe(600);
            expect(fs.existsSync(result.imagePath)).toBe(true);
        });

        it('should render with logarithmic frequency scale', async () => {
            const result = await visualizationService.renderHiFiSpectrogram(spectrogram, {
                frequencyScale: 'logarithmic',
                width: 640,
                height: 480
            });

            expect(fs.existsSync(result.imagePath)).toBe(true);
        });

        it('should render with linear frequency scale', async () => {
            const result = await visualizationService.renderHiFiSpectrogram(spectrogram, {
                frequencyScale: 'linear',
                width: 640,
                height: 480
            });

            expect(fs.existsSync(result.imagePath)).toBe(true);
        });

        it('should render with custom dB range', async () => {
            const result = await visualizationService.renderHiFiSpectrogram(spectrogram, {
                minDb: -60,
                maxDb: -10,
                width: 640,
                height: 480
            });

            expect(result.dbRange.min).toBe(-60);
            expect(result.dbRange.max).toBe(-10);
            expect(fs.existsSync(result.imagePath)).toBe(true);
        });

        it('should render with custom frequency range', async () => {
            const result = await visualizationService.renderHiFiSpectrogram(spectrogram, {
                minFrequencyHz: 100,
                maxFrequencyHz: 8000,
                width: 640,
                height: 480
            });

            expect(result.frequencyRange.min).toBe(100);
            expect(result.frequencyRange.max).toBe(8000);
            expect(fs.existsSync(result.imagePath)).toBe(true);
        });

        it('should render with different colormaps', async () => {
            const colormaps = ['viridis', 'plasma', 'magma', 'inferno', 'grayscale'] as const;

            for (const colormap of colormaps) {
                const result = await visualizationService.renderHiFiSpectrogram(spectrogram, {
                    colormap,
                    width: 400,
                    height: 300
                });

                expect(fs.existsSync(result.imagePath)).toBe(true);
            }
        });

        it('should render without grid lines', async () => {
            const result = await visualizationService.renderHiFiSpectrogram(spectrogram, {
                showFrequencyGrid: false,
                showTimeGrid: false,
                width: 640,
                height: 480
            });

            expect(fs.existsSync(result.imagePath)).toBe(true);
        });

        it('should render without labels', async () => {
            const result = await visualizationService.renderHiFiSpectrogram(spectrogram, {
                showFrequencyLabels: false,
                showTimeLabels: false,
                showTitle: false,
                width: 640,
                height: 480
            });

            expect(fs.existsSync(result.imagePath)).toBe(true);
        });

        it('should render without colorbar', async () => {
            const result = await visualizationService.renderHiFiSpectrogram(spectrogram, {
                showColorbar: false,
                width: 640,
                height: 480
            });

            expect(fs.existsSync(result.imagePath)).toBe(true);
        });

        it('should render with custom title', async () => {
            const result = await visualizationService.renderHiFiSpectrogram(spectrogram, {
                title: 'Test Spectrogram',
                width: 640,
                height: 480
            });

            expect(fs.existsSync(result.imagePath)).toBe(true);
        });

        it('should return correct metadata', async () => {
            const result = await visualizationService.renderHiFiSpectrogram(spectrogram, {
                width: 800,
                height: 600
            });

            expect(result.fftSize).toBe(spectrogram.fftSize);
            expect(result.hopSize).toBe(spectrogram.hopSize);
            expect(result.numFrames).toBe(spectrogram.numFrames);
            expect(result.numBins).toBe(spectrogram.numBins);
            expect(result.sampleRate).toBe(spectrogram.sampleRate);
            expect(result.durationSeconds).toBeGreaterThan(0);
        });

        it('should save to custom output path', async () => {
            const customPath = path.join(outputDir, 'custom-spectrogram.png');

            const result = await visualizationService.renderHiFiSpectrogram(spectrogram, {
                outputPath: customPath,
                width: 640,
                height: 480
            });

            expect(result.imagePath).toBe(customPath);
            expect(fs.existsSync(customPath)).toBe(true);

            // Cleanup
            fs.unlinkSync(customPath);
        });
    });

    describe('end-to-end spectrogram generation', () => {
        it('should generate high-fidelity spectrogram from WAV file', async () => {
            // Full pipeline test
            const monoPath = path.join(fixturesDir, 'mono-sine-440hz.wav');
            const audio = await fileService.readWavFile(monoPath);

            // Compute with high-res FFT
            const spectrogram = analysisService.computeSpectrogramWithConfig(audio, 4096, 0.25);

            // Render full HD
            const result = await visualizationService.renderHiFiSpectrogram(spectrogram, {
                width: 1920,
                height: 1080,
                colormap: 'viridis',
                frequencyScale: 'logarithmic',
                minDb: -90,
                maxDb: 0,
                showFrequencyGrid: true,
                showTimeGrid: true,
                showColorbar: true,
                title: 'E2E Test: 440Hz Sine Wave'
            });

            expect(result.width).toBe(1920);
            expect(result.height).toBe(1080);
            expect(result.fftSize).toBe(4096);
            expect(fs.existsSync(result.imagePath)).toBe(true);

            // Verify file is valid PNG (check magic bytes)
            const buffer = fs.readFileSync(result.imagePath);
            const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
            expect(buffer.subarray(0, 4).equals(pngMagic)).toBe(true);
        });

        it('should handle stereo audio correctly', async () => {
            const stereoPath = path.join(fixturesDir, 'stereo-mix.wav');
            const audio = await fileService.readWavFile(stereoPath);

            const spectrogram = analysisService.computeSpectrogramWithConfig(audio, 2048);

            const result = await visualizationService.renderHiFiSpectrogram(spectrogram, {
                width: 1280,
                height: 720,
                title: 'Stereo Mix Spectrogram'
            });

            expect(fs.existsSync(result.imagePath)).toBe(true);
        });
    });
});
