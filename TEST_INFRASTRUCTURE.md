# Test Infrastructure Documentation

## Overview

The X32-MCP project uses a mock-based testing approach that eliminates the need for actual X32/M32 hardware during development and CI/CD processes.

## Mock Implementation

### MockX32Connection

Located at: `/Users/beomsu/Documents/GitHub/X32-MCP/src/services/__mocks__/mock-x32-connection.ts`

The `MockX32Connection` class is a complete, drop-in replacement for the real `X32Connection` class used in testing.

#### Key Features

1. **Full API Compatibility**: Implements the same interface as `X32Connection`
2. **In-Memory State**: All parameters stored in a Map for fast access
3. **Realistic Behavior**: Simulates network delays (5-10ms) for async operations
4. **Event Emission**: Properly emits `connected`, `disconnected`, and `message` events
5. **Error Handling**: Throws appropriate errors for invalid operations
6. **Test Isolation**: Provides `reset()` method to clear state between tests

#### Architecture

```typescript
MockX32Connection extends EventEmitter {
  // Connection state
  private isConnected: boolean
  private config: X32ConnectionConfig | null

  // Parameter storage
  private parameterStore: Map<string, unknown>

  // Default responses
  private DEFAULT_INFO: X32InfoResponse
  private DEFAULT_STATUS: X32StatusResponse

  // Public API (mirrors X32Connection)
  async connect(config): Promise<void>
  async disconnect(): Promise<void>
  async getInfo(): Promise<X32InfoResponse>
  async getStatus(): Promise<X32StatusResponse>
  async getParameter<T>(address: string): Promise<T>
  async setParameter(address: string, value: unknown): Promise<void>
  async getChannelParameter<T>(channel: number, param: string): Promise<T>
  async setChannelParameter(channel: number, param: string, value: unknown): Promise<void>
  async getBusParameter<T>(bus: number, param: string): Promise<T>
  async setBusParameter(bus: number, param: string, value: unknown): Promise<void>

  // Mock-specific methods
  reset(): void
  setMockParameter(address: string, value: unknown): void
  getMockParameters(): Map<string, unknown>
}
```

#### Default Parameter Initialization

The mock initializes realistic default values on construction:

**Channels (1-32)**:

- `config/name`: "Ch {n}"
- `config/color`: 0 (off)
- `config/icon`: 0
- `mix/fader`: 0.75 (unity gain)
- `mix/on`: 1 (unmuted)
- `mix/pan`: 0.5 (center)
- `solo`: 0 (not soloed)

**Buses (1-16)**:

- `mix/fader`: 0.75
- `mix/on`: 1
- `mix/pan`: 0.5

**Main**:

- `mix/fader`: 0.75
- `mix/on`: 1
- `mix/pan`: 0.5

## Test Files

### 1. Connection Tests

**File**: `/Users/beomsu/Documents/GitHub/X32-MCP/src/services/x32-connection.test.ts`

**Test Coverage**:

- Connection management (connect, disconnect, reconnect)
- Event emission (connected, disconnected)
- Mixer info retrieval
- Mixer status retrieval
- Channel parameter operations
- Bus parameter operations
- Generic parameter operations
- Error handling for disconnected state
- Parameter range validation

**Test Count**: 22 tests

### 2. Channel Tools Tests

**File**: `/Users/beomsu/Documents/GitHub/X32-MCP/src/tools/channel.test.ts`

**Test Coverage**:

- Volume control (linear and dB modes)
- Channel naming
- Color assignment (all 8 basic colors)
- Pan control (various positions and notations)
- Mute operations
- Solo operations
- Multi-parameter integration tests
- Independent channel state
- Error handling for invalid channels

**Test Count**: 25 tests

### 3. Utility Tests

**Files**:

- `/Users/beomsu/Documents/GitHub/X32-MCP/src/utils/db-converter.test.ts` (21 tests)
- `/Users/beomsu/Documents/GitHub/X32-MCP/src/utils/pan-converter.test.ts` (12 tests)
- `/Users/beomsu/Documents/GitHub/X32-MCP/src/utils/color-converter.test.ts` (8 tests)

**Total Utility Tests**: 41 tests

## Test Statistics

### Overall Test Suite

- **Total Test Suites**: 5
- **Total Tests**: 88
- **Pass Rate**: 100%
- **Execution Time**: ~2.7 seconds

### Coverage Metrics

**Utilities** (High Coverage):

- Statements: 87.71%
- Branches: 78.78%
- Functions: 86.66%
- Lines: 88.78%

**Services & Tools** (Currently Not Covered):

- These require integration with the MCP server
- Mock allows testing of connection logic in isolation
- Future tests can verify tool implementations using the mock

## Usage Patterns

### Basic Test Setup

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

