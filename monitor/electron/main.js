const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { app, BrowserWindow } = require('electron');

const DEFAULT_PORT = 3000;
const MONITOR_PORT = Number(process.env.MONITOR_PORT) || DEFAULT_PORT;
const MONITOR_HOST = process.env.MONITOR_HOST || '127.0.0.1';
const MONITOR_URL = process.env.MONITOR_URL || `http://${MONITOR_HOST}:${MONITOR_PORT}`;
const isProduction = process.env.NODE_ENV === 'production';
const monitorRoot = path.resolve(__dirname, '..');
const disableLocalServer = process.env.AI_FLOCK_ELECTRON_DISABLE_LOCAL === '1';

let serverStarted = false;
let devServerProcess = null;

function isServerReachable(url) {
  return new Promise((resolve) => {
    try {
      const request = http.get(url, (response) => {
        response.resume();
        resolve(response.statusCode === 200 || response.statusCode === 302);
      });

      request.on('error', () => resolve(false));
      request.setTimeout(1500, () => {
        request.destroy();
        resolve(false);
      });
    } catch (error) {
      resolve(false);
    }
  });
}

async function waitForServer(url, attempts = 40, delayMs = 500) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const reachable = await isServerReachable(url);
    if (reachable) {
      serverStarted = true;
      return true;
    }

    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return false;
}

async function ensureMonitorServer() {
  if (serverStarted) {
    return;
  }

  const alreadyRunning = await isServerReachable(MONITOR_URL);
  if (alreadyRunning) {
    serverStarted = true;
    return;
  }

  if (disableLocalServer) {
    throw new Error(`Monitor server is not reachable at ${MONITOR_URL} and local startup is disabled`);
  }

  if (isProduction) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      require(path.join(monitorRoot, 'dist', 'server.js'));
    } catch (error) {
      console.error('Failed to start monitor server from dist/server.js:', error);
      throw error;
    }
  } else {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    devServerProcess = spawn(npmCommand, ['run', 'dev'], {
      cwd: monitorRoot,
      env: { ...process.env, PORT: String(MONITOR_PORT) },
      stdio: 'inherit'
    });

    devServerProcess.on('exit', (code, signal) => {
      if (!serverStarted) {
        console.error(`Monitor dev server exited before startup (code ${code}, signal ${signal})`);
      }
    });
  }

  const serverReady = await waitForServer(MONITOR_URL);
  if (!serverReady) {
    throw new Error(`Monitor server did not become ready at ${MONITOR_URL}`);
  }
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Volta',
    backgroundColor: '#111827',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL(MONITOR_URL);

  if (!isProduction) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  return mainWindow;
}

async function setupApplication() {
  try {
    await ensureMonitorServer();
    createMainWindow();
  } catch (error) {
    console.error('Unable to initialise monitor Electron window:', error);
    app.quit();
  }
}

app.whenReady().then(() => {
  app.setName('Volta');
  setupApplication();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await ensureMonitorServer();
    createMainWindow();
  }
});

function teardown() {
  if (devServerProcess && !devServerProcess.killed) {
    devServerProcess.kill('SIGTERM');
  }
}

app.on('before-quit', teardown);
process.on('exit', teardown);
process.on('SIGINT', () => {
  teardown();
  process.exit(0);
});
process.on('SIGTERM', () => {
  teardown();
  process.exit(0);
});
