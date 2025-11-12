# X32 MCP Server

Model Context Protocol (MCP) server for controlling Behringer X32/M32 digital mixers via OSC protocol.

## Features

- Connect to X32/M32 mixers over UDP/OSC
- Retrieve console information (`/info`)
- Get current mixer status (`/status`)
- Full OSC protocol support via the `osc` npm package

## Installation

```bash
npm install
```

## Usage

### Start the MCP Server

```bash
npm run x32:server
```

The server runs on stdio transport and provides the following MCP tools:

- `x32_connect` - Connect to X32/M32 mixer
- `x32_get_info` - Get console information (model, version, etc.)
- `x32_get_status` - Get current mixer status

### Testing

Test the X32 connection with a real mixer:

```bash
npm run x32:test
```

Edit `test/x32-connection.test.ts` to configure your mixer's IP address and port.

## Configuration

Default X32/M32 OSC port: **10023**

## Architecture

```
src/x32-server/
├── index.ts              # Main MCP server entry point
├── x32-connection.ts     # X32 UDP/OSC connection manager
├── types.ts              # TypeScript type definitions
└── README.md            # This file

test/
└── x32-connection.test.ts  # Connection tests
```

## Protocol Documentation

For detailed information about the X32/M32 OSC protocol, see:

- `docs/OSC-Protocal.md` - Main protocol overview
- `docs/x32-protocol/` - Detailed protocol specifications

## Development

The X32 connection is built on:

- **osc** npm package for OSC message handling
- **EventEmitter** for connection events
- **MCP SDK** for Model Context Protocol integration

## Example

```typescript
import { X32Connection } from './x32-connection.js';

const connection = new X32Connection();

await connection.connect({
    host: '10.69.6.254',
    port: 10023
});

const info = await connection.getInfo();
console.log('Console Model:', info.consoleModel);

const status = await connection.getStatus();
console.log('Status:', status.state);

await connection.disconnect();
```

## License

MIT
