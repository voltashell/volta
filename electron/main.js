const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let monitorServerProc;
let monitorUiProc;

const rootDir = path.join(__dirname, '..');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
    },
  });

  win.loadURL('http://localhost:3000');

  win.on('closed', () => {
    if (monitorServerProc) monitorServerProc.kill();
    if (monitorUiProc) monitorUiProc.kill();
  });
}

function startMonitor() {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  monitorServerProc = spawn(npmCmd, ['run', 'flock:monitor:server'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  monitorUiProc = spawn(npmCmd, ['run', 'flock:monitor:dev'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
}

app.whenReady().then(() => {
  startMonitor();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (monitorServerProc) monitorServerProc.kill();
  if (monitorUiProc) monitorUiProc.kill();
});
