#!/usr/bin/env node

/**
 * Kill processes on specific ports before starting the app
 * Cross-platform solution using Node.js
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PORTS_TO_KILL = [3001, 5173, 5174];

async function killPort(port) {
  const isWindows = process.platform === 'win32';

  try {
    if (isWindows) {
      // Windows: Find PID and kill it
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.split('\n').filter(line => line.includes('LISTENING'));

      if (lines.length > 0) {
        const pidMatch = lines[0].trim().split(/\s+/).pop();
        if (pidMatch) {
          await execAsync(`taskkill /PID ${pidMatch} /F`);
          console.log(`✅ Killed process on port ${port} (PID: ${pidMatch})`);
          return true;
        }
      }
    } else {
      // Unix/Linux/Mac: Use lsof
      const { stdout } = await execAsync(`lsof -ti:${port}`);
      const pids = stdout.trim().split('\n').filter(p => p);

      if (pids.length > 0) {
        await execAsync(`kill -9 ${pids.join(' ')}`);
        console.log(`✅ Killed process(es) on port ${port}`);
        return true;
      }
    }

    console.log(`ℹ️  Port ${port} is free`);
    return false;
  } catch (error) {
    // Port not in use or error finding process
    console.log(`ℹ️  Port ${port} is free (or error checking)`);
    return false;
  }
}

async function main() {
  console.log('🔍 Checking for processes on ports:', PORTS_TO_KILL.join(', '));
  console.log('');

  for (const port of PORTS_TO_KILL) {
    await killPort(port);
  }

  console.log('');
  console.log('✨ Ports cleared! Starting application...');
  console.log('');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
