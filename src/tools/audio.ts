import * as path from 'path';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AudioCaptureService } from '../services/audio-capture.js';
import { AudioAnalysisService } from '../services/audio-analysis.js';
import { AudioVisualizationService } from '../services/audio-visualization.js';
import { AudioFileService } from '../services/audio-file.js';
import { AudioProblemDetectionService } from '../services/audio-problem-detection.js';
import { AudioDynamicsService } from '../services/audio-dynamics-analysis.js';
import { AudioStereoAnalysisService } from '../services/audio-stereo-analysis.js';
import type { AnalysisImages, AUDIO_DEFAULTS, AudioProblemType } from '../types/audio.js';

const DEFAULTS: Pick<typeof AUDIO_DEFAULTS, 'maxRecordingSeconds'> = {
    maxRecordingSeconds: 300
};

/**
 * Audio domain tools
 * Semantic, task-based tools for audio capture and analysis
 */

/**
 * Error messages for audio tools
 */
const AudioError = {
    noCaptureDevice: () => 'No audio capture device available. Please check your audio device connections and permissions.',
    captureInProgress: () => 'Audio capture is already in progress. Stop the current capture first.',
    notCapturing: () => 'No audio capture in progress. Start capture first with audio_capture_start.',
    captureFailed: (msg: string) => `Audio capture failed: ${msg}`,
    analysisFailed: (msg: string) => `Audio analysis failed: ${msg}`,
    invalidDuration: (min: number, max: number) => `Duration must be between ${min}ms and ${max}ms.`,
    fileNotFound: (path: string) => `Audio file not found: ${path}`,
    invalidWavFormat: (details: string) => `Invalid WAV file: ${details}`,
    recordingFailed: (msg: string) => `Recording failed: ${msg}`,
    fileReadFailed: (msg: string) => `Failed to read audio file: ${msg}`
};

/**
 * Register audio_list_devices tool
 * List available audio capture devices
 */
function registerAudioListDevicesTool(server: McpServer, captureService: AudioCaptureService): void {
    server.registerTool(
        'audio_list_devices',
        {
            title: 'List Audio Capture Devices',
            description:
                'List all available audio input devices that can be used for audio capture, including system loopback devices for capturing speaker output. Use this to find the device ID or name to use with other audio tools.',
            inputSchema: {
                includeLoopback: z.boolean().default(true).describe('Include loopback/monitor devices for capturing system audio output')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ includeLoopback = true }): Promise<CallToolResult> => {
            try {
                const devices = await captureService.listDevices(includeLoopback);

                if (devices.length === 0) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'No audio input devices found. Please check your audio device connections.'
                            }
                        ]
                    };
                }

                const deviceList = devices
                    .map(d => {
                        const loopbackTag = d.isLoopback ? ' [LOOPBACK]' : '';
                        return `- ID ${d.id}: ${d.name}${loopbackTag}\n  Channels: ${d.maxInputChannels} in / ${d.maxOutputChannels} out | Sample Rate: ${d.defaultSampleRate} Hz | Host: ${d.hostApi}`;
                    })
                    .join('\n\n');

                const loopbackDevices = devices.filter(d => d.isLoopback);
                const loopbackNote =
                    loopbackDevices.length > 0
                        ? `\n\nRecommended loopback device: "${loopbackDevices[0].name}" (ID: ${loopbackDevices[0].id})`
                        : '\n\nNo loopback devices detected. For system audio capture, consider installing BlackHole (macOS), VB-Cable (Windows), or configuring PulseAudio monitor (Linux).';

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Found ${devices.length} audio device(s):\n\n${deviceList}${loopbackNote}`
                        }
                    ]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Failed to list audio devices: ${error instanceof Error ? error.message : String(error)}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register audio_record tool
 * Record audio to WAV file
 */
function registerAudioRecordTool(server: McpServer, captureService: AudioCaptureService, fileService: AudioFileService): void {
    server.registerTool(
        'audio_record',
        {
            title: 'Record Audio to File',
            description:
                'Record audio from a capture device for a specified duration and save to WAV file. ' +
                'Use audio_list_devices first to find available devices. ' +
                'The recorded file can then be analyzed using other audio analysis tools (audio_analyze_spectrum, audio_get_frequency_balance, etc.).',
            inputSchema: {
                deviceId: z
                    .union([z.string(), z.number()])
                    .optional()
                    .describe('Device ID or name to record from. Defaults to first available loopback device.'),
                durationSeconds: z
                    .number()
                    .min(0.1)
                    .max(DEFAULTS.maxRecordingSeconds)
                    .describe(`Recording duration in seconds (0.1-${DEFAULTS.maxRecordingSeconds}). Maximum 5 minutes.`),
                outputPath: z
                    .string()
                    .optional()
                    .describe('Output file path for WAV file. If not specified, saves to default recordings directory with timestamp.'),
                sampleRate: z.number().default(44100).describe('Sample rate in Hz (default: 44100)'),
                channels: z.number().min(1).max(2).default(2).describe('Number of channels: 1 (mono) or 2 (stereo). Default: 2')
            },
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: true
            }
        },
        async ({ deviceId, durationSeconds, outputPath, sampleRate = 44100, channels = 2 }): Promise<CallToolResult> => {
            try {
                const result = await captureService.recordToFile(
                    {
                        deviceId: deviceId !== undefined ? (isNaN(Number(deviceId)) ? deviceId : Number(deviceId)) : undefined,
                        durationSeconds,
                        outputPath,
                        sampleRate,
                        channels
                    },
                    fileService
                );

                const fileSizeKB = (result.fileSize / 1024).toFixed(1);
                const durationFormatted = (result.durationMs / 1000).toFixed(2);

                const resultText = `## Recording Complete

**File:** ${result.filePath}

**Details:**
- Duration: ${durationFormatted} seconds
- Sample Rate: ${result.sampleRate} Hz
- Channels: ${result.channels}
- Device: ${result.deviceName}
- File Size: ${fileSizeKB} KB
- Recorded At: ${result.recordedAt}

**Next Steps:**
Use this file with audio analysis tools:
- \`audio_analyze_spectrum\` - Full spectrum analysis
- \`audio_get_frequency_balance\` - Frequency distribution
- \`audio_get_loudness\` - Level measurement
- \`audio_analyze_brightness\` - Tonal balance
- \`audio_analyze_harshness\` - Harshness detection
- \`audio_detect_masking\` - Frequency masking issues`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.recordingFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register audio_analyze_spectrum tool
 * Full spectrum analysis with visualization (file-based)
 */
