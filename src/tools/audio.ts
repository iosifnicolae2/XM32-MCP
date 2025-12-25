import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AudioCaptureService } from '../services/audio-capture.js';
import { AudioAnalysisService } from '../services/audio-analysis.js';
import { AudioVisualizationService } from '../services/audio-visualization.js';
import { AudioFileService } from '../services/audio-file.js';
import type { AnalysisImages, AUDIO_DEFAULTS } from '../types/audio.js';

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
                        deviceId: deviceId !== undefined ? Number(deviceId) : undefined,
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

/**
 * Register all audio domain tools
 */
export function registerAudioTools(
    server: McpServer,
    captureService?: AudioCaptureService,
    analysisService?: AudioAnalysisService,
    visualizationService?: AudioVisualizationService,
    fileService?: AudioFileService
): void {
    // Create default service instances if not provided
    const capture = captureService ?? new AudioCaptureService();
    const analysis = analysisService ?? new AudioAnalysisService();
    const visualization = visualizationService ?? new AudioVisualizationService();
    const file = fileService ?? new AudioFileService();

    // Device listing (unchanged)
    registerAudioListDevicesTool(server, capture);

    // Recording tool (NEW)
    registerAudioRecordTool(server, capture, file);

    // Analysis tools (file-based)
    registerAudioAnalyzeSpectrumTool(server, file, analysis, visualization);
    registerAudioGetFrequencyBalanceTool(server, file, analysis, visualization);
    registerAudioGetLoudnessTool(server, file, analysis);
    registerAudioAnalyzeBrightnessTool(server, file, analysis);
    registerAudioAnalyzeHarshnessTool(server, file, analysis);
    registerAudioDetectMaskingTool(server, file, analysis);
}
