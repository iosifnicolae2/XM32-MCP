/**
 * Low-level DSP utilities for audio analysis
 */

/**
 * Calculate the RMS (Root Mean Square) of a signal
 * @param samples Audio samples
 * @returns RMS value
 */
export function calculateRms(samples: Float32Array): number {
    if (samples.length === 0) return 0;

    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
        sum += samples[i] * samples[i];
    }

    return Math.sqrt(sum / samples.length);
}

/**
 * Calculate the peak absolute value of a signal
 * @param samples Audio samples
 * @returns Peak value
 */
export function calculatePeak(samples: Float32Array): number {
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
        const abs = Math.abs(samples[i]);
        if (abs > peak) peak = abs;
    }
    return peak;
}

/**
 * Convert linear amplitude to decibels
 * @param linear Linear amplitude value
 * @param reference Reference value (default 1.0 for full scale)
 * @returns Value in dB
 */
export function linearToDb(linear: number, reference: number = 1.0): number {
    if (linear <= 0) return -Infinity;
    return 20 * Math.log10(linear / reference);
}

/**
 * Convert decibels to linear amplitude
 * @param db Value in decibels
 * @param reference Reference value (default 1.0 for full scale)
 * @returns Linear amplitude
 */
export function dbToLinear(db: number, reference: number = 1.0): number {
    return reference * Math.pow(10, db / 20);
}

/**
 * Split interleaved stereo samples into left and right channels
 * @param samples Interleaved stereo samples
 * @param channels Number of channels (must be 2 for stereo)
 * @returns Object with left and right Float32Arrays
 */
export function splitStereoChannels(samples: Float32Array, channels: number): { left: Float32Array; right: Float32Array } {
    if (channels !== 2) {
        // Mono - return same data for both
        return { left: samples, right: samples };
    }

    const frameCount = Math.floor(samples.length / 2);
    const left = new Float32Array(frameCount);
    const right = new Float32Array(frameCount);

    for (let i = 0; i < frameCount; i++) {
        left[i] = samples[i * 2];
        right[i] = samples[i * 2 + 1];
    }

    return { left, right };
}

/**
 * Calculate the envelope of a signal using attack/release times
 * @param samples Audio samples
 * @param attackMs Attack time in milliseconds
 * @param releaseMs Release time in milliseconds
 * @param sampleRate Sample rate in Hz
 * @returns Envelope as Float32Array
 */
export function calculateEnvelope(samples: Float32Array, attackMs: number, releaseMs: number, sampleRate: number): Float32Array {
    const envelope = new Float32Array(samples.length);

    // Convert ms to coefficient
    const attackCoef = Math.exp(-1.0 / ((sampleRate * attackMs) / 1000));
    const releaseCoef = Math.exp(-1.0 / ((sampleRate * releaseMs) / 1000));

    let currentEnv = 0;

    for (let i = 0; i < samples.length; i++) {
        const inputAbs = Math.abs(samples[i]);

        if (inputAbs > currentEnv) {
            // Attack phase
            currentEnv = attackCoef * currentEnv + (1 - attackCoef) * inputAbs;
        } else {
            // Release phase
            currentEnv = releaseCoef * currentEnv + (1 - releaseCoef) * inputAbs;
        }

        envelope[i] = currentEnv;
    }

    return envelope;
}

/**
 * Calculate the phase correlation between left and right channels
 * Returns Pearson correlation coefficient: +1 (mono), 0 (uncorrelated), -1 (out of phase)
 * @param left Left channel samples
 * @param right Right channel samples
 * @returns Correlation coefficient (-1 to +1)
 */
export function calculatePhaseCorrelation(left: Float32Array, right: Float32Array): number {
    const length = Math.min(left.length, right.length);
    if (length === 0) return 0;

    let sumLR = 0;
    let sumL2 = 0;
    let sumR2 = 0;

    for (let i = 0; i < length; i++) {
        sumLR += left[i] * right[i];
        sumL2 += left[i] * left[i];
        sumR2 += right[i] * right[i];
    }

    const denominator = Math.sqrt(sumL2 * sumR2);
    if (denominator === 0) return 0;

    return sumLR / denominator;
}

/**
 * Find peaks in a signal above a threshold
 * @param data Signal data
 * @param threshold Minimum value for a peak
 * @param minDistance Minimum samples between peaks
 * @returns Array of peak indices
 */
