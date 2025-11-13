# MCP TypeScript SDK Guide

## Build & Test Commands

```sh
npm run build        # Build ESM and CJS versions
npm run lint         # Run ESLint
npm test             # Run all tests
npx jest path/to/file.test.ts  # Run specific test file
npx jest -t "test name"        # Run tests matching pattern
```

## Code Style Guidelines

- **TypeScript**: Strict type checking, ES modules, explicit return types
- **Naming**: PascalCase for classes/types, camelCase for functions/variables
- **Files**: Lowercase with hyphens, test files with `.test.ts` suffix
- **Imports**: ES module style, include `.js` extension, group imports logically
- **Error Handling**: Use TypeScript's strict mode, explicit error checking in tests
- **Formatting**: 2-space indentation, semicolons required, single quotes preferred
- **Testing**: Co-locate tests with source files, use descriptive test names
- **Comments**: JSDoc for public APIs, inline comments for complex logic

## Project description

```
OSC UDP Transport (raw)
        ↓
Address Pattern DSL (/ch/01/mix/fader)
        ↓
MCP Tool Layer (task-based)
```

## MCP Tool Design Principles

### API-based Tool Organization

Tools should be organized by **OSC Address Pattern API endpoints**, not by operation type (get/set):

- **AVOID**: Separate `x32_get_parameter` and `x32_set_parameter` tools
- **PREFER**: Single tool per API domain with action parameter (e.g., `x32_channel` with `action: 'get' | 'set'`)

### Rationale

1. **Protocol Alignment**: X32 OSC protocol uses the same address pattern for both read and write operations:
    - Read: `/ch/01/mix/fader` (no parameters)
    - Write: `/ch/01/mix/fader ,f 0.75` (with parameters)
2. **Semantic Coherence**: Each OSC address pattern represents a single API endpoint that naturally supports both operations

3. **Progressive Implementation**: Follow the X32 protocol documentation structure:
    - Start with core APIs: `/info`, `/status`, `/xremote`
    - Add domain-specific APIs: `/ch/*`, `/bus/*`, `/main/*`, `/fx/*`
    - Each tool maps to a logical API domain, not CRUD operations

### Tool Structure Pattern

```typescript
server.tool(
    'x32_<domain>',  // Domain-based naming (e.g., x32_channel, x32_bus, x32_fx)
    'Description of the API domain',
    {
        // Domain-specific parameters
        action: z.enum(['get', 'set']),
        // Other domain parameters
        value: z.union([...]).optional()  // Required only for 'set' action
    },
    async ({ action, ...params }) => {
        if (action === 'get') {
            // Read operation
        } else {
            // Write operation
        }
    }
);
```

### Implementation Priority

Follow the X32 protocol documentation order:

1. **Connection & Info**: `/info`, `/status`, `/xremote`
2. **Core Parameters**: `/ch/*` (channels), `/bus/*` (buses), `/main/*` (main outputs)
3. **Processing**: `/eq/*`, `/dyn/*`, `/gate/*`, `/comp/*`
4. **Effects & Routing**: `/fx/*`, `/fxrtn/*`, `/mtx/*`
5. **Advanced**: `/meters/*`, `/node`, `/subscribe`, `/batchsubscribe`

## Project Structure

```
mcp-server-x32/
└── src/
    ├── index.ts        # Entry point for starting the MCP server
    ├── server.ts       # Server bootstrap: loads tools, sets up transport, registers capabilities
    ├── mcp/            # Core MCP protocol layer (server wiring, protocol utilities, session lifecycle)
    ├── tools/          # Task-level tools exposed to LLMs (task abstraction, not raw API calls)
    ├── services/       # Domain logic for X32 control (OSC communication, address patterns, get/set logic)
    ├── types/          # Shared TypeScript types used across MCP, tools, and services
    └── utils/          # Reusable utilities (logging, validation, error helpers, environment helpers)
```

- Tests alongside source files with `.test.ts` suffix
- Node.js >= 18 required
