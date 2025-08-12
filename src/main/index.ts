import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { ClaudeInstanceManager } from './claudeManager';
import { SettingsManager } from './settingsManager';
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
    
    // Initialize settings manager with error handling
    let settingsManager: SettingsManager | null = null;
    let apiKey: string | null = null;
    
    try {
      settingsManager = new SettingsManager();
      apiKey = settingsManager.getApiKey();
      console.log('Settings manager initialized successfully');
    } catch (settingsError: any) {
      console.error('Error initializing settings manager:', settingsError);
      console.warn('Continuing with default settings and no API key');
      // Continue without settings - app should still work
    }
    
    // Initialize Claude manager
    claudeManager = new ClaudeInstanceManager();
    await claudeManager.initialize();
    
    // Set API key if available
    if (apiKey) {
      claudeManager.setApiKey(apiKey);
      console.log('API key loaded from settings and applied to Claude manager');
    } else {
      console.warn('No API key found in settings. Users will need to configure it via Settings.');
    }
    
    setupIPC(claudeManager);
  } catch (error) {
    console.error('Failed to initialize:', error);
    // Security fix: Use IPC instead of executeJavaScript to prevent XSS
    if (mainWindow) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Send error safely through IPC
      mainWindow.webContents.send('app:initialization-error', {
        message: errorMessage,
        timestamp: Date.now()
      });
    }
    // Still allow the app to run, but with limited functionality
    // app.quit(); // Commented out to allow app to start even with errors
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