function registerAudioAnalyzeSpectrumTool(
    server: McpServer,
    fileService: AudioFileService,
    analysisService: AudioAnalysisService,
    visualizationService: AudioVisualizationService
): void {
    server.registerTool(
        'audio_analyze_spectrum',
        {
            title: 'Analyze Audio Spectrum',
            description:
                'Perform comprehensive spectrum analysis on a recorded WAV file. Extracts STFT spectrogram, mel-spectrogram, and key spectral features. ' +
                'Use audio_record first to create a recording, then pass the file path here.',
            inputSchema: {
                filePath: z.string().describe('Path to the WAV file to analyze. Can be absolute or relative to recordings directory.'),
                generateImages: z.boolean().default(true).describe('Generate PNG visualizations of the spectrogram and analysis'),
                outputPath: z.string().optional().describe('Output path for generated images (relative or absolute directory/file path)')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath, generateImages = true, outputPath }): Promise<CallToolResult> => {
            try {
                // Validate and read file
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                // Read audio from file
                const audio = await fileService.readWavFile(filePath);

                // Analyze
                const analysis = analysisService.analyzeSpectrum(audio);

                // Generate images if requested
                let images: AnalysisImages | undefined;
                if (generateImages) {
                    const renderOptions = { outputPath, showLabels: true };

                    const spectrogramPath = await visualizationService.renderSpectrogram(analysis.spectrogram, renderOptions);
                    const melSpectrogramPath = await visualizationService.renderMelSpectrogram(analysis.melSpectrogram, {
                        ...renderOptions,
                        colormap: 'magma'
                    });
                    const frequencyBalancePath = await visualizationService.renderFrequencyBalance(
                        analysis.frequencyBalance,
                        renderOptions
                    );

                    images = {
                        spectrogramPath,
                        melSpectrogramPath,
                        frequencyBalancePath
                    };
                }

                // Format results
                const { features, frequencyBalance, metadata } = analysis;

                const featuresText = [
                    `Spectral Centroid: ${(features.spectralCentroid.average ?? 0).toFixed(3)} (${features.spectralCentroid.description})`,
                    `Spectral Flatness: ${(features.spectralFlatness.average ?? 0).toFixed(3)} (${features.spectralFlatness.description})`,
                    `Spectral Flux: ${(features.spectralFlux.average ?? 0).toFixed(3)} (${features.spectralFlux.description})`,
                    `Spectral Spread: ${(features.spectralSpread.average ?? 0).toFixed(3)} (${features.spectralSpread.description})`,
                    `RMS Level: ${(features.rms.average ?? 0).toFixed(4)}`
                ].join('\n');

                const balanceText = frequencyBalance.bands
                    .map(b => `  ${b.band.name}: ${b.percentage.toFixed(1)}% (${b.energyDb.toFixed(1)} dB)`)
                    .join('\n');

                let resultText = `## Spectrum Analysis Results

**File:** ${fileService.resolveFilePath(filePath)}

**Audio Info:**
- Source: ${metadata.deviceName}
- Duration: ${metadata.durationMs}ms
- Sample Rate: ${metadata.sampleRate} Hz
- FFT Size: ${metadata.fftSize}

**Spectral Features:**
${featuresText}

**Frequency Balance:**
${balanceText}
- Dominant Band: ${frequencyBalance.dominantBand}
- Balance Score: ${frequencyBalance.balanceScore}/100
${frequencyBalance.recommendation ? `- Recommendation: ${frequencyBalance.recommendation}` : ''}`;

                if (images) {
                    resultText += `

**Generated Images:**
- Spectrogram: ${images.spectrogramPath}
- Mel-Spectrogram: ${images.melSpectrogramPath}
- Frequency Balance: ${images.frequencyBalancePath}`;
                }

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register audio_get_frequency_balance tool (file-based)
 */
function registerAudioGetFrequencyBalanceTool(
    server: McpServer,
    fileService: AudioFileService,
    analysisService: AudioAnalysisService,
    visualizationService: AudioVisualizationService
): void {
    server.registerTool(
        'audio_get_frequency_balance',
        {
            title: 'Get Frequency Balance',
            description:
                'Analyze the frequency balance of a recorded WAV file across standard frequency bands (sub-bass, bass, low-mid, mid, high-mid, presence, brilliance). ' +
                'Returns energy distribution, balance assessment, and mixing recommendations. Use audio_record first to create a recording.',
            inputSchema: {
                filePath: z.string().describe('Path to the WAV file to analyze. Can be absolute or relative to recordings directory.'),
                generateImage: z.boolean().default(true).describe('Generate a PNG bar chart of frequency balance'),
                outputPath: z.string().optional().describe('Output path for generated image')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath, generateImage = true, outputPath }): Promise<CallToolResult> => {
            try {
                // Validate and read file
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                const audio = await fileService.readWavFile(filePath);
                const result = analysisService.analyzeFrequencyBalance(audio);

                let imagePath: string | undefined;
                if (generateImage) {
                    imagePath = await visualizationService.renderFrequencyBalance(result, {
                        outputPath
                    });
                }

                const bandsText = result.bands
                    .map(
                        b =>
                            `- ${b.band.name} (${b.band.minHz}-${b.band.maxHz} Hz): ${b.percentage.toFixed(1)}% | ${b.energyDb.toFixed(1)} dB`
                    )
                    .join('\n');

                let resultText = `## Frequency Balance Analysis

**File:** ${fileService.resolveFilePath(filePath)}

**Energy Distribution:**
${bandsText}

**Summary:**
- Dominant Band: ${result.dominantBand}
- Balance Score: ${result.balanceScore}/100 (100 = perfectly balanced)
${result.recommendation ? `\n**Recommendation:** ${result.recommendation}` : ''}`;

                if (imagePath) {
                    resultText += `\n\n**Chart:** ${imagePath}`;
                }

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register audio_get_loudness tool (file-based)
 */
function registerAudioGetLoudnessTool(server: McpServer, fileService: AudioFileService, analysisService: AudioAnalysisService): void {
    server.registerTool(
        'audio_get_loudness',
        {
            title: 'Get Audio Loudness',
            description:
                'Measure the loudness (RMS) of a recorded WAV file. Returns average RMS, peak level, dynamic range, and crest factor. ' +
                'Useful for level checking and gain staging. Use audio_record first to create a recording.',
            inputSchema: {
                filePath: z.string().describe('Path to the WAV file to analyze. Can be absolute or relative to recordings directory.')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath }): Promise<CallToolResult> => {
            try {
                // Validate and read file
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                const audio = await fileService.readWavFile(filePath);
                const result = analysisService.measureLoudness(audio);

                const resultText = `## Loudness Measurement

**File:** ${fileService.resolveFilePath(filePath)}

**Levels:**
- RMS Level: ${result.rmsDb} dB (linear: ${result.rmsLinear.toFixed(4)})
- Peak Level: ${result.peakDb} dB (linear: ${result.peakLinear.toFixed(4)})
- Dynamic Range: ${result.dynamicRangeDb} dB
- Crest Factor: ${result.crestFactor.toFixed(2)}

**Interpretation:**
${result.rmsDb > -6 ? '- Level is HOT - consider reducing gain to avoid clipping' : ''}
${result.rmsDb < -20 ? '- Level is LOW - consider increasing gain for better signal-to-noise' : ''}
${result.rmsDb >= -20 && result.rmsDb <= -6 ? '- Level is in a good range for mixing' : ''}
${result.dynamicRangeDb > 20 ? '- High dynamic range - audio has good transient preservation' : ''}
${result.dynamicRangeDb < 6 ? '- Low dynamic range - audio may be over-compressed' : ''}`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register audio_analyze_brightness tool (file-based)
 */
function registerAudioAnalyzeBrightnessTool(server: McpServer, fileService: AudioFileService, analysisService: AudioAnalysisService): void {
    server.registerTool(
        'audio_analyze_brightness',
        {
            title: 'Analyze Audio Brightness',
            description:
                'Measure the spectral centroid (brightness) of a recorded WAV file. Higher values indicate brighter/treble-heavy sound, ' +
                'lower values indicate warmer/bass-heavy sound. Useful for tonal balance assessment. Use audio_record first to create a recording.',
            inputSchema: {
                filePath: z.string().describe('Path to the WAV file to analyze. Can be absolute or relative to recordings directory.')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath }): Promise<CallToolResult> => {
            try {
                // Validate and read file
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                const audio = await fileService.readWavFile(filePath);
                const result = analysisService.analyzeBrightness(audio);

                const trendEmoji = result.trend === 'bright' ? '☀️' : result.trend === 'warm' ? '🔥' : '⚖️';

                const resultText = `## Brightness Analysis ${trendEmoji}

**File:** ${fileService.resolveFilePath(filePath)}

**Spectral Centroid:**
- Average: ${result.centroidHz} Hz
- Range: ${result.min} - ${result.max} Hz
- Normalized: ${result.normalizedBrightness} (0 = bass-heavy, 1 = treble-heavy)

**Trend:** ${result.trend.toUpperCase()}
${result.recommendation ? `\n**Recommendation:** ${result.recommendation}` : ''}`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register audio_analyze_harshness tool (file-based)
 */
function registerAudioAnalyzeHarshnessTool(server: McpServer, fileService: AudioFileService, analysisService: AudioAnalysisService): void {
    server.registerTool(
        'audio_analyze_harshness',
        {
            title: 'Analyze Audio Harshness',
            description:
                'Measure spectral flux to detect harshness and roughness in a recorded WAV file. High values may indicate harsh frequencies ' +
                '(typically 2-4 kHz) that could benefit from EQ adjustment or de-essing. Use audio_record first to create a recording.',
            inputSchema: {
                filePath: z.string().describe('Path to the WAV file to analyze. Can be absolute or relative to recordings directory.')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath }): Promise<CallToolResult> => {
            try {
                // Validate and read file
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                const audio = await fileService.readWavFile(filePath);
                const result = analysisService.analyzeHarshness(audio);

                const trendEmoji = result.harshnessTrend === 'harsh' ? '⚠️' : result.harshnessTrend === 'moderate' ? '📊' : '✅';

                const resultText = `## Harshness Analysis ${trendEmoji}

**File:** ${fileService.resolveFilePath(filePath)}

**Spectral Flux:**
- Average: ${result.fluxAverage}
- Peak: ${result.fluxPeak}

**Trend:** ${result.harshnessTrend.toUpperCase()}
${result.harshFrequencies.length > 0 ? `\n**Potentially Harsh Frequencies:** ${result.harshFrequencies.join(', ')} Hz` : ''}
${result.recommendation ? `\n**Recommendation:** ${result.recommendation}` : ''}`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register audio_detect_masking tool (file-based)
 */
function registerAudioDetectMaskingTool(server: McpServer, fileService: AudioFileService, analysisService: AudioAnalysisService): void {
    server.registerTool(
        'audio_detect_masking',
        {
            title: 'Detect Frequency Masking',
            description:
                'Use MFCC analysis to detect potential frequency masking issues in a recorded WAV file where instruments/voices may be ' +
                'competing for the same frequency space. Helps identify areas where EQ separation or panning adjustments may improve clarity. ' +
                'Use audio_record first to create a recording.',
            inputSchema: {
                filePath: z.string().describe('Path to the WAV file to analyze. Can be absolute or relative to recordings directory.')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath }): Promise<CallToolResult> => {
            try {
                // Validate and read file
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                const audio = await fileService.readWavFile(filePath);
                const result = analysisService.detectMasking(audio);

                const riskEmoji = result.overallMaskingRisk === 'high' ? '🔴' : result.overallMaskingRisk === 'medium' ? '🟡' : '🟢';

                let issuesText = 'No significant masking issues detected.';
                if (result.potentialMasking.length > 0) {
                    issuesText = result.potentialMasking
                        .map(m => `- ${m.frequencyRange.min}-${m.frequencyRange.max} Hz: ${m.severity.toUpperCase()} - ${m.description}`)
                        .join('\n');
                }

                const resultText = `## Frequency Masking Detection ${riskEmoji}

**File:** ${fileService.resolveFilePath(filePath)}

**Overall Masking Risk:** ${result.overallMaskingRisk.toUpperCase()}

**Potential Issues:**
${issuesText}

**MFCC Analysis:**
- Analyzed ${result.mfccCoefficients.length} frames
- ${result.potentialMasking.length} potential masking regions identified
${result.recommendation ? `\n**Recommendation:** ${result.recommendation}` : ''}`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

// ============================================================================
// Problem Detection Tools
// ============================================================================

/**
 * Register audio_analyze_eq_problems tool
 * Detect EQ issues: muddy, harsh, boxy, thin, nasal, rumble, sibilant
 */
function registerAudioAnalyzeEqProblemsTool(
    server: McpServer,
    fileService: AudioFileService,
    problemService: AudioProblemDetectionService
): void {
    server.registerTool(
        'audio_analyze_eq_problems',
        {
            title: 'Analyze EQ Problems',
            description:
                'Detect common EQ problems in a recorded WAV file: muddy (200-400Hz), harsh (2.5-4kHz), boxy (400-800Hz), ' +
                'thin (lacking bass), nasal (800-1500Hz), rumble (20-80Hz), and sibilance (5-8kHz). ' +
                'Returns severity levels and specific frequency recommendations for each detected problem.',
            inputSchema: {
                filePath: z.string().describe('Path to the WAV file to analyze'),
                problems: z
                    .array(z.enum(['all', 'muddy', 'harsh', 'boxy', 'thin', 'nasal', 'rumble', 'sibilant']))
                    .default(['all'])
                    .describe('Specific problems to check for, or "all" for comprehensive analysis')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath, problems = ['all'] }): Promise<CallToolResult> => {
            try {
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                const audio = await fileService.readWavFile(filePath);
                const report = problemService.detectAllProblems(audio);

                // Filter problems if specific ones requested
                const filteredProblems = problems.includes('all')
                    ? report.problems
                    : report.problems.filter(p => problems.includes(p.type as AudioProblemType | 'all'));

                const detectedProblems = filteredProblems.filter(p => p.detected);
                const qualityEmoji =
                    report.overallQuality === 'excellent'
                        ? '✅'
                        : report.overallQuality === 'good'
                          ? '👍'
                          : report.overallQuality === 'fair'
                            ? '⚠️'
                            : '❌';

                const problemsText =
                    filteredProblems.length > 0
                        ? filteredProblems
                              .map(p => {
                                  const emoji = p.detected
                                      ? p.severity === 'severe'
                                          ? '🔴'
                                          : p.severity === 'moderate'
                                            ? '🟡'
                                            : '🟢'
                                      : '⚪';
                                  const status = p.detected ? `${p.severity.toUpperCase()} (+${p.excessPercentage}%)` : 'Not detected';
                                  return `${emoji} **${p.type.toUpperCase()}** (${p.frequencyRange.min}-${p.frequencyRange.max}Hz): ${status}\n   ${p.recommendation}`;
                              })
                              .join('\n\n')
                        : 'No problems analyzed.';

                const resultText = `## EQ Problem Analysis ${qualityEmoji}

**File:** ${fileService.resolveFilePath(filePath)}

**Overall Quality:** ${report.overallQuality.toUpperCase()}

**Detected Problems:** ${detectedProblems.length}/${filteredProblems.length}

${problemsText}

${report.prioritizedActions.length > 0 ? `**Priority Actions:**\n${report.prioritizedActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}` : ''}`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register audio_analyze_clipping tool
 */
function registerAudioAnalyzeClippingTool(
    server: McpServer,
    fileService: AudioFileService,
    problemService: AudioProblemDetectionService
): void {
    server.registerTool(
        'audio_analyze_clipping',
        {
            title: 'Analyze Audio Clipping',
            description:
                'Detect digital clipping and peak distortion in a recorded WAV file. ' +
                'Reports the number of clipped samples, their locations, and severity. ' +
                'Essential for gain staging and identifying distortion issues.',
            inputSchema: {
                filePath: z.string().describe('Path to the WAV file to analyze'),
                threshold: z
                    .number()
                    .min(0.9)
                    .max(1.0)
                    .default(0.99)
                    .describe('Sample value threshold to consider as clipping (0.99 = 99% of max)')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath, threshold = 0.99 }): Promise<CallToolResult> => {
            try {
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                const audio = await fileService.readWavFile(filePath);
                const result = problemService.detectClipping(audio, threshold);

                const statusEmoji = result.hasClipping ? (result.clippingPercentage > 1 ? '🔴' : '🟡') : '✅';

                const resultText = `## Clipping Analysis ${statusEmoji}

**File:** ${fileService.resolveFilePath(filePath)}

**Status:** ${result.hasClipping ? 'CLIPPING DETECTED' : 'No significant clipping'}

**Peak Level:**
- Peak Value: ${result.peakValue} (${result.peakDb} dB)

**Clipping Statistics:**
- Clipped Samples: ${result.clippedSamples} (${result.clippingPercentage}%)
- Consecutive Clip Events: ${result.consecutiveClips}
- Detection Threshold: ${threshold}

**Recommendation:** ${result.recommendation}`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register audio_analyze_noise_floor tool
 */
function registerAudioAnalyzeNoiseFloorTool(
    server: McpServer,
    fileService: AudioFileService,
    problemService: AudioProblemDetectionService
): void {
    server.registerTool(
        'audio_analyze_noise_floor',
        {
            title: 'Analyze Noise Floor',
            description:
                'Analyze the signal-to-noise ratio and noise floor of a recorded WAV file. ' +
                'Determines if noise reduction or gating is needed and suggests threshold settings. ' +
                'Essential for clean recordings and proper gain staging.',
            inputSchema: {
                filePath: z.string().describe('Path to the WAV file to analyze'),
                quietThresholdDb: z
                    .number()
                    .default(-40)
                    .describe('dB threshold below which audio is considered "quiet" for noise measurement')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath, quietThresholdDb = -40 }): Promise<CallToolResult> => {
            try {
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                const audio = await fileService.readWavFile(filePath);
                const result = problemService.analyzeNoiseFloor(audio, quietThresholdDb);

                const snrEmoji =
                    result.signalToNoiseDb > 60 ? '✅' : result.signalToNoiseDb > 40 ? '👍' : result.signalToNoiseDb > 20 ? '⚠️' : '❌';

                const resultText = `## Noise Floor Analysis ${snrEmoji}

**File:** ${fileService.resolveFilePath(filePath)}

**Signal Levels:**
- Signal Peak: ${result.signalPeakDb} dB
- Signal RMS: ${result.signalRmsDb} dB

**Noise Analysis:**
- Noise Floor: ${result.noiseFloorDb} dB
- Signal-to-Noise Ratio: ${result.signalToNoiseDb} dB
- Quiet Sections Found: ${result.quietSectionCount}

**Gate Recommendation:**
${result.suggestGate ? `- Noise gate recommended at ${result.gateThresholdDb} dB threshold` : '- No noise gate needed'}

**Recommendation:** ${result.recommendation}`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

// ============================================================================
// Dynamics Analysis Tools
// ============================================================================

/**
 * Register audio_analyze_transients tool
 */
function registerAudioAnalyzeTransientsTool(server: McpServer, fileService: AudioFileService, dynamicsService: AudioDynamicsService): void {
    server.registerTool(
        'audio_analyze_transients',
        {
            title: 'Analyze Transients',
            description:
                'Analyze transient attack characteristics of a recorded WAV file. ' +
                'Identifies attack speed, transient density, and recommends compressor attack/release settings. ' +
                'Essential for drums, percussion, and any material with sharp attacks.',
            inputSchema: {
                filePath: z.string().describe('Path to the WAV file to analyze'),
                sensitivity: z
                    .enum(['low', 'medium', 'high'])
                    .default('medium')
                    .describe('Detection sensitivity - higher detects more subtle transients')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath, sensitivity = 'medium' }): Promise<CallToolResult> => {
            try {
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                const audio = await fileService.readWavFile(filePath);
                const result = dynamicsService.detectTransients(audio, sensitivity);

                const characterEmoji = result.attackCharacter === 'sharp' ? '⚡' : result.attackCharacter === 'medium' ? '📊' : '🌊';

                const resultText = `## Transient Analysis ${characterEmoji}

**File:** ${fileService.resolveFilePath(filePath)}

**Transient Count:** ${result.transientCount}
**Density:** ${result.transientDensityPerSecond} transients/second

**Attack Characteristics:**
- Attack Character: ${result.attackCharacter.toUpperCase()}
- Average Attack Time: ${result.averageAttackMs} ms
- Fastest Attack: ${result.peakAttackMs} ms

**Transient Locations (first 10):**
${result.transientLocationsMs
    .slice(0, 10)
    .map(t => `- ${t} ms`)
    .join('\n')}
${result.transientLocationsMs.length > 10 ? `\n... and ${result.transientLocationsMs.length - 10} more` : ''}

**Recommendation:** ${result.recommendation}`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register audio_analyze_dynamics tool
 */
function registerAudioAnalyzeDynamicsTool(server: McpServer, fileService: AudioFileService, dynamicsService: AudioDynamicsService): void {
    server.registerTool(
        'audio_analyze_dynamics',
        {
            title: 'Analyze Dynamic Range',
            description:
                'Analyze dynamic range and assess compression needs for a recorded WAV file. ' +
                'Returns dynamic range measurements, peak-to-average ratio, and suggests specific compression settings (ratio, threshold, attack, release). ' +
                'Essential for leveling and dynamics control decisions.',
            inputSchema: {
                filePath: z.string().describe('Path to the WAV file to analyze'),
                targetDynamicRangeDb: z.number().min(6).max(30).default(12).describe('Target dynamic range in dB for the compressed audio')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath, targetDynamicRangeDb = 12 }): Promise<CallToolResult> => {
            try {
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                const audio = await fileService.readWavFile(filePath);
                const result = dynamicsService.assessCompressionNeed(audio, targetDynamicRangeDb);

                const urgencyEmoji =
                    result.compressionUrgency === 'essential'
                        ? '🔴'
                        : result.compressionUrgency === 'recommended'
                          ? '🟡'
                          : result.compressionUrgency === 'optional'
                            ? '🟢'
                            : '⚪';

                const resultText = `## Dynamic Range Analysis ${urgencyEmoji}

**File:** ${fileService.resolveFilePath(filePath)}

**Dynamics Measurements:**
- Dynamic Range: ${result.dynamicRangeDb} dB (target: ${targetDynamicRangeDb} dB)
- Peak-to-Average Ratio: ${result.peakToAverageRatio}
- Crest Factor: ${result.crestFactorDb} dB

**Compression Assessment:**
- Needs Compression: ${result.needsCompression ? 'YES' : 'NO'}
- Urgency: ${result.compressionUrgency.toUpperCase()}

**Suggested Compressor Settings:**
- Ratio: ${result.suggestedSettings.ratio}
- Threshold: ${result.suggestedSettings.thresholdDb} dB
- Attack: ${result.suggestedSettings.attackMs} ms
- Release: ${result.suggestedSettings.releaseMs} ms
- Makeup Gain: ${result.suggestedSettings.makeupGainDb} dB

**Recommendation:** ${result.recommendation}`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register audio_analyze_sibilance tool
 */
function registerAudioAnalyzeSibilanceTool(server: McpServer, fileService: AudioFileService, dynamicsService: AudioDynamicsService): void {
    server.registerTool(
        'audio_analyze_sibilance',
        {
            title: 'Analyze Sibilance',
            description:
                'Detect sibilance (harsh S, T, F sounds) in a recorded WAV file, typically in the 5-8 kHz range. ' +
                'Provides de-esser settings recommendations including frequency, threshold, and range. ' +
                'Essential for vocal recordings.',
            inputSchema: {
                filePath: z.string().describe('Path to the WAV file to analyze (ideally a vocal recording)')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath }): Promise<CallToolResult> => {
            try {
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                const audio = await fileService.readWavFile(filePath);
                const result = dynamicsService.detectSibilance(audio);

                const severityEmoji =
                    result.severity === 'severe' ? '🔴' : result.severity === 'moderate' ? '🟡' : result.severity === 'mild' ? '🟢' : '✅';

                let deEsserText = 'De-esser not required.';
                if (result.deEsserSettings) {
                    deEsserText = `**Suggested De-Esser Settings:**
- Frequency: ${result.deEsserSettings.frequencyHz} Hz
- Threshold: ${result.deEsserSettings.thresholdDb} dB
- Range: ${result.deEsserSettings.rangeDb} dB`;
                }

                const resultText = `## Sibilance Analysis ${severityEmoji}

**File:** ${fileService.resolveFilePath(filePath)}

**Status:** ${result.hasSibilance ? 'SIBILANCE DETECTED' : 'No significant sibilance'}

**Analysis:**
- Severity: ${result.severity.toUpperCase()}
- Sibilant Frames: ${result.sibilantFramePercentage}%
- Peak Frequency: ${result.peakFrequencyHz} Hz
- Average Energy: ${result.averageEnergyDb} dB

${deEsserText}

**Recommendation:** ${result.recommendation}`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register audio_analyze_pumping tool
 */
function registerAudioAnalyzePumpingTool(server: McpServer, fileService: AudioFileService, dynamicsService: AudioDynamicsService): void {
    server.registerTool(
        'audio_analyze_pumping',
        {
            title: 'Analyze Compression Pumping',
            description:
                'Detect compression pumping/breathing artifacts in a recorded WAV file. ' +
                'Identifies rhythmic level fluctuations caused by over-compression. ' +
                'Helps diagnose problematic compression settings.',
            inputSchema: {
                filePath: z.string().describe('Path to the WAV file to analyze')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath }): Promise<CallToolResult> => {
            try {
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                const audio = await fileService.readWavFile(filePath);
                const result = dynamicsService.detectPumping(audio);

                const severityEmoji =
                    result.severity === 'severe' ? '🔴' : result.severity === 'moderate' ? '🟡' : result.severity === 'mild' ? '🟢' : '✅';

                const resultText = `## Compression Pumping Analysis ${severityEmoji}

**File:** ${fileService.resolveFilePath(filePath)}

**Status:** ${result.hasPumping ? 'PUMPING DETECTED' : 'No significant pumping'}

**Analysis:**
- Severity: ${result.severity.toUpperCase()}
- Pumping Rate: ${result.pumpingRateHz} Hz
- Modulation Depth: ${result.modulationDepthDb} dB

**Recommendation:** ${result.recommendation}`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

// ============================================================================
// Stereo/Spatial Analysis Tools
// ============================================================================

/**
 * Register audio_analyze_phase tool
 */
function registerAudioAnalyzePhaseTool(server: McpServer, fileService: AudioFileService, stereoService: AudioStereoAnalysisService): void {
    server.registerTool(
        'audio_analyze_phase',
        {
            title: 'Analyze Phase Correlation',
            description:
                'Analyze phase correlation between stereo channels to detect phase cancellation issues and mono compatibility. ' +
                'Returns correlation coefficient (-1 to +1), mono compatibility rating, and identifies problematic regions. ' +
                'Essential for ensuring mixes translate well to mono systems.',
            inputSchema: {
                filePath: z.string().describe('Path to the stereo WAV file to analyze')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath }): Promise<CallToolResult> => {
            try {
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                const audio = await fileService.readWavFile(filePath);
                const result = stereoService.analyzePhaseCorrelation(audio);

                const compatEmoji =
                    result.monoCompatibility === 'excellent'
                        ? '✅'
                        : result.monoCompatibility === 'good'
                          ? '👍'
                          : result.monoCompatibility === 'fair'
                            ? '⚠️'
                            : '❌';

                let regionsText = 'None detected.';
                if (result.problematicRegions.length > 0) {
                    regionsText = result.problematicRegions
                        .map(r => `- ${r.startMs}-${r.endMs}ms: correlation ${r.correlation}`)
                        .join('\n');
                }

                const resultText = `## Phase Correlation Analysis ${compatEmoji}

**File:** ${fileService.resolveFilePath(filePath)}

**Phase Correlation:**
- Coefficient: ${result.correlationCoefficient} (range: -1 to +1)
- Min: ${result.correlationMin} | Max: ${result.correlationMax}

**Mono Compatibility:** ${result.monoCompatibility.toUpperCase()}
**Phase Issues:** ${result.hasPhaseIssues ? 'YES' : 'NO'}

**Problematic Regions:**
${regionsText}

**Recommendation:** ${result.recommendation}`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register audio_analyze_stereo_field tool
 */
function registerAudioAnalyzeStereoFieldTool(
    server: McpServer,
    fileService: AudioFileService,
    stereoService: AudioStereoAnalysisService
): void {
    server.registerTool(
        'audio_analyze_stereo_field',
        {
            title: 'Analyze Stereo Field',
            description:
                'Comprehensive stereo field analysis including width measurement (M/S analysis), left/right balance, and phase correlation. ' +
                'Provides a complete picture of the stereo image. ' +
                'Essential for stereo mixing and mastering decisions.',
            inputSchema: {
                filePath: z.string().describe('Path to the stereo WAV file to analyze')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath }): Promise<CallToolResult> => {
            try {
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                const audio = await fileService.readWavFile(filePath);
                const result = stereoService.analyzeStereoField(audio);

                const stereoEmoji = result.isStereo ? '🔊' : '🔈';

                const resultText = `## Stereo Field Analysis ${stereoEmoji}

**File:** ${fileService.resolveFilePath(filePath)}

**Format:** ${result.isStereo ? 'STEREO' : 'MONO'}

**Stereo Width:**
- Width: ${result.width.widthPercentage}%
- Character: ${result.width.widthCharacter.toUpperCase()}
- Side/Mid Ratio: ${result.width.sideMidRatio}
- Mid RMS: ${result.width.midRmsDb} dB
- Side RMS: ${result.width.sideRmsDb} dB

**Stereo Balance:**
- Balance: ${result.balance.balancePercentage}% (0 = center)
- Left RMS: ${result.balance.leftRmsDb} dB
- Right RMS: ${result.balance.rightRmsDb} dB
- Difference: ${result.balance.differenceDb} dB
- Direction: ${result.balance.panDirection.toUpperCase()}
- Balanced: ${result.balance.isBalanced ? 'YES' : 'NO'}

**Phase Correlation:**
- Coefficient: ${result.phase.correlationCoefficient}
- Mono Compatibility: ${result.phase.monoCompatibility.toUpperCase()}
- Phase Issues: ${result.phase.hasPhaseIssues ? 'YES' : 'NO'}

**Overall Recommendation:** ${result.recommendation}`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

// ============================================================================
// High-Fidelity Spectrogram Tool
// ============================================================================

/**
 * Register audio_generate_spectrogram tool
 * High-fidelity spectrogram generation with logarithmic frequency scale
 */
function registerAudioGenerateSpectrogramTool(
    server: McpServer,
    fileService: AudioFileService,
    analysisService: AudioAnalysisService,
    visualizationService: AudioVisualizationService
): void {
    server.registerTool(
        'audio_generate_spectrogram',
        {
            title: 'Generate High-Fidelity Spectrogram',
            description:
                'Generate a publication-quality spectrogram image from a WAV file with logarithmic frequency scale, ' +
                'configurable FFT resolution, adjustable dB range, and frequency/time grid overlays. ' +
                'Default output is 1920x1080 (Full HD). Supports FFT sizes: 1024, 2048, 4096, 8192. ' +
                'Higher FFT = better frequency resolution but worse time resolution. ' +
                'Use audio_record first to create a recording.',
            inputSchema: {
                filePath: z.string().describe('Path to the WAV file to analyze. Can be absolute or relative.'),

                // Resolution
                width: z.number().min(400).max(7680).default(1920).describe('Output width in pixels (default: 1920 for Full HD)'),
                height: z.number().min(300).max(4320).default(1080).describe('Output height in pixels (default: 1080 for Full HD)'),

                // FFT configuration
                fftSize: z
                    .enum(['1024', '2048', '4096', '8192'])
                    .default('4096')
                    .describe('FFT size: 1024 (best time res), 2048 (balanced), 4096 (good freq res), 8192 (best freq res)'),
                hopFraction: z
                    .number()
                    .min(0.1)
                    .max(0.5)
                    .default(0.25)
                    .describe('Hop size as fraction of FFT (0.25 = 75% overlap for smooth display)'),

                // Frequency scale
                frequencyScale: z
                    .enum(['linear', 'logarithmic'])
                    .default('logarithmic')
                    .describe('Frequency axis scale: logarithmic (matches human hearing) or linear'),
                minFrequencyHz: z.number().min(1).default(20).describe('Minimum frequency to display in Hz (default: 20Hz)'),
                maxFrequencyHz: z.number().optional().describe('Maximum frequency to display in Hz (default: Nyquist frequency)'),

                // dB range
                minDb: z
                    .number()
                    .min(-120)
                    .max(0)
                    .default(-90)
                    .describe('Minimum dB value for dynamic range (default: -90dB, lower shows more detail)'),
                maxDb: z.number().min(-60).max(20).default(0).describe('Maximum dB value for dynamic range (default: 0dB)'),

                // Visual options
                colormap: z
                    .enum(['viridis', 'plasma', 'magma', 'inferno', 'grayscale'])
                    .default('viridis')
                    .describe('Color scheme for spectrogram'),
                showFrequencyGrid: z.boolean().default(true).describe('Show horizontal frequency grid lines'),
                showTimeGrid: z.boolean().default(true).describe('Show vertical time grid lines'),
                showColorbar: z.boolean().default(true).describe('Show dB colorbar legend'),
                showLabels: z.boolean().default(true).describe('Show axis labels and title'),
                title: z.string().optional().describe('Custom title (default: "Spectrogram")'),

                // Output
                outputPath: z.string().optional().describe('Output path for the PNG image file')
            },
            annotations: {
                readOnlyHint: false, // Creates a file
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({
            filePath,
            width = 1920,
            height = 1080,
            fftSize = '4096',
            hopFraction = 0.25,
            frequencyScale = 'logarithmic',
            minFrequencyHz = 20,
            maxFrequencyHz,
            minDb = -90,
            maxDb = 0,
            colormap = 'viridis',
            showFrequencyGrid = true,
            showTimeGrid = true,
            showColorbar = true,
            showLabels = true,
            title,
            outputPath
        }): Promise<CallToolResult> => {
            try {
                // Validate file
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                // Read audio
                const audio = await fileService.readWavFile(filePath);

                // Parse FFT size
                const fftSizeNum = parseInt(fftSize, 10) as 1024 | 2048 | 4096 | 8192;

                // Compute spectrogram with configured FFT
                const spectrogram = analysisService.computeSpectrogramWithConfig(audio, fftSizeNum, hopFraction);

                // Determine actual max frequency
                const actualMaxFrequency = maxFrequencyHz ?? audio.sampleRate / 2;

                // Render high-fidelity spectrogram
                const result = await visualizationService.renderHiFiSpectrogram(spectrogram, {
                    width,
                    height,
                    colormap,
                    frequencyScale,
                    fftSize: fftSizeNum,
                    hopFraction,
                    minDb,
                    maxDb,
                    showFrequencyLabels: showLabels,
                    showTimeLabels: showLabels,
                    showFrequencyGrid,
                    showTimeGrid,
                    showColorbar,
                    showTitle: showLabels,
                    title: title ?? `Spectrogram - ${path.basename(fileService.resolveFilePath(filePath))}`,
                    minFrequencyHz,
                    maxFrequencyHz: actualMaxFrequency,
                    outputPath
                });

                // Calculate resolution info
                const freqResolution = (audio.sampleRate / fftSizeNum).toFixed(2);
                const timeResolution = ((result.hopSize / audio.sampleRate) * 1000).toFixed(2);
                const overlapPercent = ((1 - hopFraction) * 100).toFixed(0);

                // Format result
                const resultText = `## High-Fidelity Spectrogram Generated

**Input File:** ${fileService.resolveFilePath(filePath)}

**Output Image:** ${result.imagePath}

**Analysis Parameters:**
- FFT Size: ${result.fftSize} samples
- Hop Size: ${result.hopSize} samples (${overlapPercent}% overlap)
- Time Frames: ${result.numFrames}
- Frequency Bins: ${result.numBins}

**Display Settings:**
- Resolution: ${result.width} x ${result.height} pixels
- Frequency Scale: ${frequencyScale}
- Frequency Range: ${result.frequencyRange.min} Hz - ${(result.frequencyRange.max / 1000).toFixed(1)} kHz
- Dynamic Range: ${result.dbRange.min} dB to ${result.dbRange.max} dB
- Colormap: ${colormap}

**Audio Info:**
- Duration: ${result.durationSeconds.toFixed(2)} seconds
- Sample Rate: ${result.sampleRate} Hz

**Resolution:**
- Frequency: ${freqResolution} Hz per bin
- Time: ${timeResolution} ms per frame`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

// ============================================================================
// Comprehensive Mix Diagnostic Tool
// ============================================================================

/**
 * Register audio_analyze_mix tool
 * Complete mixing workflow analysis
 */
function registerAudioAnalyzeMixTool(
    server: McpServer,
    fileService: AudioFileService,
    analysisService: AudioAnalysisService,
    problemService: AudioProblemDetectionService,
    dynamicsService: AudioDynamicsService,
    stereoService: AudioStereoAnalysisService
): void {
    server.registerTool(
        'audio_analyze_mix',
        {
            title: 'Complete Mix Analysis',
            description:
                'Run comprehensive audio analysis for the complete mixing workflow. ' +
                'Provides structured recommendations for: gain staging, subtractive EQ (problem frequencies), ' +
                'dynamics (compression, de-essing), additive EQ (character frequencies), and spatial processing (stereo, reverb). ' +
                'This is the "master" diagnostic tool that provides a complete mixing starting point.',
            inputSchema: {
                filePath: z.string().describe('Path to the WAV file to analyze'),
                sourceType: z
                    .enum(['vocal', 'instrument', 'drums', 'bass', 'full-mix', 'unknown'])
                    .default('unknown')
                    .describe('Type of audio source - helps tailor recommendations'),
                targetLoudnessDb: z.number().default(-14).describe('Target integrated loudness for final mix (LUFS/dB)')
            },
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true
            }
        },
        async ({ filePath, sourceType = 'unknown', targetLoudnessDb: _targetLoudnessDb = -14 }): Promise<CallToolResult> => {
            try {
                const validation = await fileService.validateWavFile(filePath);
                if (!validation.valid) {
                    return {
                        content: [{ type: 'text', text: AudioError.invalidWavFormat(validation.error || 'Unknown error') }],
                        isError: true
                    };
                }

                const audio = await fileService.readWavFile(filePath);

                // Run all analyses
                const loudness = analysisService.measureLoudness(audio);
                const eqProblems = problemService.detectAllProblems(audio);
                const clipping = problemService.detectClipping(audio);
                const noiseFloor = problemService.analyzeNoiseFloor(audio);
                const dynamics = dynamicsService.assessCompressionNeed(audio);
                const transients = dynamicsService.detectTransients(audio);
                const sibilance = dynamicsService.detectSibilance(audio);
                const stereoField = stereoService.analyzeStereoField(audio);

                // Build gain staging assessment
                let gainStatus: string;
                const gainRecommendations: string[] = [];
                if (clipping.hasClipping) {
                    gainStatus = 'CLIPPING';
                    gainRecommendations.push(`Reduce input gain by ${Math.ceil(clipping.peakDb)}dB to eliminate clipping`);
                } else if (loudness.rmsDb > -6) {
                    gainStatus = 'TOO HOT';
                    gainRecommendations.push('Reduce gain by 3-6dB to create headroom');
                } else if (loudness.rmsDb < -20) {
                    gainStatus = 'TOO QUIET';
                    gainRecommendations.push('Increase gain to improve signal-to-noise ratio');
                } else {
                    gainStatus = 'OPTIMAL';
                    gainRecommendations.push('Gain staging is good');
                }
                if (noiseFloor.suggestGate) {
                    gainRecommendations.push(`Apply noise gate at ${noiseFloor.gateThresholdDb}dB`);
                }

                // Build subtractive EQ section
                const detectedProblems = eqProblems.problems.filter(p => p.detected);
                const subEqRecommendations: string[] = [];

                // Check for HPF need (rumble detection)
                const rumbleProb = eqProblems.problems.find(p => p.type === 'rumble');
                if (rumbleProb?.detected) {
                    subEqRecommendations.push(`Apply HPF at 80-100Hz (${rumbleProb.severity} rumble detected)`);
                } else if (sourceType === 'vocal') {
                    subEqRecommendations.push('Apply HPF at 80-100Hz for vocals');
                }

                // Add problem frequency recommendations
                detectedProblems.forEach(p => {
                    if (p.type !== 'thin' && p.type !== 'rumble') {
                        const centerFreq = Math.round((p.frequencyRange.min + p.frequencyRange.max) / 2);
                        subEqRecommendations.push(`Cut ${p.severity === 'severe' ? '4-6' : '2-4'}dB at ${centerFreq}Hz (${p.type})`);
                    }
                });

                // Build dynamics section
                const dynamicsRecommendations: string[] = [];
                if (dynamics.needsCompression) {
                    dynamicsRecommendations.push(
                        `Apply ${dynamics.suggestedSettings.ratio} compression at ${dynamics.suggestedSettings.thresholdDb}dB`
                    );
                    dynamicsRecommendations.push(
                        `Use ${dynamics.suggestedSettings.attackMs}ms attack, ${dynamics.suggestedSettings.releaseMs}ms release`
                    );
                }
                if (sibilance.hasSibilance && (sourceType === 'vocal' || sourceType === 'unknown')) {
                    dynamicsRecommendations.push(`Apply de-esser at ${sibilance.peakFrequencyHz}Hz (${sibilance.severity} sibilance)`);
                }
                if (transients.attackCharacter === 'sharp') {
                    dynamicsRecommendations.push('Consider fast compressor attack (1-5ms) or parallel compression for transient control');
                }

                // Build additive EQ section
                const addEqRecommendations: string[] = [];
                const thinProb = eqProblems.problems.find(p => p.type === 'thin');
                if (thinProb?.detected) {
                    addEqRecommendations.push('Boost 100-200Hz by 2-4dB to add body');
                }
                if (sourceType === 'vocal') {
                    addEqRecommendations.push('Consider air boost above 10kHz for presence');
                    addEqRecommendations.push('Presence boost at 3-5kHz can help vocals cut through');
                }
                if (sourceType === 'drums') {
                    addEqRecommendations.push('Boost 60-100Hz for kick punch');
                    addEqRecommendations.push('Boost 3-5kHz for snare crack');
                }

                // Build spatial section
                const spatialRecommendations: string[] = [];
                if (stereoField.phase.hasPhaseIssues) {
                    spatialRecommendations.push('Check stereo processing - phase issues detected');
                }
                if (!stereoField.balance.isBalanced) {
                    spatialRecommendations.push(
                        `Adjust balance - currently ${stereoField.balance.differenceDb}dB toward ${stereoField.balance.panDirection}`
                    );
                }
                if (stereoField.width.widthCharacter === 'mono' || stereoField.width.widthCharacter === 'narrow') {
                    spatialRecommendations.push('Consider stereo widening, reverb, or delay for more width');
                }
                if (stereoField.width.widthCharacter === 'very-wide') {
                    spatialRecommendations.push('Consider narrowing stereo width for better mono compatibility');
                }

                // Calculate quality score
                let qualityScore = 100;
                if (clipping.hasClipping) qualityScore -= 20;
                if (loudness.rmsDb > -6 || loudness.rmsDb < -20) qualityScore -= 10;
                qualityScore -= detectedProblems.length * 5;
                if (stereoField.phase.hasPhaseIssues) qualityScore -= 10;
                if (!stereoField.balance.isBalanced) qualityScore -= 5;
                qualityScore = Math.max(0, qualityScore);

                let overallAssessment: string;
                if (qualityScore >= 80) {
                    overallAssessment = 'READY FOR MIX';
                } else if (qualityScore >= 50) {
                    overallAssessment = 'NEEDS WORK';
                } else {
                    overallAssessment = 'SIGNIFICANT ISSUES';
                }

                // Build prioritized recommendations
                const prioritizedRecommendations: string[] = [];
                if (clipping.hasClipping) prioritizedRecommendations.push('1. Fix clipping first');
                if (detectedProblems.some(p => p.severity === 'severe')) {
                    prioritizedRecommendations.push('2. Address severe EQ problems');
                }
                if (dynamics.compressionUrgency === 'essential') {
                    prioritizedRecommendations.push('3. Apply compression for dynamics control');
                }
                if (stereoField.phase.hasPhaseIssues) {
                    prioritizedRecommendations.push('4. Fix phase issues');
                }

                const assessmentEmoji = overallAssessment === 'READY FOR MIX' ? '✅' : overallAssessment === 'NEEDS WORK' ? '⚠️' : '❌';

                const resultText = `## Complete Mix Analysis ${assessmentEmoji}

**File:** ${fileService.resolveFilePath(filePath)}
**Source Type:** ${sourceType.toUpperCase()}
**Quality Score:** ${qualityScore}/100
**Assessment:** ${overallAssessment}

---

### 1. GAIN STAGING
**Status:** ${gainStatus}
- Peak: ${loudness.peakDb} dB
- RMS: ${loudness.rmsDb} dB
- Headroom: ${(-loudness.peakDb).toFixed(1)} dB
- Noise Floor: ${noiseFloor.noiseFloorDb} dB
- SNR: ${noiseFloor.signalToNoiseDb} dB

**Actions:**
${gainRecommendations.map(r => `- ${r}`).join('\n')}

---

### 2. SUBTRACTIVE EQ (Problem Frequencies)
**Detected Issues:** ${detectedProblems.length}
**Overall Quality:** ${eqProblems.overallQuality.toUpperCase()}

${detectedProblems.length > 0 ? detectedProblems.map(p => `- **${p.type.toUpperCase()}** (${p.frequencyRange.min}-${p.frequencyRange.max}Hz): ${p.severity}`).join('\n') : '- No significant EQ problems detected'}

**Actions:**
${subEqRecommendations.length > 0 ? subEqRecommendations.map(r => `- ${r}`).join('\n') : '- No subtractive EQ needed'}

---

### 3. DYNAMICS
**Dynamic Range:** ${dynamics.dynamicRangeDb} dB
**Compression Needed:** ${dynamics.needsCompression ? 'YES' : 'NO'} (${dynamics.compressionUrgency})
**Transient Character:** ${transients.attackCharacter.toUpperCase()}
**Sibilance:** ${sibilance.hasSibilance ? `${sibilance.severity.toUpperCase()} at ${sibilance.peakFrequencyHz}Hz` : 'None detected'}

**Actions:**
${dynamicsRecommendations.length > 0 ? dynamicsRecommendations.map(r => `- ${r}`).join('\n') : '- No dynamics processing needed'}

---

### 4. ADDITIVE EQ (Character)
**Actions:**
${addEqRecommendations.length > 0 ? addEqRecommendations.map(r => `- ${r}`).join('\n') : '- Consider EQ boosts for character after other processing'}

---

### 5. SPATIAL / STEREO
**Format:** ${stereoField.isStereo ? 'STEREO' : 'MONO'}
**Width:** ${stereoField.width.widthCharacter.toUpperCase()} (${stereoField.width.widthPercentage}%)
**Balance:** ${stereoField.balance.isBalanced ? 'BALANCED' : `${stereoField.balance.panDirection.toUpperCase()} by ${Math.abs(stereoField.balance.differenceDb)}dB`}
**Phase:** ${stereoField.phase.monoCompatibility.toUpperCase()} mono compatibility

**Actions:**
${spatialRecommendations.length > 0 ? spatialRecommendations.map(r => `- ${r}`).join('\n') : '- Stereo field is healthy'}

---

### PRIORITY ACTIONS
${prioritizedRecommendations.length > 0 ? prioritizedRecommendations.join('\n') : 'Audio is ready for mixing!'}`;

                return {
                    content: [{ type: 'text', text: resultText }]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: AudioError.analysisFailed(error instanceof Error ? error.message : String(error))
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register all audio domain tools
 */
export function registerAudioTools(
    server: McpServer,
    captureService?: AudioCaptureService,
    analysisService?: AudioAnalysisService,
    visualizationService?: AudioVisualizationService,
    fileService?: AudioFileService,
    problemService?: AudioProblemDetectionService,
    dynamicsService?: AudioDynamicsService,
    stereoService?: AudioStereoAnalysisService
): void {
    // Create default service instances if not provided
    const capture = captureService ?? new AudioCaptureService();
    const analysis = analysisService ?? new AudioAnalysisService();
    const visualization = visualizationService ?? new AudioVisualizationService();
    const file = fileService ?? new AudioFileService();
    const problem = problemService ?? new AudioProblemDetectionService();
    const dynamics = dynamicsService ?? new AudioDynamicsService();
    const stereo = stereoService ?? new AudioStereoAnalysisService();

    // Device listing (unchanged)
    registerAudioListDevicesTool(server, capture);

    // Recording tool
    registerAudioRecordTool(server, capture, file);

    // Analysis tools (file-based) - Original
    registerAudioAnalyzeSpectrumTool(server, file, analysis, visualization);
    registerAudioGetFrequencyBalanceTool(server, file, analysis, visualization);
    registerAudioGetLoudnessTool(server, file, analysis);
    registerAudioAnalyzeBrightnessTool(server, file, analysis);
    registerAudioAnalyzeHarshnessTool(server, file, analysis);
    registerAudioDetectMaskingTool(server, file, analysis);

    // Problem detection tools
    registerAudioAnalyzeEqProblemsTool(server, file, problem);
    registerAudioAnalyzeClippingTool(server, file, problem);
    registerAudioAnalyzeNoiseFloorTool(server, file, problem);

    // Dynamics analysis tools
    registerAudioAnalyzeTransientsTool(server, file, dynamics);
    registerAudioAnalyzeDynamicsTool(server, file, dynamics);
    registerAudioAnalyzeSibilanceTool(server, file, dynamics);
    registerAudioAnalyzePumpingTool(server, file, dynamics);

    // Stereo/spatial analysis tools
    registerAudioAnalyzePhaseTool(server, file, stereo);
    registerAudioAnalyzeStereoFieldTool(server, file, stereo);

    // High-fidelity visualization tools
    registerAudioGenerateSpectrogramTool(server, file, analysis, visualization);

    // Comprehensive mix analysis tool
    registerAudioAnalyzeMixTool(server, file, analysis, problem, dynamics, stereo);
}
