/**
 * Supported mixer device types
 */
export type DeviceType = 'X32' | 'XR18' | 'XR16' | 'XR12';

/**
 * Device-specific configuration
 */
export interface DeviceConfig {
    type: DeviceType;
    /** Default OSC port for this device (10023 for X32/M32, 10024 for XR series) */
    defaultPort: number;
    /** Number of input channels */
    channels: number;
    /** Number of buses */
    buses: number;
    /** Number of FX slots */
    fxSlots: number;
    /** Number of DCAs */
    dcas: number;
    /** Number of FX sends */
    fxSends: number;
    /** Address patterns */
    addresses: DeviceAddresses;
}

/**
 * Device-specific OSC address patterns
 */
export interface DeviceAddresses {
    /** Main LR/stereo output base address */
    main: string;
    /** Channel address pattern (use {ch} for channel number) */
    channel: string;
    /** Bus address pattern (use {bus} for bus number) */
    bus: string;
    /** FX address pattern (use {fx} for fx number) */
    fx: string;
    /** DCA address pattern (use {dca} for dca number) */
    dca: string;
    /** FX send address pattern (use {fxsend} for send number) - XR series only */
    fxSend?: string;
    /** Aux input address - XR series */
    auxIn?: string;
    /** FX return address pattern (use {fxrtn} for return number) */
    fxReturn: string;
}

/**
 * X32/M32 device configuration
 * Full-size consoles with 32 channels, 16 buses, 8 DCAs
 * Uses OSC port 10023
 */
export const X32_CONFIG: DeviceConfig = {
    type: 'X32',
    defaultPort: 10023,
    channels: 32,
    buses: 16,
    fxSlots: 8,
    dcas: 8,
    fxSends: 0, // X32 doesn't have separate FX sends
    addresses: {
        main: '/main/st',
        channel: '/ch/{ch}',
        bus: '/bus/{bus}',
        fx: '/fx/{fx}',
        dca: '/dca/{dca}',
        fxReturn: '/fxrtn/{fxrtn}'
    }
};

/**
 * XR18 device configuration
 * 18-channel rack mixer (XAir series)
 * Uses OSC port 10024
 */
export const XR18_CONFIG: DeviceConfig = {
    type: 'XR18',
    defaultPort: 10024,
    channels: 16,
    buses: 6,
    fxSlots: 4,
    dcas: 4,
    fxSends: 4,
    addresses: {
        main: '/lr',
        channel: '/ch/{ch}',
        bus: '/bus/{bus}',
        fx: '/fx/{fx}',
        dca: '/dca/{dca}',
        fxSend: '/fxsend/{fxsend}',
        auxIn: '/rtn/aux',
        fxReturn: '/rtn/{fxrtn}'
    }
};

/**
 * XR16 device configuration
 * 16-channel rack mixer (XAir series, no USB recording)
 * Uses OSC port 10024
 */
export const XR16_CONFIG: DeviceConfig = {
    type: 'XR16',
    defaultPort: 10024,
    channels: 16,
    buses: 6,
    fxSlots: 4,
    dcas: 4,
    fxSends: 4,
    addresses: {
        main: '/lr',
        channel: '/ch/{ch}',
        bus: '/bus/{bus}',
        fx: '/fx/{fx}',
        dca: '/dca/{dca}',
        fxSend: '/fxsend/{fxsend}',
        auxIn: '/rtn/aux',
        fxReturn: '/rtn/{fxrtn}'
    }
};

/**
 * XR12 device configuration
 * 12-channel rack mixer (XAir series)
 * Uses OSC port 10024
 */
export const XR12_CONFIG: DeviceConfig = {
    type: 'XR12',
    defaultPort: 10024,
    channels: 12,
    buses: 2, // Limited buses on XR12
    fxSlots: 4,
    dcas: 4,
    fxSends: 4,
    addresses: {
        main: '/lr',
        channel: '/ch/{ch}',
        bus: '/bus/{bus}',
        fx: '/fx/{fx}',
        dca: '/dca/{dca}',
        fxSend: '/fxsend/{fxsend}',
        auxIn: '/rtn/aux',
        fxReturn: '/rtn/{fxrtn}'
    }
};

/**
 * Get device configuration by type
 */
export function getDeviceConfig(type: DeviceType): DeviceConfig {
    switch (type) {
        case 'X32':
            return X32_CONFIG;
        case 'XR18':
            return XR18_CONFIG;
        case 'XR16':
            return XR16_CONFIG;
        case 'XR12':
            return XR12_CONFIG;
        default:
            throw new Error(`Unknown device type: ${type}`);
    }
}

/**
 * Parse device type from environment variable
 */
export function parseDeviceType(value: string | undefined): DeviceType {
    if (!value) {
        return 'X32'; // Default to X32 for backward compatibility
    }
    const normalized = value.toUpperCase();
    if (['X32', 'M32'].includes(normalized)) {
        return 'X32';
    }
    if (['XR18', 'X18'].includes(normalized)) {
        return 'XR18';
    }
    if (normalized === 'XR16') {
        return 'XR16';
    }
    if (normalized === 'XR12') {
        return 'XR12';
    }
    // Default to X32 if unknown
    return 'X32';
}

/**
 * Format address with device-specific pattern
 */
export function formatAddress(config: DeviceConfig, template: keyof DeviceAddresses, values: Record<string, number | string> = {}): string {
    let address = config.addresses[template];
    if (!address) {
        throw new Error(`Address template '${template}' not available for ${config.type}`);
    }

    for (const [key, value] of Object.entries(values)) {
        const placeholder = `{${key}}`;
        if (typeof value === 'number') {
            // Pad numbers with leading zeros (2 digits for channels/buses)
            address = address.replace(placeholder, value.toString().padStart(2, '0'));
        } else {
            address = address.replace(placeholder, value);
        }
    }

    return address;
}
