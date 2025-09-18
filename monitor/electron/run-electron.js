const path = require('path');
const { spawn } = require('child_process');

const mode = process.argv[2] || 'dev';
const electronBinary = process.platform === 'win32' ? 'electron.cmd' : 'electron';
const electronEntry = path.join(__dirname, 'main.js');

const env = { ...process.env };

if (mode === 'dev') {
  env.NODE_ENV = env.NODE_ENV || 'development';
} else if (mode === 'compose') {
  env.NODE_ENV = 'production';
  env.MONITOR_URL = env.MONITOR_URL || 'http://localhost:4000';
  env.AI_FLOCK_ELECTRON_DISABLE_LOCAL = '1';
} else if (mode === 'prod') {
  env.NODE_ENV = 'production';
}

const child = spawn(electronBinary, [electronEntry], {
  env,
  stdio: 'inherit'
});

child.on('close', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

child.on('error', (error) => {
  console.error('Failed to launch Electron:', error);
  process.exitCode = 1;
});
