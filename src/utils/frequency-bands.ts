import type { FrequencyBand, FrequencyBandEnergy } from '../types/audio.js';

/**
 * Standard audio frequency bands for mixing analysis
 * Based on common EQ and mixing terminology
 */
export const STANDARD_FREQUENCY_BANDS: FrequencyBand[] = [
    {
        name: 'Sub-Bass',
        minHz: 20,
        maxHz: 60,
        description: 'Deep bass, felt more than heard. Kick drum sub, bass synth fundamentals.'
    },
    {
        name: 'Bass',
        minHz: 60,
        maxHz: 250,
        description: 'Bass guitar, kick drum body, low vocals, warmth.'
    },
    {
        name: 'Low-Mid',
        minHz: 250,
        maxHz: 500,
        description: 'Muddiness zone. Low end of vocals, snare body.'
    },
    {
        name: 'Mid',
        minHz: 500,
        maxHz: 2000,
        description: 'Vocal presence, guitar body, most instrument fundamentals.'
    },
    {
        name: 'High-Mid',
        minHz: 2000,
        maxHz: 4000,
        description: 'Presence, clarity, attack. Can be harsh if overemphasized.'
    },
    {
        name: 'Presence',
        minHz: 4000,
        maxHz: 6000,
        description: 'Definition, consonants, pick attack.'
    },
    {
        name: 'Brilliance',
        minHz: 6000,
        maxHz: 20000,
        description: 'Air, sparkle, cymbal shimmer, sibilance.'
    }
];

/**
 * Simplified 3-band analysis (Bass, Mid, Treble)
 */
export const SIMPLE_FREQUENCY_BANDS: FrequencyBand[] = [
    {
        name: 'Bass',
        minHz: 20,
        maxHz: 250,
        description: 'Low frequencies'
    },
    {
        name: 'Mid',
        minHz: 250,
        maxHz: 4000,
        description: 'Middle frequencies'
    },
    {
        name: 'Treble',
        minHz: 4000,
        maxHz: 20000,
        description: 'High frequencies'
    }
];

/**
 * Critical listening bands for problem detection
 */
export const PROBLEM_FREQUENCY_BANDS: FrequencyBand[] = [
    {
        name: 'Rumble',
        minHz: 20,
        maxHz: 80,
        description: 'Unwanted low-frequency rumble and noise'
    },
    {
        name: 'Mud',
        minHz: 200,
        maxHz: 400,
        description: 'Muddy frequencies that can obscure clarity'
    },
    {
        name: 'Boxiness',
        minHz: 400,
        maxHz: 800,
        description: 'Boxy, cardboard-like frequencies'
    },
    {
        name: 'Nasal',
        minHz: 800,
        maxHz: 1500,
        description: 'Nasal, honky frequencies'
    },
    {
        name: 'Harsh',
        minHz: 2500,
        maxHz: 4000,
        description: 'Harsh, fatiguing frequencies'
    },
    {
        name: 'Sibilance',
        minHz: 5000,
        maxHz: 8000,
        description: 'Sibilant S and T sounds'
    }
];

/**
 * Get frequency bin indices for a given frequency band
 * @param band Frequency band definition
 * @param fftSize FFT size used
 * @param sampleRate Sample rate of the audio
 * @returns Object with start and end bin indices
 */
export function getBandBinIndices(band: FrequencyBand, fftSize: number, sampleRate: number): { startBin: number; endBin: number } {
    const binWidth = sampleRate / fftSize;
    const startBin = Math.floor(band.minHz / binWidth);
    const endBin = Math.ceil(band.maxHz / binWidth);
    const maxBin = fftSize / 2;

    return {
        startBin: Math.max(0, startBin),
        endBin: Math.min(maxBin, endBin)
    };
}

/**
 * Calculate energy in a specific frequency band from spectrum data
 * @param spectrum Magnitude spectrum (from FFT)
 * @param band Frequency band definition
 * @param fftSize FFT size used
 * @param sampleRate Sample rate of the audio
 * @returns Energy value (sum of squared magnitudes)
 */
