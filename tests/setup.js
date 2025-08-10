// Jest setup file
require('@testing-library/jest-dom');

// Mock window.mythalAPI for renderer tests
global.window = global.window || {};
global.window.mythalAPI = {
  terminal: {
    create: jest.fn(() => Promise.resolve({ success: true })),
    write: jest.fn(() => Promise.resolve({ success: true })),
    resize: jest.fn(() => Promise.resolve({ success: true })),
    destroy: jest.fn(() => Promise.resolve({ success: true })),
    onOutput: jest.fn(() => jest.fn()),
    onExit: jest.fn(() => jest.fn())
  },
  claude: {
    send: jest.fn(() => Promise.resolve({ success: true })),
    status: jest.fn(() => Promise.resolve({ main: 'idle', contextManager: 'idle' })),
    start: jest.fn(() => Promise.resolve({ success: true })),
    startAll: jest.fn(() => Promise.resolve({ success: true })),
    onOutput: jest.fn(() => jest.fn()),
    onError: jest.fn(() => jest.fn()),
    onStarted: jest.fn(() => jest.fn()),
    onFailed: jest.fn(() => jest.fn())
  },
  context: {
    save: jest.fn(() => Promise.resolve({ success: true, id: 1 })),
    get: jest.fn(() => Promise.resolve({ success: true, layers: [] })),
    update: jest.fn(() => Promise.resolve({ success: true })),
    delete: jest.fn(() => Promise.resolve({ success: true }))
  },
  chat: {
    archive: jest.fn(() => Promise.resolve({ success: true }))
  },
  clipboard: {
    save: jest.fn(() => Promise.resolve({ success: true })),
    get: jest.fn(() => Promise.resolve({ success: true, items: [] }))
  },
  resumework: {
    save: jest.fn(() => Promise.resolve({ success: true })),
    get: jest.fn(() => Promise.resolve({ success: true, snapshot: null }))
  },
  tokens: {
    record: jest.fn(() => Promise.resolve({ success: true }))
  }
};

// Mock process.cwd for tests
process.cwd = jest.fn(() => '/test/project');

// Suppress console errors in tests unless explicitly needed
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});