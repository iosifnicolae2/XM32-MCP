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

        // Test 4: Disconnect
        console.log('Test 4: Disconnecting...');
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
