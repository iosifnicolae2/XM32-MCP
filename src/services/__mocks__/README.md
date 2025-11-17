# Mock X32 Connection

This directory contains mock implementations of the X32 connection for testing purposes.

## MockX32Connection

A complete mock implementation of the X32Connection class that simulates X32/M32 mixer behavior without requiring actual hardware.

### Features

- Full API compatibility with X32Connection
- In-memory parameter storage
- Simulated network delays
- Event emission (connected, disconnected, message)
- Default parameter initialization for all channels and buses
- Reset functionality for test isolation

### Usage

```typescript
import { MockX32Connection } from '../services/__mocks__/mock-x32-connection.js';

describe('Your Test Suite', () => {
    let connection: MockX32Connection;

    beforeEach(async () => {
        connection = new MockX32Connection();
        await connection.connect({ host: 'localhost', port: 10023 });
    });

    afterEach(async () => {
        if (connection.connected) {
            await connection.disconnect();
        }
        connection.reset();
    });

    test('example test', async () => {
        await connection.setChannelParameter(1, 'mix/fader', 0.5);
        const fader = await connection.getChannelParameter(1, 'mix/fader');
        expect(Number(fader)).toBe(0.5);
    });
});
```

### Default Parameters

The mock initializes the following default parameters:

#### Channels (1-32)

- `config/name`: "Ch {n}"
- `config/color`: 0 (off)
- `config/icon`: 0
- `mix/fader`: 0.75 (unity gain)
- `mix/on`: 1 (unmuted)
- `mix/pan`: 0.5 (center)
- `solo`: 0 (not soloed)

#### Buses (1-16)

- `mix/fader`: 0.75
- `mix/on`: 1
- `mix/pan`: 0.5

#### Main

- `mix/fader`: 0.75
- `mix/on`: 1
- `mix/pan`: 0.5

### Advanced Usage

#### Set Custom Parameter Values

```typescript
// Set a custom parameter for testing edge cases
connection.setMockParameter('/ch/01/custom/param', 42);
```

#### Inspect All Parameters

```typescript
// Get all stored parameters for debugging
const params = connection.getMockParameters();
console.log(params);
```

#### Reset Between Tests

```typescript
// Reset all parameters to defaults and clear connection state
connection.reset();
```

### Differences from Real X32Connection

1. **No Network Communication**: All operations are in-memory
2. **Simulated Delays**: Small timeouts (5-10ms) to simulate async behavior
3. **No OSC Protocol**: Values are stored directly without OSC encoding/decoding
4. **Always Available**: Never fails due to network issues or hardware problems

### Testing Best Practices

1. **Always reset**: Use `connection.reset()` in `afterEach` to ensure test isolation
2. **Test both success and error cases**: The mock properly throws errors for invalid inputs
3. **Verify async behavior**: The mock simulates async operations with small delays
4. **Use event listeners**: Test event emission (connected, disconnected) when needed

### Example Test Patterns

#### Testing Connection Management

```typescript
test('should connect successfully', async () => {
    await connection.connect({ host: 'localhost', port: 10023 });
    expect(connection.connected).toBe(true);
});

test('should emit connected event', async () => {
    const spy = jest.fn();
    connection.on('connected', spy);
    await connection.connect({ host: 'localhost', port: 10023 });
    expect(spy).toHaveBeenCalledTimes(1);
});
```

#### Testing Parameter Operations

```typescript
test('should set and get parameters', async () => {
    await connection.setChannelParameter(1, 'mix/fader', 0.8);
    const result = await connection.getChannelParameter(1, 'mix/fader');
    expect(Number(result)).toBe(0.8);
});
```

#### Testing Error Handling

```typescript
test('should throw error when disconnected', async () => {
    await expect(connection.getParameter('/ch/01/mix/fader')).rejects.toThrow('Not connected to X32/M32');
});

test('should validate channel range', async () => {
    await connection.connect({ host: 'localhost', port: 10023 });
    await expect(connection.getChannelParameter(33, 'mix/fader')).rejects.toThrow('Channel must be between 1 and 32');
});
```