### Testing Event Emission

```typescript
test('should emit connected event', async () => {
    const spy = jest.fn();
    connection.on('connected', spy);
    await connection.connect({ host: 'localhost', port: 10023 });
    expect(spy).toHaveBeenCalledTimes(1);
});
```

### Testing Error Conditions

```typescript
test('should validate channel range', async () => {
    await expect(connection.getChannelParameter(0, 'mix/fader')).rejects.toThrow('Channel must be between 1 and 32');

    await expect(connection.getChannelParameter(33, 'mix/fader')).rejects.toThrow('Channel must be between 1 and 32');
});
```

### Custom Mock State

```typescript
test('custom parameter test', async () => {
    // Set a custom value for testing edge cases
    connection.setMockParameter('/ch/01/custom/param', 42);

    const value = await connection.getParameter('/ch/01/custom/param');
    expect(value).toBe(42);
});
```

## Jest Configuration

**File**: `/Users/beomsu/Documents/GitHub/X32-MCP/jest.config.js`

Key configurations:

- ESM preset for modern ES modules
- TypeScript transformation via ts-jest
- Module name mapping for `.js` imports
- Ignore patterns for `node_modules` and `dist`
- Transform ignore patterns for specific packages

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test File

```bash
npx jest src/services/x32-connection.test.ts
```

### With Coverage

```bash
npm test -- --coverage
```

### Watch Mode

```bash
npx jest --watch
```

### Test Pattern Matching

```bash
npx jest -t "channel_set_volume"
```

## Benefits

### 1. No Hardware Required

- Tests run without needing an actual X32/M32 mixer
- No network configuration needed
- Works in CI/CD environments

### 2. Fast Execution

- All operations are in-memory
- Simulated delays are minimal (5-10ms)
- Complete test suite runs in ~3 seconds

### 3. Reliable & Deterministic

- No network issues or timeouts
- Consistent behavior across environments
- Predictable state for every test

### 4. Easy Debugging

- Inspect mock state with `getMockParameters()`
- Set custom parameter values with `setMockParameter()`
- Clear error messages for validation failures

### 5. Test Isolation

- Each test gets a fresh connection instance
- `reset()` ensures clean state between tests
- No interference between test cases

## Future Enhancements

### Planned Improvements

1. **Extended Mock Features**
    - Simulate connection failures
    - Add configurable delays
    - Support for subscription/meter data

2. **Additional Test Coverage**
    - Bus operations
    - Effects processing
    - Scene management
    - Main output control

3. **Integration Testing**
    - Full MCP server tests using mock
    - Tool registration verification
    - End-to-end workflow tests

4. **Performance Testing**
    - Concurrent operation handling
    - Parameter update throttling
    - Memory usage under load

## Troubleshooting

### Common Issues

**Issue**: "Already connected to X32/M32" error **Solution**: Ensure `await connection.disconnect()` in `afterEach`

**Issue**: Tests timing out **Solution**: Verify connection is established in `beforeEach`

**Issue**: Parameter not found errors **Solution**: Check OSC address format (`/ch/01/...` not `/ch/1/...`)

**Issue**: Jest haste-map warnings about duplicates **Solution**: Jest config includes `modulePathIgnorePatterns: ['<rootDir>/dist/']`

## Best Practices

1. **Always use `beforeEach` and `afterEach`**
    - Initialize fresh mock in `beforeEach`
    - Disconnect and reset in `afterEach`

2. **Test both success and failure cases**
    - Verify valid operations work
    - Ensure invalid operations throw appropriate errors

3. **Use descriptive test names**
    - Describe the behavior being tested
    - Include context (e.g., "should throw error when disconnected")

4. **Group related tests**
    - Use `describe` blocks for logical grouping
    - Keep test organization aligned with features

5. **Verify async behavior**
    - Use `async/await` consistently
    - Test that operations are actually asynchronous

## Migration from Real Hardware Tests

If you have existing tests that use real hardware:

1. Replace `X32Connection` import with `MockX32Connection`
2. Remove any hardware-specific connection configuration
3. Add `connection.reset()` to `afterEach` hooks
4. Adjust timing expectations (mock is faster)
5. Update assertions if needed (mock returns exact values set)

## Documentation

- Mock implementation: `/Users/beomsu/Documents/GitHub/X32-MCP/src/services/__mocks__/README.md`
- This document: `/Users/beomsu/Documents/GitHub/X32-MCP/TEST_INFRASTRUCTURE.md`
- Project guidelines: `/Users/beomsu/Documents/GitHub/X32-MCP/CLAUDE.md`

---

**Last Updated**: 2025-11-17 **Test Framework**: Jest 29.7.0 **TypeScript**: 5.5.4 **Node.js**: >= 18
