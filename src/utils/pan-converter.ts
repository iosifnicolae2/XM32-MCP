/**
 * X32/M32 pan (stereo positioning) utilities
 * Handles conversion between linear pan values and percentage/LR notation
 */

/**
 * Convert percentage pan value to linear (0.0-1.0)
 * -100% (full left) = 0.0
 * 0% (center) = 0.5
 * +100% (full right) = 1.0
 *
 * @param percent - Pan percentage (-100 to +100)
 * @returns Linear pan value (0.0 to 1.0)
 */
export function percentToPan(percent: number): number {
    // Clamp to valid range
    const clamped = Math.max(-100, Math.min(100, percent));
    // Convert: -100 to +100 => 0.0 to 1.0
    return (clamped + 100) / 200;
}

/**
 * Convert linear pan value (0.0-1.0) to percentage
 *
 * @param pan - Linear pan value (0.0 to 1.0)
 * @returns Pan percentage (-100 to +100)
 */
export function panToPercent(pan: number): number {
    // Clamp to valid range
    const clamped = Math.max(0, Math.min(1, pan));
    // Convert: 0.0 to 1.0 => -100 to +100
    return clamped * 200 - 100;
}

/**
 * Convert LR notation to linear pan value
 * L50 = 50% left = 0.25
 * C = center = 0.5
 * R50 = 50% right = 0.75
 * L100 = full left = 0.0
 * R100 = full right = 1.0
 *
 * @param lr - LR notation string (e.g., "L50", "C", "R100")
 * @returns Linear pan value (0.0 to 1.0) or null if invalid
 */
export function lrToPan(lr: string): number | null {
    const normalized = lr.toUpperCase().trim();

    // Handle center
    if (normalized === 'C' || normalized === 'CENTER') {
        return 0.5;
    }

    // Handle L/R notation
    const match = normalized.match(/^([LR])(\d+)?$/);
    if (!match) {
        return null;
    }

    const side = match[1];
    const amount = match[2] ? parseInt(match[2], 10) : 100;

    if (amount < 0 || amount > 100) {
        return null;
    }

    if (side === 'L') {
        // Left: L100 = 0.0, L50 = 0.25, L0 = 0.5
        return 0.5 - amount / 200;
    } else {
        // Right: R0 = 0.5, R50 = 0.75, R100 = 1.0
        return 0.5 + amount / 200;
    }
}

/**
 * Convert linear pan value to LR notation
 *
 * @param pan - Linear pan value (0.0 to 1.0)
 * @returns LR notation string
 */
export function panToLr(pan: number): string {
    const percent = panToPercent(pan);

    if (Math.abs(percent) < 0.5) {
        return 'C';
    } else if (percent < 0) {
        return `L${Math.round(Math.abs(percent))}`;
    } else {
        return `R${Math.round(percent)}`;
    }
}

/**
 * Format pan value for display
 *
 * @param pan - Linear pan value (0.0 to 1.0)
 * @returns Formatted string (e.g., "L50", "C", "R75")
 */
export function formatPan(pan: number): string {
    return panToLr(pan);
}

/**
 * Parse pan value from various input formats
 * Accepts: percentage (-100 to 100), LR notation ("L50", "R100"), or linear (0.0-1.0)
 *
 * @param input - Pan value in various formats
 * @returns Linear pan value (0.0 to 1.0) or null if invalid
 */
export function parsePan(input: string | number): number | null {
    if (typeof input === 'number') {
        if (input >= -100 && input <= 100) {
            // Assume percentage
            return percentToPan(input);
        } else if (input >= 0 && input <= 1) {
            // Assume linear
            return input;
        }
        return null;
    }

    const str = input.trim();

    // Try LR notation first
    const lrValue = lrToPan(str);
    if (lrValue !== null) {
        return lrValue;
    }

    // Try parsing as number
    const num = parseFloat(str);
    if (!isNaN(num)) {
        return parsePan(num);
    }

    return null;
}
