/**
 * Comprehensive tests for main/index.ts
 * Testing the Electron main process entry point
 */

import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { ClaudeInstanceManager } from '../claudeManager';
import { setupDatabase } from '../database';
import { setupIPC } from '../ipc';

// Mock all dependencies
jest.mock('electron', () => ({
  app: {
    whenReady: jest.fn(() => Promise.resolve()),
    quit: jest.fn(),
    getPath: jest.fn(() => '/tmp/mythal-test'),
    on: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
      setWindowOpenHandler: jest.fn()
    }
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  shell: {
    openExternal: jest.fn()
  }
}));

jest.mock('../claudeManager');
jest.mock('../database');
jest.mock('../ipc');
jest.mock('path');

describe('Main Process Index Tests', () => {
  let mockApp: any;
  let mockBrowserWindow: any;
  let MockClaudeInstanceManager: jest.MockedClass<typeof ClaudeInstanceManager>;
  let mockSetupDatabase: jest.MockedFunction<typeof setupDatabase>;
  let mockSetupIPC: jest.MockedFunction<typeof setupIPC>;
  let originalEnv: string | undefined;
  let originalConsoleError: typeof console.error;
  let originalProcessOn: typeof process.on;

  beforeAll(() => {
    originalEnv = process.env.NODE_ENV;
    originalConsoleError = console.error;
    originalProcessOn = process.on;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    console.error = originalConsoleError;
    process.on = originalProcessOn;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset mocks
    mockApp = require('electron').app;
    mockBrowserWindow = require('electron').BrowserWindow;
    MockClaudeInstanceManager = require('../claudeManager').ClaudeInstanceManager as jest.MockedClass<typeof ClaudeInstanceManager>;
    mockSetupDatabase = require('../database').setupDatabase as jest.MockedFunction<typeof setupDatabase>;
    mockSetupIPC = require('../ipc').setupIPC as jest.MockedFunction<typeof setupIPC>;

    // Mock console.error
    console.error = jest.fn();

    // Mock process.on
    process.on = jest.fn();

    // Mock path.join
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));

    // Setup default mocks
    mockSetupDatabase.mockResolvedValue(undefined);
    MockClaudeInstanceManager.prototype.initialize = jest.fn().mockResolvedValue(undefined);
    MockClaudeInstanceManager.prototype.shutdown = jest.fn();
    mockSetupIPC.mockImplementation(() => {});

    // Mock BrowserWindow static methods
    mockBrowserWindow.getAllWindows = jest.fn(() => []);

    // Reset environment
    delete process.env.NODE_ENV;
  });

  describe('Window Creation', () => {
    it('should create window with correct configuration', async () => {
      // Import after mocks are set up
      require('../index');

      // Trigger app ready
      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      expect(mockBrowserWindow).toHaveBeenCalledWith({
        width: 1400,
        height: 900,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: '__dirname/preload.js'
        },
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#1e1e1e'
      });
    });

    it('should load development URL in dev mode', async () => {
      process.env.NODE_ENV = 'development';
      
      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      const windowInstance = mockBrowserWindow.mock.instances[0];
      expect(windowInstance.loadURL).toHaveBeenCalledWith('http://localhost:3000');
      expect(windowInstance.webContents.openDevTools).toHaveBeenCalled();
    });

    it('should load file in production mode', async () => {
      process.env.NODE_ENV = 'production';
      
      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      const windowInstance = mockBrowserWindow.mock.instances[0];
      expect(windowInstance.loadFile).toHaveBeenCalledWith('__dirname/../renderer/index.html');
      expect(windowInstance.webContents.openDevTools).not.toHaveBeenCalled();
    });

    it('should set up window event handlers', async () => {
      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      const windowInstance = mockBrowserWindow.mock.instances[0];
      expect(windowInstance.on).toHaveBeenCalledWith('closed', expect.any(Function));
      expect(windowInstance.webContents.setWindowOpenHandler).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle window closed event', async () => {
      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      const windowInstance = mockBrowserWindow.mock.instances[0];
      const closedHandler = windowInstance.on.mock.calls.find(call => call[0] === 'closed')[1];
      
      // Simulate window closed
      closedHandler();

      // Window reference should be cleared (we can't directly test this, but it shouldn't crash)
      expect(closedHandler).toBeDefined();
    });

    it('should handle external links with shell.openExternal', async () => {
      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      const windowInstance = mockBrowserWindow.mock.instances[0];
      const windowOpenHandler = windowInstance.webContents.setWindowOpenHandler.mock.calls[0][0];
      
      const result = windowOpenHandler({ url: 'https://example.com' });
      
      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
      expect(result).toEqual({ action: 'deny' });
    });
  });

  describe('App Initialization', () => {
    it('should initialize database, claude manager, and IPC', async () => {
      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      expect(mockSetupDatabase).toHaveBeenCalled();
      expect(MockClaudeInstanceManager).toHaveBeenCalled();
      expect(MockClaudeInstanceManager.prototype.initialize).toHaveBeenCalled();
      expect(mockSetupIPC).toHaveBeenCalledWith(expect.any(MockClaudeInstanceManager));
    });

    it('should quit app on initialization failure', async () => {
      const error = new Error('Database setup failed');
      mockSetupDatabase.mockRejectedValue(error);

      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      expect(console.error).toHaveBeenCalledWith('Failed to initialize:', error);
      expect(mockApp.quit).toHaveBeenCalled();
    });

    it('should quit app on ClaudeInstanceManager initialization failure', async () => {
      const error = new Error('Claude manager init failed');
      MockClaudeInstanceManager.prototype.initialize.mockRejectedValue(error);

      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      expect(console.error).toHaveBeenCalledWith('Failed to initialize:', error);
      expect(mockApp.quit).toHaveBeenCalled();
    });
  });

  describe('App Event Handlers', () => {
    it('should set up activate event handler', async () => {
      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      // Check that app.on was called with 'activate'
      const activateCall = mockApp.on.mock.calls.find(call => call[0] === 'activate');
      expect(activateCall).toBeDefined();
    });

    it('should create new window on activate when no windows exist', async () => {
      mockBrowserWindow.getAllWindows.mockReturnValue([]);

      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      // Get the activate handler
      const activateHandler = mockApp.on.mock.calls.find(call => call[0] === 'activate')[1];
      
      // Clear previous BrowserWindow calls
      mockBrowserWindow.mockClear();

      // Trigger activate
      activateHandler();

      expect(mockBrowserWindow).toHaveBeenCalledTimes(1);
    });

    it('should not create window on activate when windows exist', async () => {
      mockBrowserWindow.getAllWindows.mockReturnValue([{}]); // Mock existing window

      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      // Get the activate handler
      const activateHandler = mockApp.on.mock.calls.find(call => call[0] === 'activate')[1];
      
      // Clear previous BrowserWindow calls
      mockBrowserWindow.mockClear();

      // Trigger activate
      activateHandler();

      expect(mockBrowserWindow).toHaveBeenCalledTimes(0);
    });

    it('should set up window-all-closed event handler', () => {
      require('../index');

      // Check that app.on was called with 'window-all-closed'
      const windowAllClosedCall = mockApp.on.mock.calls.find(call => call[0] === 'window-all-closed');
      expect(windowAllClosedCall).toBeDefined();
    });

    it('should quit app on window-all-closed for non-darwin platforms', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });

      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      // Get the window-all-closed handler
      const windowAllClosedHandler = mockApp.on.mock.calls.find(call => call[0] === 'window-all-closed')[1];
      
      // Trigger window-all-closed
      windowAllClosedHandler();

      expect(MockClaudeInstanceManager.prototype.shutdown).toHaveBeenCalled();
      expect(mockApp.quit).toHaveBeenCalled();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should not quit app on window-all-closed for darwin platform', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin', writable: true });

      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      // Get the window-all-closed handler
      const windowAllClosedHandler = mockApp.on.mock.calls.find(call => call[0] === 'window-all-closed')[1];
      
      // Clear previous quit calls
      mockApp.quit.mockClear();
      
      // Trigger window-all-closed
      windowAllClosedHandler();

      expect(mockApp.quit).not.toHaveBeenCalled();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should set up before-quit event handler', () => {
      require('../index');

      // Check that app.on was called with 'before-quit'
      const beforeQuitCall = mockApp.on.mock.calls.find(call => call[0] === 'before-quit');
      expect(beforeQuitCall).toBeDefined();
    });

    it('should shutdown claude manager on before-quit', async () => {
      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      // Get the before-quit handler
      const beforeQuitHandler = mockApp.on.mock.calls.find(call => call[0] === 'before-quit')[1];
      
      // Trigger before-quit
      beforeQuitHandler();

      expect(MockClaudeInstanceManager.prototype.shutdown).toHaveBeenCalled();
    });
  });

  describe('Process Event Handlers', () => {
    it('should set up uncaughtException handler', () => {
      require('../index');

      // Check that process.on was called with 'uncaughtException'
      const uncaughtExceptionCall = (process.on as jest.Mock).mock.calls.find(call => call[0] === 'uncaughtException');
      expect(uncaughtExceptionCall).toBeDefined();
    });

    it('should log uncaught exceptions', () => {
      require('../index');

      // Get the uncaughtException handler
      const uncaughtExceptionHandler = (process.on as jest.Mock).mock.calls.find(call => call[0] === 'uncaughtException')[1];
      
      const error = new Error('Test uncaught exception');
      uncaughtExceptionHandler(error);

      expect(console.error).toHaveBeenCalledWith('Uncaught exception:', error);
    });

    it('should set up unhandledRejection handler', () => {
      require('../index');

      // Check that process.on was called with 'unhandledRejection'
      const unhandledRejectionCall = (process.on as jest.Mock).mock.calls.find(call => call[0] === 'unhandledRejection');
      expect(unhandledRejectionCall).toBeDefined();
    });

    it('should log unhandled rejections', () => {
      require('../index');

      // Get the unhandledRejection handler
      const unhandledRejectionHandler = (process.on as jest.Mock).mock.calls.find(call => call[0] === 'unhandledRejection')[1];
      
      const reason = 'Test unhandled rejection';
      const promise = Promise.resolve();
      unhandledRejectionHandler(reason, promise);

      expect(console.error).toHaveBeenCalledWith('Unhandled rejection at:', promise, 'reason:', reason);
    });
  });

  describe('Window Management', () => {
    it('should handle multiple window creation attempts', async () => {
      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      // First window created during initialization
      expect(mockBrowserWindow).toHaveBeenCalledTimes(1);

      // Simulate activate event when no windows exist
      mockBrowserWindow.getAllWindows.mockReturnValue([]);
      const activateHandler = mockApp.on.mock.calls.find(call => call[0] === 'activate')[1];
      activateHandler();

      // Should create another window
      expect(mockBrowserWindow).toHaveBeenCalledTimes(2);
    });

    it('should handle window closed and reopened scenario', async () => {
      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      const windowInstance = mockBrowserWindow.mock.instances[0];
      const closedHandler = windowInstance.on.mock.calls.find(call => call[0] === 'closed')[1];

      // Close the window
      closedHandler();

      // Simulate activate with no windows
      mockBrowserWindow.getAllWindows.mockReturnValue([]);
      const activateHandler = mockApp.on.mock.calls.find(call => call[0] === 'activate')[1];
      activateHandler();

      // Should create a new window
      expect(mockBrowserWindow).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle database setup failure gracefully', async () => {
      const error = new Error('Database connection failed');
      mockSetupDatabase.mockRejectedValue(error);

      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      expect(console.error).toHaveBeenCalledWith('Failed to initialize:', error);
      expect(mockApp.quit).toHaveBeenCalled();
      
      // Should not proceed with claude manager setup
      expect(MockClaudeInstanceManager).not.toHaveBeenCalled();
      expect(mockSetupIPC).not.toHaveBeenCalled();
    });

    it('should handle claude manager creation failure', async () => {
      const error = new Error('Claude manager creation failed');
      MockClaudeInstanceManager.mockImplementation(() => {
        throw error;
      });

      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      expect(console.error).toHaveBeenCalledWith('Failed to initialize:', error);
      expect(mockApp.quit).toHaveBeenCalled();
    });

    it('should handle IPC setup failure', async () => {
      const error = new Error('IPC setup failed');
      mockSetupIPC.mockImplementation(() => {
        throw error;
      });

      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      expect(console.error).toHaveBeenCalledWith('Failed to initialize:', error);
      expect(mockApp.quit).toHaveBeenCalled();
    });
  });

  describe('Claude Manager Integration', () => {
    it('should properly initialize claude manager', async () => {
      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      expect(MockClaudeInstanceManager).toHaveBeenCalledTimes(1);
      expect(MockClaudeInstanceManager.prototype.initialize).toHaveBeenCalledTimes(1);
    });

    it('should pass claude manager to IPC setup', async () => {
      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      const claudeManagerInstance = MockClaudeInstanceManager.mock.instances[0];
      expect(mockSetupIPC).toHaveBeenCalledWith(claudeManagerInstance);
    });

    it('should shutdown claude manager on app quit (non-darwin)', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });

      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      const claudeManagerInstance = MockClaudeInstanceManager.mock.instances[0];
      
      // Trigger window-all-closed
      const windowAllClosedHandler = mockApp.on.mock.calls.find(call => call[0] === 'window-all-closed')[1];
      windowAllClosedHandler();

      expect(claudeManagerInstance.shutdown).toHaveBeenCalledTimes(1);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should shutdown claude manager on before-quit', async () => {
      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      const claudeManagerInstance = MockClaudeInstanceManager.mock.instances[0];
      
      // Trigger before-quit
      const beforeQuitHandler = mockApp.on.mock.calls.find(call => call[0] === 'before-quit')[1];
      beforeQuitHandler();

      expect(claudeManagerInstance.shutdown).toHaveBeenCalledTimes(1);
    });

    it('should handle claude manager shutdown gracefully when null', async () => {
      // Mock initialization failure to keep claudeManager null
      MockClaudeInstanceManager.prototype.initialize.mockRejectedValue(new Error('Init failed'));

      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      // Should have quit due to init failure
      expect(mockApp.quit).toHaveBeenCalled();

      // Trying to access shutdown on null manager should not crash
      const beforeQuitHandler = mockApp.on.mock.calls.find(call => call[0] === 'before-quit')[1];
      expect(() => beforeQuitHandler()).not.toThrow();
    });
  });

  describe('Development vs Production Behavior', () => {
    it('should behave correctly when NODE_ENV is undefined', async () => {
      delete process.env.NODE_ENV;
      
      require('../index');

      const readyCallback = mockApp.whenReady.mock.calls[0][0];
      await readyCallback();

      const windowInstance = mockBrowserWindow.mock.instances[0];
      // Should default to production behavior
      expect(windowInstance.loadFile).toHaveBeenCalled();
      expect(windowInstance.webContents.openDevTools).not.toHaveBeenCalled();
    });

    it('should handle various NODE_ENV values', async () => {
      const testCases = [
        { env: 'development', expectDevTools: true, expectLoadURL: true },
        { env: 'dev', expectDevTools: false, expectLoadURL: false },
        { env: 'production', expectDevTools: false, expectLoadURL: false },
        { env: 'test', expectDevTools: false, expectLoadURL: false },
        { env: '', expectDevTools: false, expectLoadURL: false },
      ];

      for (const testCase of testCases) {
        jest.resetModules();
        mockBrowserWindow.mockClear();

        process.env.NODE_ENV = testCase.env;
        
        require('../index');

        const readyCallback = mockApp.whenReady.mock.calls[mockApp.whenReady.mock.calls.length - 1][0];
        await readyCallback();

        const windowInstance = mockBrowserWindow.mock.instances[mockBrowserWindow.mock.instances.length - 1];
        
        if (testCase.expectDevTools) {
          expect(windowInstance.webContents.openDevTools).toHaveBeenCalled();
        } else {
          expect(windowInstance.webContents.openDevTools).not.toHaveBeenCalled();
        }

        if (testCase.expectLoadURL) {
          expect(windowInstance.loadURL).toHaveBeenCalledWith('http://localhost:3000');
        } else {
          expect(windowInstance.loadFile).toHaveBeenCalled();
        }
      }
    });
  });
});