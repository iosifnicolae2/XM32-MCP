/**
 * Type declarations for Meyda audio analysis library
 * These declarations match the actual runtime API of Meyda
 */
declare module 'meyda' {
    export interface MeydaFeaturesObject {
        amplitudeSpectrum?: Float32Array;
        buffer?: number[];
        chroma?: number[];
        complexSpectrum?: {
            real: number[];
            imag: number[];
        };
        energy?: number;
        loudness?: {
            specific: Float32Array;
            total: number;
        };
        mfcc?: number[];
        melBands?: number[];
        perceptualSharpness?: number;
        perceptualSpread?: number;
        powerSpectrum?: Float32Array;
        rms?: number;
        spectralCentroid?: number;
        spectralFlatness?: number;
        spectralFlux?: number;
        spectralKurtosis?: number;
        spectralRolloff?: number;
        spectralSkewness?: number;
        spectralSlope?: number;
        spectralSpread?: number;
        spectralCrest?: number;
        zcr?: number;
    }

    export type MeydaWindowingFunction = 'blackman' | 'sine' | 'hanning' | 'hamming';

    export type MeydaAudioFeature =
        | 'amplitudeSpectrum'
        | 'chroma'
        | 'complexSpectrum'
        | 'energy'
        | 'loudness'
        | 'mfcc'
        | 'melBands'
        | 'perceptualSharpness'
        | 'perceptualSpread'
        | 'powerSpectrum'
        | 'rms'
        | 'spectralCentroid'
        | 'spectralFlatness'
        | 'spectralFlux'
        | 'spectralKurtosis'
        | 'spectralRolloff'
        | 'spectralSkewness'
        | 'spectralSlope'
        | 'spectralSpread'
        | 'spectralCrest'
        | 'zcr'
        | 'buffer';

    export type MeydaSignal = ArrayLike<number> | Float32Array;

    interface Meyda {
        bufferSize: number;
        sampleRate: number;
        melBands: number;
        chromaBands: number;
        numberOfMFCCCoefficients: number;
        numberOfBarkBands: number;
        windowingFunction: MeydaWindowingFunction;

        windowing: (signal: MeydaSignal, windowname?: MeydaWindowingFunction) => MeydaSignal;
        listAvailableFeatureExtractors: () => MeydaAudioFeature[];
        extract: (
            feature: MeydaAudioFeature | MeydaAudioFeature[],
            signal: MeydaSignal,
            previousSignal?: MeydaSignal
        ) => Partial<MeydaFeaturesObject> | null;
    }

    const Meyda: Meyda;
    export default Meyda;
}
