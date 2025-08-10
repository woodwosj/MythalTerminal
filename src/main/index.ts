import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { ClaudeInstanceManager } from './claudeManager';
import { setupDatabase } from './database';
import { setupIPC } from './ipc';

let mainWindow: BrowserWindow | null = null;
let claudeManager: ClaudeInstanceManager | null = null;

const isDev = process.env.NODE_ENV === 'development' || 
              process.argv.includes('--dev') ||
              process.argv[2] === '--dev';

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e1e',
  });

  if (isDev) {
    await mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

async function initialize() {
  try {
    await setupDatabase();
    claudeManager = new ClaudeInstanceManager();
    await claudeManager.initialize();
    setupIPC(claudeManager);
  } catch (error) {
    console.error('Failed to initialize:', error);
    app.quit();
  }
}

app.whenReady().then(async () => {
  await initialize();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    claudeManager?.shutdown();
    app.quit();
  }
});

app.on('before-quit', () => {
  claudeManager?.shutdown();
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});