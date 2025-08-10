// Import the functions we want to test
const mockDatabase = {
  pragma: jest.fn(),
  exec: jest.fn(),
  prepare: jest.fn(() => ({
    run: jest.fn(() => ({ lastInsertRowid: 1 })),
    get: jest.fn(),
    all: jest.fn(() => [])
  })),
  transaction: jest.fn((fn) => fn)
};

// Mock better-sqlite3 before importing database module
jest.mock('better-sqlite3', () => {
  return jest.fn(() => mockDatabase);
});

// Mock electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/test-data')
  }
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(() => Promise.resolve())
}));

// Now import the database module after mocks are set up
import * as db from '../database';

describe('Database', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setupDatabase', () => {
    it('should create database with correct settings', async () => {
      await db.setupDatabase();
      
      expect(mockDatabase.pragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(mockDatabase.pragma).toHaveBeenCalledWith('foreign_keys = ON');
    });

    it('should create all required tables', async () => {
      await db.setupDatabase();
      
      const execCall = mockDatabase.exec.mock.calls[0][0];
      expect(execCall).toContain('CREATE TABLE IF NOT EXISTS context_layers');
      expect(execCall).toContain('CREATE TABLE IF NOT EXISTS chat_archives');
      expect(execCall).toContain('CREATE TABLE IF NOT EXISTS clipboard_items');
      expect(execCall).toContain('CREATE TABLE IF NOT EXISTS resumework_snapshots');
    });
  });

  describe('Context Layer Operations', () => {
    beforeEach(async () => {
      await db.setupDatabase();
    });

    it('should save context layer', async () => {
      const mockRun = jest.fn(() => ({ lastInsertRowid: 42 }));
      mockDatabase.prepare.mockReturnValue({ run: mockRun });

      const layer = {
        project_path: '/test/project',
        layer_type: 'active',
        content: 'test content',
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user'
      };

      const id = await db.saveContextLayer(layer);
      
      expect(id).toBe(42);
      expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO context_layers'));
      expect(mockRun).toHaveBeenCalledWith(
        '/test/project',
        'active', 
        'test content',
        100,
        null,
        0,
        0,
        'user'
      );
    });

    it('should get context layers', async () => {
      const mockLayers = [
        { id: 1, content: 'layer1', tokens: 100 },
        { id: 2, content: 'layer2', tokens: 200 }
      ];
      
      mockDatabase.prepare.mockReturnValue({ 
        all: jest.fn(() => mockLayers) 
      });

      const layers = await db.getContextLayers('/test/project');
      
      expect(layers).toEqual(mockLayers);
      expect(mockDatabase.prepare).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT \* FROM context_layers.*WHERE project_path = \?/s)
      );
    });

    it('should update context layer', async () => {
      const mockRun = jest.fn();
      mockDatabase.prepare.mockReturnValue({ run: mockRun });

      await db.updateContextLayer(1, {
        content: 'updated content',
        tokens: 150
      });

      expect(mockDatabase.prepare).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE context_layers.*SET/s)
      );
      expect(mockRun).toHaveBeenCalled();
    });

    it('should delete context layer', async () => {
      const mockRun = jest.fn();
      mockDatabase.prepare.mockReturnValue({ run: mockRun });

      await db.deleteContextLayer(1);

      expect(mockDatabase.prepare).toHaveBeenCalledWith(
        'DELETE FROM context_layers WHERE id = ?'
      );
      expect(mockRun).toHaveBeenCalledWith(1);
    });
  });

  describe('Archive Operations', () => {
    beforeEach(async () => {
      await db.setupDatabase();
    });

    it('should archive chat', async () => {
      const mockRun = jest.fn();
      mockDatabase.prepare.mockReturnValue({ run: mockRun });

      await db.archiveChat('/test/project', 'conversation text', 500, { user: 'test' });

      expect(mockDatabase.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chat_archives')
      );
      expect(mockRun).toHaveBeenCalledWith(
        '/test/project',
        'conversation text',
        500,
        JSON.stringify({ user: 'test' })
      );
    });
  });

  describe('Clipboard Operations', () => {
    beforeEach(async () => {
      await db.setupDatabase();
    });

    it('should save clipboard item', async () => {
      const mockRun = jest.fn();
      mockDatabase.prepare.mockReturnValue({ run: mockRun });

      await db.saveClipboardItem('code snippet', 'javascript', ['test', 'example']);

      expect(mockDatabase.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO clipboard_items')
      );
      expect(mockRun).toHaveBeenCalledWith(
        'code snippet',
        'javascript',
        JSON.stringify(['test', 'example'])
      );
    });

    it('should get clipboard items', async () => {
      const mockItems = [
        { id: 1, content: 'item1' },
        { id: 2, content: 'item2' }
      ];
      
      mockDatabase.prepare.mockReturnValue({ 
        all: jest.fn(() => mockItems) 
      });

      const items = await db.getClipboardItems();
      
      expect(items).toEqual(mockItems);
    });
  });
});