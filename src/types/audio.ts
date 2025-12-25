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
    deviceId?: number | string;
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
    deviceId?: number | string;
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

// ============================================================================
// Problem Detection Types
// ============================================================================

/**
 * Types of audio problems that can be detected
 */
export type AudioProblemType = 'muddy' | 'harsh' | 'boxy' | 'thin' | 'nasal' | 'rumble' | 'sibilant';

/**
 * Severity levels for detected problems
 */
export type ProblemSeverity = 'none' | 'mild' | 'moderate' | 'severe';

/**
 * Individual audio problem detection result
 */
export interface AudioProblem {
    type: AudioProblemType;
    detected: boolean;
    severity: ProblemSeverity;
    frequencyRange: { min: number; max: number };
    energyDb: number;
    excessPercentage: number;
    recommendation: string;
}

/**
 * Comprehensive problem report
 */
export interface AudioProblemsReport {
    problems: AudioProblem[];
    overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
    prioritizedActions: string[];
}

/**
 * Clipping analysis result
 */
export interface ClippingAnalysis {
    hasClipping: boolean;
    clippedSamples: number;
    clippingPercentage: number;
    peakValue: number;
    peakDb: number;
    consecutiveClips: number;
    recommendation: string;
}

/**
 * Noise floor analysis result
 */
export interface NoiseFloorAnalysis {
    noiseFloorDb: number;
    signalPeakDb: number;
    signalRmsDb: number;
    signalToNoiseDb: number;
    quietSectionCount: number;
    suggestGate: boolean;
    gateThresholdDb?: number;
    recommendation: string;
}

// ============================================================================
// Dynamics Analysis Types
// ============================================================================

/**
 * Transient attack characteristics
 */
export type AttackCharacter = 'sharp' | 'medium' | 'soft';

/**
 * Transient analysis result
 */
export interface TransientAnalysis {
    transientCount: number;
    transientDensityPerSecond: number;
    averageAttackMs: number;
    peakAttackMs: number;
    attackCharacter: AttackCharacter;
    transientLocationsMs: number[];
    recommendation: string;
}

/**
 * Suggested compression settings
 */
export interface CompressionSettings {
    ratio: string;
    thresholdDb: number;
    attackMs: number;
    releaseMs: number;
    makeupGainDb: number;
}

/**
 * Compression needs assessment result
 */
export interface CompressionAssessment {
    dynamicRangeDb: number;
    peakToAverageRatio: number;
    crestFactorDb: number;
    needsCompression: boolean;
    compressionUrgency: 'none' | 'optional' | 'recommended' | 'essential';
    suggestedSettings: CompressionSettings;
    recommendation: string;
}

/**
 * Sibilance analysis result
 */
export interface SibilanceAnalysis {
    hasSibilance: boolean;
    severity: ProblemSeverity;
    sibilantFramePercentage: number;
    peakFrequencyHz: number;
    averageEnergyDb: number;
    deEsserSettings?: {
        frequencyHz: number;
        thresholdDb: number;
        rangeDb: number;
    };
    recommendation: string;
}

/**
 * Pumping/breathing artifact analysis
 */
export interface PumpingAnalysis {
    hasPumping: boolean;
    severity: ProblemSeverity;
    pumpingRateHz: number;
    modulationDepthDb: number;
    recommendation: string;
}

// ============================================================================
// Stereo/Spatial Analysis Types
// ============================================================================

/**
 * Mono compatibility rating
 */
export type MonoCompatibility = 'excellent' | 'good' | 'fair' | 'poor';

/**
 * Stereo width character
 */
export type StereoWidthCharacter = 'mono' | 'narrow' | 'normal' | 'wide' | 'very-wide';

/**
 * Phase correlation analysis result
 */
export interface PhaseAnalysis {
    correlationCoefficient: number;
    correlationMin: number;
    correlationMax: number;
    monoCompatibility: MonoCompatibility;
    hasPhaseIssues: boolean;
    problematicRegions: Array<{ startMs: number; endMs: number; correlation: number }>;
    recommendation: string;
}

/**
 * Stereo width analysis result
 */
export interface StereoWidthAnalysis {
    widthPercentage: number;
    sideMidRatio: number;
    midRmsDb: number;
    sideRmsDb: number;
    widthCharacter: StereoWidthCharacter;
    recommendation: string;
}

/**
 * Stereo balance analysis result
 */
export interface StereoBalanceAnalysis {
    balancePercentage: number;
    leftRmsDb: number;
    rightRmsDb: number;
    differenceDb: number;
    isBalanced: boolean;
    panDirection: 'center' | 'left' | 'right';
    recommendation: string;
}

/**
 * Comprehensive stereo field analysis
 */
export interface StereoFieldAnalysis {
    width: StereoWidthAnalysis;
    balance: StereoBalanceAnalysis;
    phase: PhaseAnalysis;
    isStereo: boolean;
    recommendation: string;
}

// ============================================================================
// Comprehensive Mix Diagnostic Types
// ============================================================================

/**
 * Gain staging status
 */
export type GainStagingStatus = 'too-hot' | 'optimal' | 'too-quiet' | 'clipping';

/**
 * Gain staging analysis
 */
export interface GainStagingAnalysis {
    status: GainStagingStatus;
    peakDb: number;
    rmsDb: number;
    headroomDb: number;
    noiseFloorDb: number;
    signalToNoiseDb: number;
    recommendations: string[];
}

