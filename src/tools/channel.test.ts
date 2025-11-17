import { MockX32Connection } from '../services/__mocks__/mock-x32-connection.js';
import { dbToFader } from '../utils/db-converter.js';
import { getColorValue, getColorName } from '../utils/color-converter.js';
import { parsePan, panToPercent } from '../utils/pan-converter.js';

describe('Channel Tools Tests', () => {
    let connection: MockX32Connection;

    beforeEach(async () => {
        connection = new MockX32Connection();
        await connection.connect({ host: '10.69.6.254', port: 10023 });
    });

    afterEach(async () => {
        if (connection.connected) {
            await connection.disconnect();
        }
        connection.reset();
    });

    describe('channel_set_volume', () => {
        test('should set volume in linear mode', async () => {
            await connection.setChannelParameter(1, 'mix/fader', 0.5);
            const result = await connection.getChannelParameter(1, 'mix/fader');
            expect(Number(result)).toBeCloseTo(0.5, 2);
        });

        test('should set volume in dB mode', async () => {
            const unityFader = dbToFader(0); // 0 dB
            await connection.setChannelParameter(1, 'mix/fader', unityFader);
            const result = await connection.getChannelParameter(1, 'mix/fader');
            expect(Number(result)).toBeCloseTo(0.75, 2);
        });

        test('should set volume for different channels', async () => {
            await connection.setChannelParameter(2, 'mix/fader', 0.8);
            await connection.setChannelParameter(3, 'mix/fader', 0.3);

            const ch2 = await connection.getChannelParameter(2, 'mix/fader');
            const ch3 = await connection.getChannelParameter(3, 'mix/fader');

            expect(Number(ch2)).toBe(0.8);
            expect(Number(ch3)).toBe(0.3);
        });
    });

    describe('channel_set_name', () => {
        test('should set channel name', async () => {
            const testName = 'Test Ch 1';
            await connection.setChannelParameter(1, 'config/name', testName);
            const result = await connection.getChannelParameter(1, 'config/name');
            expect(result).toBe(testName);
        });

        test('should handle truncation of long names', async () => {
            const longName = 'This is a very long channel name';
            const truncated = longName.substring(0, 12);
            await connection.setChannelParameter(2, 'config/name', truncated);
            const result = await connection.getChannelParameter(2, 'config/name');
            expect(result).toBe(truncated);
        });

        test('should set names for different channels', async () => {
            await connection.setChannelParameter(1, 'config/name', 'Vocals');
            await connection.setChannelParameter(2, 'config/name', 'Guitar');
            await connection.setChannelParameter(3, 'config/name', 'Bass');

            expect(await connection.getChannelParameter(1, 'config/name')).toBe('Vocals');
            expect(await connection.getChannelParameter(2, 'config/name')).toBe('Guitar');
            expect(await connection.getChannelParameter(3, 'config/name')).toBe('Bass');
        });
    });

    describe('channel_set_color', () => {
        test('should set color by name', async () => {
            const colorValue = getColorValue('red');
            expect(colorValue).toBe(1);
            await connection.setChannelParameter(1, 'config/color', colorValue!);
            const result = await connection.getChannelParameter(1, 'config/color');
            expect(Number(result)).toBe(1);
        });

        test('should set color by number', async () => {
            await connection.setChannelParameter(2, 'config/color', 2); // Green
            const result = await connection.getChannelParameter(2, 'config/color');
            expect(Number(result)).toBe(2);
            expect(getColorName(2)).toBe('green');
        });

        test('should support all available colors', async () => {
            const colors = [
                { name: 'off', value: 0 },
                { name: 'red', value: 1 },
                { name: 'green', value: 2 },
                { name: 'yellow', value: 3 },
                { name: 'blue', value: 4 },
                { name: 'magenta', value: 5 },
                { name: 'cyan', value: 6 },
                { name: 'white', value: 7 }
            ];

            for (const color of colors) {
                await connection.setChannelParameter(1, 'config/color', color.value);
                const result = await connection.getChannelParameter(1, 'config/color');
                expect(Number(result)).toBe(color.value);
                expect(getColorName(color.value)).toBe(color.name);
            }
        });
    });

    describe('channel_set_pan', () => {
        test('should set pan to center', async () => {
            await connection.setChannelParameter(1, 'mix/pan', 0.5);
            const result = await connection.getChannelParameter(1, 'mix/pan');
            expect(Number(result)).toBeCloseTo(0.5, 2);
        });

        test('should set pan using percentage', async () => {
            const panValue = parsePan(-50); // 50% left
            expect(panValue).toBeCloseTo(0.25, 2);
            await connection.setChannelParameter(2, 'mix/pan', panValue!);
            const result = await connection.getChannelParameter(2, 'mix/pan');
            expect(panToPercent(Number(result))).toBeCloseTo(-50, 0);
        });

        test('should set pan using LR notation', async () => {
            const panValue = parsePan('L100'); // Full left
            expect(panValue).toBe(0);
            await connection.setChannelParameter(3, 'mix/pan', panValue!);
            const result = await connection.getChannelParameter(3, 'mix/pan');
            expect(Number(result)).toBe(0);
        });

        test('should set pan to full right', async () => {
            await connection.setChannelParameter(4, 'mix/pan', 1.0);
            const result = await connection.getChannelParameter(4, 'mix/pan');
            expect(Number(result)).toBe(1.0);
        });

        test('should handle various pan positions', async () => {
            const positions = [
                { value: 0, expected: 0 }, // Full left
                { value: 0.25, expected: 0.25 }, // 25% left
                { value: 0.5, expected: 0.5 }, // Center
                { value: 0.75, expected: 0.75 }, // 25% right
                { value: 1.0, expected: 1.0 } // Full right
            ];

            for (const pos of positions) {
                await connection.setChannelParameter(1, 'mix/pan', pos.value);
                const result = await connection.getChannelParameter(1, 'mix/pan');
                expect(Number(result)).toBeCloseTo(pos.expected, 2);
            }
        });
    });

    describe('channel_mute', () => {
        test('should mute channel', async () => {
            // Mute (X32 inverted: 0 = muted)
            await connection.setChannelParameter(1, 'mix/on', 0);
            const result = await connection.getChannelParameter(1, 'mix/on');
            expect(Number(result)).toBe(0);
        });

        test('should unmute channel', async () => {
            // Unmute (1 = unmuted)
            await connection.setChannelParameter(1, 'mix/on', 1);
            const result = await connection.getChannelParameter(1, 'mix/on');
            expect(Number(result)).toBe(1);
        });

        test('should toggle mute state', async () => {
            // Start unmuted
            await connection.setChannelParameter(1, 'mix/on', 1);
            expect(Number(await connection.getChannelParameter(1, 'mix/on'))).toBe(1);

            // Mute
            await connection.setChannelParameter(1, 'mix/on', 0);
            expect(Number(await connection.getChannelParameter(1, 'mix/on'))).toBe(0);

            // Unmute again
            await connection.setChannelParameter(1, 'mix/on', 1);
            expect(Number(await connection.getChannelParameter(1, 'mix/on'))).toBe(1);
        });

        test('should handle mute for multiple channels', async () => {
            await connection.setChannelParameter(1, 'mix/on', 0); // Mute ch1
            await connection.setChannelParameter(2, 'mix/on', 1); // Unmute ch2
            await connection.setChannelParameter(3, 'mix/on', 0); // Mute ch3

            expect(Number(await connection.getChannelParameter(1, 'mix/on'))).toBe(0);
            expect(Number(await connection.getChannelParameter(2, 'mix/on'))).toBe(1);
            expect(Number(await connection.getChannelParameter(3, 'mix/on'))).toBe(0);
        });
    });

    describe('channel_solo', () => {
        test('should solo channel', async () => {
            // Solo on
            await connection.setChannelParameter(1, 'solo', 1);
            const result = await connection.getChannelParameter(1, 'solo');
            expect(Number(result)).toBe(1);
        });

        test('should unsolo channel', async () => {
            // Solo off
            await connection.setChannelParameter(1, 'solo', 0);
            const result = await connection.getChannelParameter(1, 'solo');
            expect(Number(result)).toBe(0);
        });

        test('should toggle solo state', async () => {
            // Solo on
            await connection.setChannelParameter(1, 'solo', 1);
            expect(Number(await connection.getChannelParameter(1, 'solo'))).toBe(1);

            // Solo off
            await connection.setChannelParameter(1, 'solo', 0);
            expect(Number(await connection.getChannelParameter(1, 'solo'))).toBe(0);

            // Solo on again
            await connection.setChannelParameter(1, 'solo', 1);
            expect(Number(await connection.getChannelParameter(1, 'solo'))).toBe(1);
        });

        test('should handle solo for multiple channels', async () => {
            await connection.setChannelParameter(1, 'solo', 1); // Solo ch1
            await connection.setChannelParameter(2, 'solo', 1); // Solo ch2
            await connection.setChannelParameter(3, 'solo', 0); // Unsolo ch3

            expect(Number(await connection.getChannelParameter(1, 'solo'))).toBe(1);
            expect(Number(await connection.getChannelParameter(2, 'solo'))).toBe(1);
            expect(Number(await connection.getChannelParameter(3, 'solo'))).toBe(0);
        });
    });

    describe('Channel Integration Tests', () => {
        test('should set multiple parameters on same channel', async () => {
            // Set all parameters for channel 1
            await connection.setChannelParameter(1, 'config/name', 'Lead Vocal');
            await connection.setChannelParameter(1, 'config/color', 1); // Red
            await connection.setChannelParameter(1, 'mix/fader', 0.8);
            await connection.setChannelParameter(1, 'mix/pan', 0.5);
            await connection.setChannelParameter(1, 'mix/on', 1);

            // Verify all parameters
            expect(await connection.getChannelParameter(1, 'config/name')).toBe('Lead Vocal');
            expect(Number(await connection.getChannelParameter(1, 'config/color'))).toBe(1);
            expect(Number(await connection.getChannelParameter(1, 'mix/fader'))).toBe(0.8);
            expect(Number(await connection.getChannelParameter(1, 'mix/pan'))).toBe(0.5);
            expect(Number(await connection.getChannelParameter(1, 'mix/on'))).toBe(1);
        });

        test('should maintain independent state for different channels', async () => {
            // Configure channel 1
            await connection.setChannelParameter(1, 'config/name', 'Ch1');
            await connection.setChannelParameter(1, 'mix/fader', 0.5);

            // Configure channel 2
            await connection.setChannelParameter(2, 'config/name', 'Ch2');
            await connection.setChannelParameter(2, 'mix/fader', 0.9);

            // Verify channels maintain their own state
            expect(await connection.getChannelParameter(1, 'config/name')).toBe('Ch1');
            expect(Number(await connection.getChannelParameter(1, 'mix/fader'))).toBe(0.5);
            expect(await connection.getChannelParameter(2, 'config/name')).toBe('Ch2');
            expect(Number(await connection.getChannelParameter(2, 'mix/fader'))).toBe(0.9);
        });

        test('should handle channel operations across valid range', async () => {
            // Test first and last channels
            await connection.setChannelParameter(1, 'config/name', 'First');
            await connection.setChannelParameter(32, 'config/name', 'Last');

            expect(await connection.getChannelParameter(1, 'config/name')).toBe('First');
            expect(await connection.getChannelParameter(32, 'config/name')).toBe('Last');
        });
    });

    describe('Error Handling', () => {
        test('should throw error for invalid channel numbers', async () => {
            await expect(connection.setChannelParameter(0, 'mix/fader', 0.5)).rejects.toThrow('Channel must be between 1 and 32');

            await expect(connection.setChannelParameter(33, 'mix/fader', 0.5)).rejects.toThrow('Channel must be between 1 and 32');

            await expect(connection.setChannelParameter(-1, 'mix/fader', 0.5)).rejects.toThrow('Channel must be between 1 and 32');
        });

        test('should handle disconnection during operations', async () => {
            await connection.disconnect();

            await expect(connection.setChannelParameter(1, 'mix/fader', 0.5)).rejects.toThrow('Not connected to X32/M32');

            await expect(connection.getChannelParameter(1, 'mix/fader')).rejects.toThrow('Not connected to X32/M32');
        });
    });
});
