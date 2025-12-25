/**
 * Generate synthetic test audio files for audio analysis tests
 */

import * as fs from 'fs';
import * as path from 'path';

const SAMPLE_RATE = 44100;
const DURATION_SEC = 2;
const NUM_SAMPLES = SAMPLE_RATE * DURATION_SEC;

/**
 * Generate a sine wave
 */
function generateSineWave(frequency: number, amplitude: number, numSamples: number, sampleRate: number): Float32Array {
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        samples[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    }
    return samples;
}

/**
 * Generate white noise
 */
function generateNoise(amplitude: number, numSamples: number): Float32Array {
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        samples[i] = amplitude * (Math.random() * 2 - 1);
    }
    return samples;
}

/**
 * Mix multiple audio signals
 */
function mixSignals(...signals: Float32Array[]): Float32Array {
    const length = signals[0].length;
    const result = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        for (const signal of signals) {
            result[i] += signal[i];
        }
    }
    return result;
}

/**
 * Create stereo from mono by applying slight delay to right channel
 */
function createStereo(mono: Float32Array, delayMs: number, sampleRate: number): Float32Array {
    const delaySamples = Math.floor((delayMs / 1000) * sampleRate);
    const stereo = new Float32Array(mono.length * 2);

    for (let i = 0; i < mono.length; i++) {
        // Left channel
        stereo[i * 2] = mono[i];
        // Right channel with delay
        const rightIdx = i - delaySamples;
        stereo[i * 2 + 1] = rightIdx >= 0 ? mono[rightIdx] : 0;
    }

    return stereo;
}

/**
 * Write WAV file header
 */
function writeWavHeader(buffer: Buffer, numChannels: number, sampleRate: number, bitsPerSample: number, dataSize: number): void {
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);

    // fmt chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // chunk size
    buffer.writeUInt16LE(1, 20); // audio format (PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);

    // data chunk header
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
}

/**
 * Convert Float32Array samples to 16-bit PCM buffer
 */
function samplesToBuffer(samples: Float32Array): Buffer {
    const buffer = Buffer.alloc(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        const intSample = Math.round(sample * 32767);
        buffer.writeInt16LE(intSample, i * 2);
    }
    return buffer;
}

/**
 * Write samples to WAV file
 */
function writeWavFile(filePath: string, samples: Float32Array, numChannels: number, sampleRate: number): void {
    const dataBuffer = samplesToBuffer(samples);
    const headerBuffer = Buffer.alloc(44);
    writeWavHeader(headerBuffer, numChannels, sampleRate, 16, dataBuffer.length);

    const fullBuffer = Buffer.concat([headerBuffer, dataBuffer]);
    fs.writeFileSync(filePath, fullBuffer);
}

// Generate test files
const fixturesDir = path.dirname(new URL(import.meta.url).pathname);

// 1. Simple mono sine wave (440 Hz - A4)
console.log('Generating mono sine wave...');
const monoSine = generateSineWave(440, 0.5, NUM_SAMPLES, SAMPLE_RATE);
writeWavFile(path.join(fixturesDir, 'mono-sine-440hz.wav'), monoSine, 1, SAMPLE_RATE);

// 2. Stereo with multiple frequencies (simulating a simple mix)
console.log('Generating stereo mix...');
const bass = generateSineWave(100, 0.3, NUM_SAMPLES, SAMPLE_RATE);
const mid = generateSineWave(1000, 0.2, NUM_SAMPLES, SAMPLE_RATE);
const high = generateSineWave(4000, 0.15, NUM_SAMPLES, SAMPLE_RATE);
const mixMono = mixSignals(bass, mid, high);
const stereoMix = createStereo(mixMono, 0.5, SAMPLE_RATE);
writeWavFile(path.join(fixturesDir, 'stereo-mix.wav'), stereoMix, 2, SAMPLE_RATE);

// 3. Noisy signal (for noise floor testing)
console.log('Generating noisy signal...');
const signal = generateSineWave(440, 0.4, NUM_SAMPLES, SAMPLE_RATE);
const noise = generateNoise(0.02, NUM_SAMPLES);
const noisySignal = mixSignals(signal, noise);
writeWavFile(path.join(fixturesDir, 'noisy-signal.wav'), noisySignal, 1, SAMPLE_RATE);

// 4. Clipped signal (for clipping detection)
console.log('Generating clipped signal...');
const hotSignal = generateSineWave(440, 1.5, NUM_SAMPLES, SAMPLE_RATE);
// Clip to simulate hard clipping
for (let i = 0; i < hotSignal.length; i++) {
    hotSignal[i] = Math.max(-1, Math.min(1, hotSignal[i]));
}
writeWavFile(path.join(fixturesDir, 'clipped-signal.wav'), hotSignal, 1, SAMPLE_RATE);

// 5. Transient-heavy signal (impulses for transient detection)
console.log('Generating transient signal...');
const transientSignal = new Float32Array(NUM_SAMPLES);
const impulseInterval = Math.floor(SAMPLE_RATE * 0.25); // Every 250ms
for (let i = 0; i < NUM_SAMPLES; i++) {
    if (i % impulseInterval < 100) {
        // Short burst
        transientSignal[i] = 0.8 * Math.sin((2 * Math.PI * 200 * (i % impulseInterval)) / SAMPLE_RATE);
        // Apply quick decay
        transientSignal[i] *= 1 - (i % impulseInterval) / 100;
    }
}
writeWavFile(path.join(fixturesDir, 'transient-signal.wav'), transientSignal, 1, SAMPLE_RATE);

// 6. Muddy signal (excess low-mid frequencies 200-400Hz)
console.log('Generating muddy signal...');
const mud1 = generateSineWave(250, 0.5, NUM_SAMPLES, SAMPLE_RATE);
const mud2 = generateSineWave(350, 0.4, NUM_SAMPLES, SAMPLE_RATE);
const mudHigh = generateSineWave(2000, 0.1, NUM_SAMPLES, SAMPLE_RATE);
const muddySignal = mixSignals(mud1, mud2, mudHigh);
writeWavFile(path.join(fixturesDir, 'muddy-signal.wav'), muddySignal, 1, SAMPLE_RATE);

// 7. Harsh signal (excess 2.5-4kHz)
console.log('Generating harsh signal...');
const harshBase = generateSineWave(200, 0.2, NUM_SAMPLES, SAMPLE_RATE);
const harsh1 = generateSineWave(3000, 0.5, NUM_SAMPLES, SAMPLE_RATE);
const harsh2 = generateSineWave(3500, 0.4, NUM_SAMPLES, SAMPLE_RATE);
const harshSignal = mixSignals(harshBase, harsh1, harsh2);
writeWavFile(path.join(fixturesDir, 'harsh-signal.wav'), harshSignal, 1, SAMPLE_RATE);

console.log('All test audio files generated!');
