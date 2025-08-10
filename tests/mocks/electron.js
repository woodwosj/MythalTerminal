const { EventEmitter } = require('events');
const path = require('path');

class MockBrowserWindow extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.webContents = {
      send: jest.fn(),
      openDevTools: jest.fn(),
      setWindowOpenHandler: jest.fn()
    };
  }
  
  loadURL = jest.fn();
  loadFile = jest.fn();
  on = jest.fn();
  close = jest.fn();
  
  static getAllWindows = jest.fn(() => []);
}

class MockIpcMain extends EventEmitter {
  handle = jest.fn((channel, handler) => {
    this.handlers = this.handlers || {};
    this.handlers[channel] = handler;
  });
  
  invoke = jest.fn(async (channel, ...args) => {
    if (this.handlers && this.handlers[channel]) {
      return this.handlers[channel]({}, ...args);
    }
  });
}

class MockIpcRenderer extends EventEmitter {
  invoke = jest.fn();
  on = jest.fn();
  removeListener = jest.fn();
}

const mockApp = {
  whenReady: jest.fn(() => Promise.resolve()),
  quit: jest.fn(),
  getPath: jest.fn((type) => {
    if (type === 'userData') return '/tmp/mythal-test';
    return '/tmp';
  }),
  on: jest.fn()
};

// Mock fs/promises for tests
jest.mock('fs/promises', () => ({
  readFile: jest.fn(() => Promise.reject(new Error('ENOENT'))),
  readdir: jest.fn(() => Promise.resolve([])),
  stat: jest.fn(() => Promise.resolve({ isDirectory: () => true })),
  access: jest.fn(() => Promise.reject(new Error('ENOENT'))),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
  unlink: jest.fn(() => Promise.resolve())
}));

module.exports = {
  app: mockApp,
  BrowserWindow: MockBrowserWindow,
  ipcMain: new MockIpcMain(),
  ipcRenderer: new MockIpcRenderer(),
  shell: {
    openExternal: jest.fn()
  },
  contextBridge: {
    exposeInMainWorld: jest.fn()
  }
};