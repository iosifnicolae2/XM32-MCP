/**
 * Audio device information from PortAudio
 */
export interface AudioDevice {
    id: number;
    name: string;
    hostApi: string;
    maxInputChannels: number;
    maxOutputChannels: number;
    defaultSampleRate: number;
    defaultLowInputLatency: number;
    defaultHighInputLatency: number;
    defaultLowOutputLatency: number;
    defaultHighOutputLatency: number;
    isLoopback: boolean;
}

/**
 * Audio capture configuration
 */
export interface AudioCaptureConfig {
    deviceId?: number;
    sampleRate: number;
    channels: number;
    bitDepth: 16 | 24 | 32;
}

/**
 * Captured audio data container
 */
export interface CapturedAudio {
    samples: Float32Array;
    sampleRate: number;
    channels: number;
    durationMs: number;
    deviceName: string;
    capturedAt: string;
}

/**
 * Available audio features for extraction
 */
export type AudioFeature =
    | 'amplitudeSpectrum'
    | 'powerSpectrum'
    | 'spectralCentroid'
    | 'spectralFlatness'
    | 'spectralFlux'
    | 'spectralSpread'
    | 'spectralRolloff'
    | 'spectralSlope'
    | 'spectralSkewness'
    | 'spectralKurtosis'
    | 'spectralCrest'
    | 'rms'
    | 'energy'
    | 'zcr'
    | 'loudness'
    | 'perceptualSpread'
    | 'perceptualSharpness'
    | 'mfcc'
    | 'chroma';

/**
 * Spectrogram data structure (STFT result)
 */
export interface SpectrogramData {
    /** Array of magnitude arrays per time frame */
    magnitudes: Float32Array[];
    /** Frequency bin centers in Hz */
    frequencies: number[];
    /** Time points in seconds */
    times: number[];
    /** FFT size used */
    fftSize: number;
    /** Hop size between frames */
    hopSize: number;
    /** Sample rate of the audio */
    sampleRate: number;
    /** Number of frequency bins */
    numBins: number;
    /** Number of time frames */
    numFrames: number;
}

/**
 * Mel-spectrogram data structure
 */
export interface MelSpectrogramData {
    /** Array of mel band values per time frame */
    melBands: Float32Array[];
    /** Number of mel filter banks */
    numMelBands: number;
    /** Time points in seconds */
    times: number[];
    /** Minimum frequency in Hz */
    minFreq: number;
    /** Maximum frequency in Hz */
    maxFreq: number;
    /** Sample rate of the audio */
    sampleRate: number;
    /** Number of time frames */
    numFrames: number;
}

/**
 * Feature extraction result for a single feature
 */
export interface FeatureResult {
    feature: AudioFeature;
    values: number | number[] | Float32Array;
    average?: number;
    min?: number;
    max?: number;
    unit: string;
    description: string;
}

/**
 * Frequency band definition
 */
export interface FrequencyBand {
    name: string;
    minHz: number;
    maxHz: number;
    description?: string;
}

/**
 * Frequency balance analysis result
 */
export interface FrequencyBalanceResult {
    bands: FrequencyBandEnergy[];
    dominantBand: string;
    balanceScore: number;
    recommendation?: string;
}

/**
 * Energy for a specific frequency band
 */
export interface FrequencyBandEnergy {
    band: FrequencyBand;
    energy: number;
    energyDb: number;
    percentage: number;
}

/**
 * Full spectrum analysis result
 */
export interface SpectrumAnalysisResult {
    spectrogram: SpectrogramData;
    melSpectrogram: MelSpectrogramData;
    features: {
        spectralCentroid: FeatureResult;
        spectralFlatness: FeatureResult;
        spectralFlux: FeatureResult;
        spectralSpread: FeatureResult;
        spectralRolloff: FeatureResult;
        rms: FeatureResult;
    };
    frequencyBalance: FrequencyBalanceResult;
    images?: AnalysisImages;
    metadata: AnalysisMetadata;
}

/**
 * Paths to generated analysis images
 */
export interface AnalysisImages {
    spectrogramPath?: string;
    melSpectrogramPath?: string;
    frequencyBalancePath?: string;
    waveformPath?: string;
}

/**
 * Analysis metadata
 */
export interface AnalysisMetadata {
    capturedAt: string;
    durationMs: number;
    sampleRate: number;
    deviceName: string;
    fftSize: number;
    hopSize: number;
}

/**
 * Render options for visualizations
 */
export interface RenderOptions {
    width?: number;
    height?: number;
    colormap?: 'viridis' | 'plasma' | 'magma' | 'inferno' | 'grayscale';
    outputPath?: string;
    filename?: string;
    showLabels?: boolean;
    showColorbar?: boolean;
}

/**
 * Loudness measurement result
 */
export interface LoudnessResult {
    rmsDb: number;
    peakDb: number;
    dynamicRangeDb: number;
    crestFactor: number;
    rmsLinear: number;
    peakLinear: number;
}

/**
 * Brightness (spectral centroid) result
 */
export interface BrightnessResult {
    centroidHz: number;
    normalizedBrightness: number;
    trend: 'bright' | 'neutral' | 'warm';
    average: number;
    min: number;
    max: number;
    recommendation?: string;
}

/**
 * Harshness (spectral flux) result
 */
export interface HarshnessResult {
    fluxAverage: number;
    fluxPeak: number;
    fluxValues: number[];
    harshFrequencies: number[];
    harshnessTrend: 'smooth' | 'moderate' | 'harsh';
    recommendation?: string;
}

/**
 * Masking detection result
 */
export interface MaskingResult {
    mfccCoefficients: number[][];
    potentialMasking: MaskingIssue[];
    overallMaskingRisk: 'low' | 'medium' | 'high';
    recommendation?: string;
}

/**
 * Individual masking issue
 */
export interface MaskingIssue {
    frequencyRange: { min: number; max: number };
    severity: 'low' | 'medium' | 'high';
    description: string;
}

/**
 * Audio capture status
 */
export interface AudioCaptureStatus {
    isCapturing: boolean;
    deviceId?: number;
    deviceName?: string;
    sampleRate?: number;
    channels?: number;
    capturedDurationMs?: number;
    bufferSize?: number;
}

/**
 * Analysis mode for tools
 */
export type AnalysisMode = 'instant' | 'interval';

/**
 * Default audio configuration values
 */
export const AUDIO_DEFAULTS = {
    sampleRate: 44100,
    channels: 2,
    bitDepth: 16 as const,
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
 * Audio recording configuration
 */
export interface AudioRecordConfig {
    deviceId?: number;
    durationSeconds: number;
    outputPath?: string;
    sampleRate?: number;
    channels?: number;
}

/**
 * Audio recording result
 */
export interface AudioRecordResult {
    filePath: string;
    durationMs: number;
    sampleRate: number;
    channels: number;
    deviceName: string;
    recordedAt: string;
    fileSize: number;
}

/**
 * Audio file metadata from reading a WAV file
 */
export interface AudioFileInfo {
    filePath: string;
    format: 'wav' | 'unknown';
    sampleRate: number;
    channels: number;
    bitDepth: number;
    durationMs: number;
    fileSize: number;
}