export function findPeaks(data: Float32Array, threshold: number, minDistance: number): number[] {
    const peaks: number[] = [];
    let lastPeakIndex = -minDistance;

    for (let i = 1; i < data.length - 1; i++) {
        // Check if this is a local maximum above threshold
        if (data[i] > threshold && data[i] > data[i - 1] && data[i] >= data[i + 1] && i - lastPeakIndex >= minDistance) {
            peaks.push(i);
            lastPeakIndex = i;
        }
    }

    return peaks;
}

/**
 * Calculate Mid and Side signals from stereo
 * @param left Left channel
 * @param right Right channel
 * @returns Object with mid and side Float32Arrays
 */
export function calculateMidSide(left: Float32Array, right: Float32Array): { mid: Float32Array; side: Float32Array } {
    const length = Math.min(left.length, right.length);
    const mid = new Float32Array(length);
    const side = new Float32Array(length);

    for (let i = 0; i < length; i++) {
        mid[i] = (left[i] + right[i]) / 2;
        side[i] = (left[i] - right[i]) / 2;
    }

    return { mid, side };
}

/**
 * Convert frequency in Hz to FFT bin index
 * @param hz Frequency in Hz
 * @param fftSize FFT size
 * @param sampleRate Sample rate in Hz
 * @returns Bin index
 */
export function hzToBin(hz: number, fftSize: number, sampleRate: number): number {
    return Math.round((hz * fftSize) / sampleRate);
}

/**
 * Convert FFT bin index to frequency in Hz
 * @param bin Bin index
 * @param fftSize FFT size
 * @param sampleRate Sample rate in Hz
 * @returns Frequency in Hz
 */
export function binToHz(bin: number, fftSize: number, sampleRate: number): number {
    return (bin * sampleRate) / fftSize;
}

/**
 * Calculate the derivative (rate of change) of a signal
 * @param data Input signal
 * @returns Derivative signal (one sample shorter)
 */
export function calculateDerivative(data: Float32Array): Float32Array {
    if (data.length < 2) return new Float32Array(0);

    const derivative = new Float32Array(data.length - 1);
    for (let i = 1; i < data.length; i++) {
        derivative[i - 1] = data[i] - data[i - 1];
    }

    return derivative;
}

/**
 * Calculate energy in a specific frequency range from spectrum
 * @param spectrum Magnitude spectrum
 * @param minHz Minimum frequency
 * @param maxHz Maximum frequency
 * @param fftSize FFT size
 * @param sampleRate Sample rate
 * @returns Energy value
 */
export function calculateFrequencyRangeEnergy(
    spectrum: Float32Array | number[],
    minHz: number,
    maxHz: number,
    fftSize: number,
    sampleRate: number
): number {
    const startBin = hzToBin(minHz, fftSize, sampleRate);
    const endBin = hzToBin(maxHz, fftSize, sampleRate);
    const maxBin = Math.min(spectrum.length, fftSize / 2);

    let energy = 0;
    for (let i = Math.max(0, startBin); i < Math.min(maxBin, endBin); i++) {
        energy += spectrum[i] * spectrum[i];
    }

    return energy;
}

/**
 * Normalize a spectrum to sum to 1.0 (for percentage calculations)
 * @param spectrum Input spectrum
 * @returns Normalized spectrum
 */
export function normalizeSpectrum(spectrum: Float32Array | number[]): Float32Array {
    const result = new Float32Array(spectrum.length);
    let total = 0;

    for (let i = 0; i < spectrum.length; i++) {
        total += spectrum[i];
    }

    if (total === 0) return result;

    for (let i = 0; i < spectrum.length; i++) {
        result[i] = spectrum[i] / total;
    }

    return result;
}

/**
 * Calculate the average of an array
 * @param values Array of numbers
 * @returns Average value
 */
export function calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Find the maximum value in an array
 * @param values Array of numbers
 * @returns Maximum value
 */
export function findMax(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.max(...values);
}

/**
 * Calculate total energy of a spectrum
 * @param spectrum Magnitude spectrum
 * @returns Total energy
 */
export function calculateTotalEnergy(spectrum: Float32Array | number[]): number {
    let energy = 0;
    for (let i = 0; i < spectrum.length; i++) {
        energy += spectrum[i] * spectrum[i];
    }
    return energy;
}
