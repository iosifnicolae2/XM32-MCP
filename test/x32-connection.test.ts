#!/usr/bin/env node
/**
 * X32 Connection Test
 * Tests the X32Connection class with a real X32/M32 mixer
 */
import { X32Connection } from '../src/x32-server/x32-connection.js';

async function testConnection() {
    const connection = new X32Connection();

    console.log('=== X32 Connection Test ===\n');

    connection.on('connected', () => {
        console.log('✓ Connected to X32');
    });

    connection.on('disconnected', () => {
        console.log('✓ Disconnected from X32');
    });

    connection.on('error', error => {
        console.error('✗ Connection Error:', error);
    });

    try {
        // Test 1: Connection
        console.log('Test 1: Connecting to 10.69.6.254:10023...');
        await connection.connect({
            host: '10.69.6.254',
            port: 10023
        });
        console.log('✓ Connection successful\n');

        // Test 2: Get Info
        console.log('Test 2: Getting console info...');
        const info = await connection.getInfo();
        console.log('✓ Info received:');
        console.log(`  - Console Model: ${info.consoleModel}`);
        console.log(`  - Console Version: ${info.consoleVersion}`);
        console.log(`  - Server Name: ${info.serverName}`);
        console.log(`  - Server Version: ${info.serverVersion}\n`);

        // Test 3: Get Status
        console.log('Test 3: Getting console status...');
        const status = await connection.getStatus();
        console.log('✓ Status received:');
        console.log(`  - State: ${status.state}`);
        console.log(`  - IP Address: ${status.ipAddress}`);
        console.log(`  - Server Name: ${status.serverName}\n`);

        // Test 4: Get Channel Parameter
        console.log('Test 4: Getting channel 1 fader...');
        const fader = await connection.getChannelParameter<number>(1, 'mix/fader');
        console.log(`✓ Channel 1 fader = ${fader} (${(fader * 100).toFixed(1)}%)\n`);

        // Test 5: Get Channel Name
        console.log('Test 5: Getting channel 1 name...');
        const name = await connection.getChannelParameter<string>(1, 'config/name');
        console.log(`✓ Channel 1 name = "${name}"\n`);

        // Test 6: Set Channel Name
        console.log('Test 6: Setting channel 1 name to "MCP Test"...');
        await connection.setChannelParameter(1, 'config/name', 'MCP Test');
        const newName = await connection.getChannelParameter<string>(1, 'config/name');
        console.log(`✓ Channel 1 name updated to "${newName}"\n`);

        // Test 7: Set Channel Fader
        console.log('Test 7: Setting channel 1 fader to 0.75...');
        await connection.setChannelParameter(1, 'mix/fader', 0.75);
        const newFader = await connection.getChannelParameter<number>(1, 'mix/fader');
        console.log(`✓ Channel 1 fader set to ${newFader} (${(newFader * 100).toFixed(1)}%)\n`);

        // Test 8: Get Parameter by Address
        console.log('Test 8: Getting /ch/01/mix/on...');
        const channelOn = await connection.getParameter<number>('/ch/01/mix/on');
        console.log(`✓ Channel 1 on/off = ${channelOn} (${channelOn === 1 ? 'ON' : 'MUTED'})\n`);

        // Test 9: Restore original name
        console.log('Test 9: Restoring original channel name...');
        await connection.setChannelParameter(1, 'config/name', name);
        console.log(`✓ Channel 1 name restored to "${name}"\n`);

        // Test 10: Disconnect
        console.log('Test 10: Disconnecting...');
        await connection.disconnect();
        console.log('✓ Disconnection successful\n');

        console.log('=== All tests passed! ===');
        process.exit(0);
    } catch (error) {
        console.error('\n✗ Test failed:');
        console.error(error);

        if (connection.connected) {
            await connection.disconnect();
        }

        process.exit(1);
    }
}

testConnection();
