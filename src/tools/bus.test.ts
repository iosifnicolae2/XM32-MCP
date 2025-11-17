import { MockX32Connection } from '../services/__mocks__/mock-x32-connection.js';
import { dbToFader } from '../utils/db-converter.js';

describe('Bus Tools Tests', () => {
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

    describe('bus_set_volume', () => {
        test('should set bus volume in linear mode', async () => {
            await connection.setBusParameter(1, 'mix/fader', 0.5);
            const result = await connection.getBusParameter(1, 'mix/fader');
            expect(Number(result)).toBeCloseTo(0.5, 2);
        });

        test('should set bus volume in dB mode', async () => {
            const unityFader = dbToFader(0); // 0 dB
            await connection.setBusParameter(1, 'mix/fader', unityFader);
            const result = await connection.getBusParameter(1, 'mix/fader');
            expect(Number(result)).toBeCloseTo(0.75, 2);
        });

        test('should set volume for different buses', async () => {
            await connection.setBusParameter(2, 'mix/fader', 0.8);
            await connection.setBusParameter(3, 'mix/fader', 0.3);

            const bus2 = await connection.getBusParameter(2, 'mix/fader');
            const bus3 = await connection.getBusParameter(3, 'mix/fader');

            expect(Number(bus2)).toBe(0.8);
            expect(Number(bus3)).toBe(0.3);
        });

        test('should handle all 16 buses', async () => {
            for (let i = 1; i <= 16; i++) {
                const value = i * 0.05; // Different value for each bus
                await connection.setBusParameter(i, 'mix/fader', value);
                const result = await connection.getBusParameter(i, 'mix/fader');
                expect(Number(result)).toBeCloseTo(value, 2);
            }
        });
    });

    describe('bus_mute', () => {
        test('should mute a bus', async () => {
            await connection.setBusParameter(1, 'mix/on', 0); // 0 = muted
            const result = await connection.getBusParameter(1, 'mix/on');
            expect(Number(result)).toBe(0);
        });

        test('should unmute a bus', async () => {
            await connection.setBusParameter(1, 'mix/on', 1); // 1 = unmuted
            const result = await connection.getBusParameter(1, 'mix/on');
            expect(Number(result)).toBe(1);
        });

        test('should toggle mute state', async () => {
            // Start unmuted
            await connection.setBusParameter(2, 'mix/on', 1);
            expect(Number(await connection.getBusParameter(2, 'mix/on'))).toBe(1);

            // Mute
            await connection.setBusParameter(2, 'mix/on', 0);
            expect(Number(await connection.getBusParameter(2, 'mix/on'))).toBe(0);

            // Unmute again
            await connection.setBusParameter(2, 'mix/on', 1);
            expect(Number(await connection.getBusParameter(2, 'mix/on'))).toBe(1);
        });
    });

    describe('bus_set_send', () => {
        test('should set channel send to bus', async () => {
            // Channel 1 send to bus 1 at 0.5
            await connection.setParameter('/ch/01/mix/01/level', 0.5);
            const result = await connection.getParameter('/ch/01/mix/01/level');
            expect(Number(result)).toBe(0.5);
        });

        test('should set different send levels for same channel', async () => {
            // Channel 1 to multiple buses
            await connection.setParameter('/ch/01/mix/01/level', 0.5);
            await connection.setParameter('/ch/01/mix/02/level', 0.7);
            await connection.setParameter('/ch/01/mix/03/level', 0.3);

            expect(Number(await connection.getParameter('/ch/01/mix/01/level'))).toBe(0.5);
            expect(Number(await connection.getParameter('/ch/01/mix/02/level'))).toBe(0.7);
            expect(Number(await connection.getParameter('/ch/01/mix/03/level'))).toBe(0.3);
        });

        test('should set send levels from different channels to same bus', async () => {
            // Multiple channels to bus 1
            await connection.setParameter('/ch/01/mix/01/level', 0.5);
            await connection.setParameter('/ch/02/mix/01/level', 0.6);
            await connection.setParameter('/ch/03/mix/01/level', 0.7);

            expect(Number(await connection.getParameter('/ch/01/mix/01/level'))).toBe(0.5);
            expect(Number(await connection.getParameter('/ch/02/mix/01/level'))).toBe(0.6);
            expect(Number(await connection.getParameter('/ch/03/mix/01/level'))).toBe(0.7);
        });

        test('should handle send levels in dB', async () => {
            const unityFader = dbToFader(0); // 0 dB
            await connection.setParameter('/ch/01/mix/01/level', unityFader);
            const result = await connection.getParameter('/ch/01/mix/01/level');
            expect(Number(result)).toBeCloseTo(0.75, 2);
        });
    });

    describe('bus_get_state', () => {
        test('should get complete bus state', async () => {
            // Set up bus state
            await connection.setBusParameter(1, 'mix/fader', 0.5);
            await connection.setBusParameter(1, 'mix/on', 1);
            await connection.setBusParameter(1, 'mix/pan', 0.5);

            // Get state
            const fader = await connection.getBusParameter(1, 'mix/fader');
            const on = await connection.getBusParameter(1, 'mix/on');
            const pan = await connection.getBusParameter(1, 'mix/pan');

            expect(Number(fader)).toBe(0.5);
            expect(Number(on)).toBe(1);
            expect(Number(pan)).toBe(0.5);
        });

        test('should get state for different buses', async () => {
            // Set up bus 1
            await connection.setBusParameter(1, 'mix/fader', 0.6);
            await connection.setBusParameter(1, 'mix/on', 1);

            // Set up bus 2
            await connection.setBusParameter(2, 'mix/fader', 0.4);
            await connection.setBusParameter(2, 'mix/on', 0);

            // Verify bus 1
            expect(Number(await connection.getBusParameter(1, 'mix/fader'))).toBe(0.6);
            expect(Number(await connection.getBusParameter(1, 'mix/on'))).toBe(1);

            // Verify bus 2
            expect(Number(await connection.getBusParameter(2, 'mix/fader'))).toBe(0.4);
            expect(Number(await connection.getBusParameter(2, 'mix/on'))).toBe(0);
        });

        test('should handle optional parameters gracefully', async () => {
            // Set basic state
            await connection.setBusParameter(3, 'mix/fader', 0.75);
            await connection.setBusParameter(3, 'mix/on', 1);
            await connection.setBusParameter(3, 'mix/pan', 0.5);

            // Try to get optional parameters
            try {
                await connection.getBusParameter(3, 'config/name');
            } catch {
                // Name may not be available
            }

            try {
                await connection.getBusParameter(3, 'config/color');
            } catch {
                // Color may not be available
            }

            // Basic parameters should still work
            expect(Number(await connection.getBusParameter(3, 'mix/fader'))).toBe(0.75);
        });
    });

    describe('bus parameter validation', () => {
        test('should reject invalid bus numbers', async () => {
            await expect(connection.setBusParameter(0, 'mix/fader', 0.5)).rejects.toThrow();
            await expect(connection.setBusParameter(17, 'mix/fader', 0.5)).rejects.toThrow();
            await expect(connection.setBusParameter(-1, 'mix/fader', 0.5)).rejects.toThrow();
        });

        test('should accept all valid bus numbers', async () => {
            for (let i = 1; i <= 16; i++) {
                await expect(connection.setBusParameter(i, 'mix/fader', 0.5)).resolves.not.toThrow();
            }
        });
    });
});