export function calculateBandEnergy(spectrum: Float32Array | number[], band: FrequencyBand, fftSize: number, sampleRate: number): number {
    const { startBin, endBin } = getBandBinIndices(band, fftSize, sampleRate);
    let energy = 0;

    for (let i = startBin; i < endBin && i < spectrum.length; i++) {
        energy += spectrum[i] * spectrum[i];
    }

    return energy;
}

/**
 * Analyze frequency balance across all bands
 * @param spectrum Magnitude spectrum
 * @param bands Frequency bands to analyze
 * @param fftSize FFT size
 * @param sampleRate Sample rate
 * @returns Array of band energies
 */
export function analyzeFrequencyBalance(
    spectrum: Float32Array | number[],
    bands: FrequencyBand[],
    fftSize: number,
    sampleRate: number
): FrequencyBandEnergy[] {
    const energies = bands.map(band => ({
        band,
        energy: calculateBandEnergy(spectrum, band, fftSize, sampleRate),
        energyDb: 0,
        percentage: 0
    }));

    const totalEnergy = energies.reduce((sum, e) => sum + e.energy, 0);

    return energies.map(e => {
        const energyDb = e.energy > 0 ? 10 * Math.log10(e.energy) : -100;
        const percentage = totalEnergy > 0 ? (e.energy / totalEnergy) * 100 : 0;

        return {
            ...e,
            energyDb: Math.round(energyDb * 10) / 10,
            percentage: Math.round(percentage * 10) / 10
        };
    });
}

/**
 * Calculate a balance score (0-100) indicating how evenly distributed the energy is
 * A perfectly balanced mix would score 100, heavily skewed would score lower
 * @param bandEnergies Array of band energy results
 * @returns Balance score from 0 to 100
 */
export function calculateBalanceScore(bandEnergies: FrequencyBandEnergy[]): number {
    if (bandEnergies.length === 0) return 0;

    const percentages = bandEnergies.map(e => e.percentage);
    const idealPercentage = 100 / percentages.length;

    // Calculate deviation from ideal distribution
    const deviations = percentages.map(p => Math.abs(p - idealPercentage));
    const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;

    // Convert to 0-100 score (less deviation = higher score)
    const maxDeviation = idealPercentage; // Max possible deviation
    const score = Math.max(0, 100 - (avgDeviation / maxDeviation) * 100);

    return Math.round(score);
}

/**
 * Generate a recommendation based on frequency balance analysis
 * @param bandEnergies Array of band energy results
 * @returns Recommendation string
 */
export function generateBalanceRecommendation(bandEnergies: FrequencyBandEnergy[]): string {
    const recommendations: string[] = [];

    for (const bandEnergy of bandEnergies) {
        const { band, percentage } = bandEnergy;

        // Check for common issues based on band name
        if (band.name === 'Sub-Bass' && percentage > 25) {
            recommendations.push('Consider high-pass filtering to reduce excessive sub-bass.');
        }
        if (band.name === 'Low-Mid' && percentage > 20) {
            recommendations.push('Low-mids may be causing muddiness. Consider cutting 250-500 Hz.');
        }
        if (band.name === 'High-Mid' && percentage > 25) {
            recommendations.push('High-mids may cause listener fatigue. Consider gentle reduction around 2-4 kHz.');
        }
        if (band.name === 'Brilliance' && percentage < 5) {
            recommendations.push('Mix may lack air and sparkle. Consider boosting high frequencies.');
        }
    }

    if (recommendations.length === 0) {
        return 'Frequency balance appears reasonable.';
    }

    return recommendations.join(' ');
}

/**
 * Find the dominant frequency band
 * @param bandEnergies Array of band energy results
 * @returns Name of the dominant band
 */
export function findDominantBand(bandEnergies: FrequencyBandEnergy[]): string {
    if (bandEnergies.length === 0) return 'Unknown';

    let maxEnergy = -Infinity;
    let dominantBand = bandEnergies[0].band.name;

    for (const bandEnergy of bandEnergies) {
        if (bandEnergy.energy > maxEnergy) {
            maxEnergy = bandEnergy.energy;
            dominantBand = bandEnergy.band.name;
        }
    }

    return dominantBand;
}