/**
 * Problem frequency to cut
 */
export interface ProblemFrequency {
    frequencyHz: number;
    problem: AudioProblemType;
    suggestedCutDb: number;
    qValue: number;
}

/**
 * Subtractive EQ suggestions
 */
export interface SubtractiveEqSuggestions {
    needsHpf: boolean;
    suggestedHpfHz?: number;
    hpfSlope?: '12dB' | '18dB' | '24dB';
    problemFrequencies: ProblemFrequency[];
    recommendations: string[];
}

/**
 * EQ boost suggestion
 */
export interface EqBoost {
    frequencyHz: number;
    reason: string;
    suggestedBoostDb: number;
    qValue: number;
}

/**
 * Additive EQ suggestions
 */
export interface AdditiveEqSuggestions {
    boosts: EqBoost[];
    recommendations: string[];
}

/**
 * Dynamics section of mix analysis
 */
export interface DynamicsAnalysisSummary {
    needsCompression: boolean;
    compressionSettings?: CompressionSettings;
    needsDeEsser: boolean;
    deEsserFrequencyHz?: number;
    needsLimiter: boolean;
    recommendations: string[];
}

/**
 * Spatial analysis summary
 */
export interface SpatialAnalysisSummary {
    isDry: boolean;
    stereoWidth: StereoWidthCharacter;
    hasPhaseIssues: boolean;
    isBalanced: boolean;
    suggestReverb: boolean;
    suggestDelay: boolean;
    recommendations: string[];
}

/**
 * Overall mix assessment
 */
export type MixAssessment = 'ready-for-mix' | 'needs-work' | 'significant-issues';

/**
 * Mix analysis summary
 */
export interface MixSummary {
    overallAssessment: MixAssessment;
    qualityScore: number;
    prioritizedRecommendations: string[];
}

/**
 * Audio source type for context-aware analysis
 */
export type AudioSourceType = 'vocal' | 'instrument' | 'drums' | 'bass' | 'full-mix' | 'unknown';

/**
 * Comprehensive mixing diagnostic result
 */
export interface MixingDiagnostic {
    sourceType: AudioSourceType;
    gainStaging: GainStagingAnalysis;
    subtractiveEq: SubtractiveEqSuggestions;
    dynamics: DynamicsAnalysisSummary;
    additiveEq: AdditiveEqSuggestions;
    spatial: SpatialAnalysisSummary;
    summary: MixSummary;
}

// ============================================================================
// High-Fidelity Spectrogram Types
// ============================================================================

/**
 * Supported FFT sizes for spectrogram generation
 * Trade-off: Larger = better frequency resolution, worse time resolution
 */
export type SpectrogramFFTSize = 1024 | 2048 | 4096 | 8192;

/**
 * Frequency scale mode for spectrogram rendering
 */
export type FrequencyScaleMode = 'linear' | 'logarithmic';

/**
 * High-fidelity spectrogram render options
 */
export interface HiFiSpectrogramOptions {
    /** Output width in pixels (default: 1920) */
    width?: number;
    /** Output height in pixels (default: 1080) */
    height?: number;
    /** Colormap for visualization (default: 'viridis') */
    colormap?: 'viridis' | 'plasma' | 'magma' | 'inferno' | 'grayscale';
    /** Output file path (directory or full path) */
    outputPath?: string;
    /** Custom filename (default: auto-generated with timestamp) */
    filename?: string;
    /** Frequency scale mode (default: 'logarithmic') */
    frequencyScale?: FrequencyScaleMode;
    /** FFT size for analysis (default: 4096) */
    fftSize?: SpectrogramFFTSize;
    /** Hop size as fraction of FFT size (default: 0.25 = 75% overlap) */
    hopFraction?: number;
    /** Minimum dB value for dynamic range (default: -90) */
    minDb?: number;
    /** Maximum dB value for dynamic range (default: 0) */
    maxDb?: number;
    /** Show frequency axis labels (default: true) */
    showFrequencyLabels?: boolean;
    /** Show time axis labels (default: true) */
    showTimeLabels?: boolean;
    /** Show frequency grid lines (default: true) */
    showFrequencyGrid?: boolean;
    /** Show time grid lines (default: true) */
    showTimeGrid?: boolean;
    /** Show colorbar legend (default: true) */
    showColorbar?: boolean;
    /** Show title (default: true) */
    showTitle?: boolean;
    /** Custom title text (default: 'Spectrogram') */
    title?: string;
    /** Minimum frequency to display in Hz (default: 20) */
    minFrequencyHz?: number;
    /** Maximum frequency to display in Hz (default: Nyquist) */
    maxFrequencyHz?: number;
}

/**
 * Result from high-fidelity spectrogram generation
 */
export interface HiFiSpectrogramResult {
    /** Path to generated image file */
    imagePath: string;
    /** Actual width of generated image */
    width: number;
    /** Actual height of generated image */
    height: number;
    /** FFT size used for analysis */
    fftSize: number;
    /** Hop size in samples */
    hopSize: number;
    /** Number of time frames */
    numFrames: number;
    /** Number of frequency bins */
    numBins: number;
    /** Actual dB range used */
    dbRange: { min: number; max: number };
    /** Frequency range displayed */
    frequencyRange: { min: number; max: number };
    /** Duration of audio in seconds */
    durationSeconds: number;
    /** Sample rate of source audio */
    sampleRate: number;
}
