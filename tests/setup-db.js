const Database = require('better-sqlite3');

// Create in-memory database for tests
let testDb;

global.setupTestDatabase = () => {
  // Use in-memory database for tests
  testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');

  // Initialize schema
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS context_layers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_path TEXT NOT NULL,
      layer_type TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens INTEGER NOT NULL,
      actual_tokens INTEGER,
      is_starred BOOLEAN DEFAULT 0,
      is_immutable BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
      access_count INTEGER DEFAULT 0,
      source TEXT CHECK(source IN ('user', 'ai', 'system'))
    );

    CREATE TABLE IF NOT EXISTS chat_archives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_path TEXT NOT NULL,
      conversation TEXT NOT NULL,
      tokens INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS clipboard_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      category TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used DATETIME,
      use_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS resumework_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_path TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS token_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_path TEXT NOT NULL,
      total_tokens INTEGER NOT NULL,
      active_tokens INTEGER NOT NULL,
      starred_tokens INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return testDb;
};

global.getTestDatabase = () => testDb;

global.cleanupTestDatabase = () => {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
};

// Mock better-sqlite3
jest.mock('better-sqlite3', () => {
  return jest.fn(() => global.getTestDatabase());
});

// Mock electron app for database tests
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/test-data'),
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
    quit: jest.fn()
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  BrowserWindow: jest.fn()
}));