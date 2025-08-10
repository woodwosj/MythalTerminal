import Database from 'better-sqlite3';
import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import {
  setupDatabase,
  getDatabase,
  saveContextLayer,
  getContextLayers,
  updateContextLayer,
  deleteContextLayer,
  archiveChat,
  saveClipboardItem,
  getClipboardItems,
  saveResumeWorkSnapshot,
  getLatestResumeWork,
  recordTokenUsage,
  ContextLayer
} from '../database';
import { InputValidator } from '../../shared/security';

// Mock dependencies
jest.mock('better-sqlite3');
jest.mock('electron');
jest.mock('fs/promises');
jest.mock('../../shared/security');

describe('Database Comprehensive Tests', () => {
  let mockDatabase: any;
  let mockApp: any;
  let mockFs: any;
  let mockValidator: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Database instance
    mockDatabase = {
      pragma: jest.fn(),
      exec: jest.fn(),
      prepare: jest.fn(),
      close: jest.fn()
    };

    // Mock Database constructor
    (Database as jest.MockedClass<typeof Database>).mockImplementation(() => mockDatabase);

    // Mock app
    mockApp = {
      getPath: jest.fn().mockReturnValue('/test/userData')
    };
    (app as any) = mockApp;

    // Mock fs
    mockFs = fs as jest.Mocked<typeof fs>;
    mockFs.mkdir = jest.fn().mockResolvedValue(undefined);

    // Mock InputValidator
    mockValidator = {
      validatePath: jest.fn().mockReturnValue(true),
      validateFieldName: jest.fn().mockReturnValue(true)
    };
    (InputValidator as any) = mockValidator;

    // Reset module-level database variable
    jest.resetModules();
  });

  describe('Database Setup', () => {
    it('should create database file in correct location', async () => {
      await setupDatabase();

      expect(mockApp.getPath).toHaveBeenCalledWith('userData');
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/userData', { recursive: true });
      expect(Database).toHaveBeenCalledWith(path.join('/test/userData', 'mythalterminal.db'));
    });

    it('should configure database with WAL mode and foreign keys', async () => {
      await setupDatabase();

      expect(mockDatabase.pragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(mockDatabase.pragma).toHaveBeenCalledWith('foreign_keys = ON');
    });

    it('should create all required tables', async () => {
      await setupDatabase();

      expect(mockDatabase.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS context_layers'));
      expect(mockDatabase.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS chat_archives'));
      expect(mockDatabase.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS clipboard_items'));
      expect(mockDatabase.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS planner_queue'));
      expect(mockDatabase.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS resumework_snapshots'));
      expect(mockDatabase.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS token_usage'));
    });

    it('should create all required indexes', async () => {
      await setupDatabase();

      const execCall = mockDatabase.exec.mock.calls[0][0];
      expect(execCall).toContain('CREATE INDEX IF NOT EXISTS idx_context_layers_project');
      expect(execCall).toContain('CREATE INDEX IF NOT EXISTS idx_context_layers_starred');
      expect(execCall).toContain('CREATE INDEX IF NOT EXISTS idx_chat_archives_project');
      expect(execCall).toContain('CREATE INDEX IF NOT EXISTS idx_clipboard_category');
    });

    it('should handle mkdir errors gracefully', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(setupDatabase()).rejects.toThrow('Permission denied');
      expect(Database).not.toHaveBeenCalled();
    });

    it('should handle database creation errors', async () => {
      (Database as jest.MockedClass<typeof Database>).mockImplementation(() => {
        throw new Error('Database creation failed');
      });

      await expect(setupDatabase()).rejects.toThrow('Database creation failed');
    });
  });

  describe('Database Access', () => {
    beforeEach(async () => {
      await setupDatabase();
    });

    it('should return database instance when initialized', () => {
      const db = getDatabase();
      expect(db).toBe(mockDatabase);
    });

    it('should throw error when database not initialized', () => {
      // Reset the module to clear the database instance
      jest.doMock('../database', () => ({
        ...jest.requireActual('../database'),
        getDatabase: () => {
          throw new Error('Database not initialized');
        }
      }));

      expect(() => {
        const { getDatabase: getDb } = jest.requireActual('../database');
        getDb();
      }).toThrow('Database not initialized');
    });
  });

  describe('Context Layer Operations', () => {
    let mockStatement: any;

    beforeEach(async () => {
      await setupDatabase();
      
      mockStatement = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 123 }),
        all: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(null)
      };

      mockDatabase.prepare.mockReturnValue(mockStatement);
    });

    describe('saveContextLayer', () => {
      const validLayer: ContextLayer = {
        project_path: '/valid/path',
        layer_type: 'active',
        content: 'test content',
        tokens: 100,
        actual_tokens: 95,
        is_starred: false,
        is_immutable: false,
        source: 'user'
      };

      it('should save valid context layer successfully', async () => {
        const result = await saveContextLayer(validLayer);

        expect(mockValidator.validatePath).toHaveBeenCalledWith('/valid/path');
        expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO context_layers'));
        expect(mockStatement.run).toHaveBeenCalledWith(
          '/valid/path',
          'active',
          'test content',
          100,
          95,
          0,
          0,
          'user'
        );
        expect(result).toBe(123);
      });

      it('should handle null actual_tokens', async () => {
        const layerWithoutActualTokens = { ...validLayer, actual_tokens: undefined };
        
        await saveContextLayer(layerWithoutActualTokens);

        expect(mockStatement.run).toHaveBeenCalledWith(
          '/valid/path',
          'active',
          'test content',
          100,
          null,
          0,
          0,
          'user'
        );
      });

      it('should convert boolean values correctly', async () => {
        const starredLayer = { ...validLayer, is_starred: true, is_immutable: true };
        
        await saveContextLayer(starredLayer);

        expect(mockStatement.run).toHaveBeenCalledWith(
          '/valid/path',
          'active',
          'test content',
          100,
          95,
          1,
          1,
          'user'
        );
      });

      it('should validate project path', async () => {
        mockValidator.validatePath.mockReturnValue(false);

        await expect(saveContextLayer(validLayer)).rejects.toThrow('Invalid project path');
        expect(mockDatabase.prepare).not.toHaveBeenCalled();
      });

      it('should validate token count', async () => {
        const invalidLayer = { ...validLayer, tokens: -1 };

        await expect(saveContextLayer(invalidLayer)).rejects.toThrow('Invalid token count');
      });

      it('should validate non-numeric token count', async () => {
        const invalidLayer = { ...validLayer, tokens: 'invalid' as any };

        await expect(saveContextLayer(invalidLayer)).rejects.toThrow('Invalid token count');
      });

      it('should validate layer type', async () => {
        const invalidLayer = { ...validLayer, layer_type: 'invalid' as any };

        await expect(saveContextLayer(invalidLayer)).rejects.toThrow('Invalid layer type');
      });

      it('should validate source type', async () => {
        const invalidLayer = { ...validLayer, source: 'invalid' as any };

        await expect(saveContextLayer(invalidLayer)).rejects.toThrow('Invalid source type');
      });

      it('should handle database errors', async () => {
        mockStatement.run.mockImplementation(() => {
          throw new Error('Database constraint violation');
        });

        await expect(saveContextLayer(validLayer)).rejects.toThrow('Database constraint violation');
      });

      it('should handle all layer types', async () => {
        const layerTypes: Array<ContextLayer['layer_type']> = ['core', 'active', 'reference', 'archive'];

        for (const layerType of layerTypes) {
          const layer = { ...validLayer, layer_type: layerType };
          await expect(saveContextLayer(layer)).resolves.toBe(123);
        }
      });

      it('should handle all source types', async () => {
        const sourceTypes: Array<ContextLayer['source']> = ['user', 'ai', 'system'];

        for (const sourceType of sourceTypes) {
          const layer = { ...validLayer, source: sourceType };
          await expect(saveContextLayer(layer)).resolves.toBe(123);
        }
      });
    });

    describe('getContextLayers', () => {
      const mockLayers = [
        { id: 1, layer_type: 'core', content: 'layer 1' },
        { id: 2, layer_type: 'active', content: 'layer 2' }
      ];

      it('should retrieve layers for valid project path', async () => {
        mockStatement.all.mockReturnValue(mockLayers);

        const result = await getContextLayers('/valid/path');

        expect(mockValidator.validatePath).toHaveBeenCalledWith('/valid/path');
        expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM context_layers'));
        expect(mockStatement.all).toHaveBeenCalledWith('/valid/path');
        expect(result).toEqual(mockLayers);
      });

      it('should order results correctly', async () => {
        await getContextLayers('/valid/path');

        const prepareCall = mockDatabase.prepare.mock.calls[0][0];
        expect(prepareCall).toContain('ORDER BY is_starred DESC, created_at DESC');
      });

      it('should validate project path', async () => {
        mockValidator.validatePath.mockReturnValue(false);

        await expect(getContextLayers('/invalid/path')).rejects.toThrow('Invalid project path');
        expect(mockStatement.all).not.toHaveBeenCalled();
      });

      it('should handle empty results', async () => {
        mockStatement.all.mockReturnValue([]);

        const result = await getContextLayers('/valid/path');
        expect(result).toEqual([]);
      });

      it('should handle database errors', async () => {
        mockStatement.all.mockImplementation(() => {
          throw new Error('Database read error');
        });

        await expect(getContextLayers('/valid/path')).rejects.toThrow('Database read error');
      });
    });

    describe('updateContextLayer', () => {
      it('should update layer with valid fields', async () => {
        mockValidator.validateFieldName.mockReturnValue(true);

        const updates = { is_starred: true, content: 'updated content' };
        
        await updateContextLayer(123, updates);

        expect(mockValidator.validateFieldName).toHaveBeenCalledWith('is_starred');
        expect(mockValidator.validateFieldName).toHaveBeenCalledWith('content');
        
        const prepareCall = mockDatabase.prepare.mock.calls[0][0];
        expect(prepareCall).toContain('SET is_starred = ?, content = ?, updated_at = CURRENT_TIMESTAMP');
        expect(mockStatement.run).toHaveBeenCalledWith(true, 'updated content', 123);
      });

      it('should ignore invalid field names', async () => {
        mockValidator.validateFieldName.mockImplementation(field => field !== 'malicious_field');

        const updates = { is_starred: true, malicious_field: 'bad value' };
        
        await updateContextLayer(123, updates);

        const prepareCall = mockDatabase.prepare.mock.calls[0][0];
        expect(prepareCall).toContain('SET is_starred = ?');
        expect(prepareCall).not.toContain('malicious_field');
        expect(mockStatement.run).toHaveBeenCalledWith(true, 123);
      });

      it('should ignore id field in updates', async () => {
        const updates = { id: 456, is_starred: true };
        
        await updateContextLayer(123, updates);

        const prepareCall = mockDatabase.prepare.mock.calls[0][0];
        expect(prepareCall).not.toContain('id = ?, updated_at');
        expect(prepareCall).toContain('SET is_starred = ?');
        expect(prepareCall).toContain('WHERE id = ?'); // WHERE clause should be present
      });

      it('should handle no valid fields', async () => {
        mockValidator.validateFieldName.mockReturnValue(false);

        const updates = { malicious_field: 'bad value' };
        
        await updateContextLayer(123, updates);

        expect(mockDatabase.prepare).not.toHaveBeenCalled();
      });

      it('should handle empty updates', async () => {
        await updateContextLayer(123, {});

        expect(mockDatabase.prepare).not.toHaveBeenCalled();
      });

      it('should handle database errors', async () => {
        mockStatement.run.mockImplementation(() => {
          throw new Error('Database update error');
        });

        await expect(updateContextLayer(123, { is_starred: true })).rejects.toThrow('Database update error');
      });

      it('should validate all common field names', async () => {
        const validFields = [
          'project_path',
          'layer_type',
          'content',
          'tokens',
          'actual_tokens',
          'is_starred',
          'is_immutable',
          'source'
        ];

        validFields.forEach(field => {
          mockValidator.validateFieldName.mockReturnValue(true);
          updateContextLayer(123, { [field]: 'test' });
          expect(mockValidator.validateFieldName).toHaveBeenCalledWith(field);
        });
      });
    });

    describe('deleteContextLayer', () => {
      it('should delete layer with valid ID', async () => {
        await deleteContextLayer(123);

        expect(mockDatabase.prepare).toHaveBeenCalledWith('DELETE FROM context_layers WHERE id = ?');
        expect(mockStatement.run).toHaveBeenCalledWith(123);
      });

      it('should validate ID is positive integer', async () => {
        await expect(deleteContextLayer(-1)).rejects.toThrow('Invalid layer ID');
        await expect(deleteContextLayer(0)).rejects.toThrow('Invalid layer ID');
        await expect(deleteContextLayer(1.5)).rejects.toThrow('Invalid layer ID');
      });

      it('should handle database errors', async () => {
        mockStatement.run.mockImplementation(() => {
          throw new Error('Database delete error');
        });

        await expect(deleteContextLayer(123)).rejects.toThrow('Database delete error');
      });

      it('should handle non-existent layer ID gracefully', async () => {
        mockStatement.run.mockReturnValue({ changes: 0 });

        // Should not throw error even if no rows were deleted
        await expect(deleteContextLayer(999)).resolves.toBeUndefined();
      });
    });
  });

  describe('Chat Archive Operations', () => {
    let mockStatement: any;

    beforeEach(async () => {
      await setupDatabase();
      
      mockStatement = {
        run: jest.fn(),
        all: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(null)
      };

      mockDatabase.prepare.mockReturnValue(mockStatement);
    });

    describe('archiveChat', () => {
      it('should archive chat with all parameters', async () => {
        const metadata = { type: 'conversation', version: '1.0' };
        
        await archiveChat('/test/project', 'conversation content', 5000, metadata);

        expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO chat_archives'));
        expect(mockStatement.run).toHaveBeenCalledWith(
          '/test/project',
          'conversation content',
          5000,
          JSON.stringify(metadata)
        );
      });

      it('should handle missing metadata', async () => {
        await archiveChat('/test/project', 'conversation content', 5000);

        expect(mockStatement.run).toHaveBeenCalledWith(
          '/test/project',
          'conversation content',
          5000,
          JSON.stringify({})
        );
      });

      it('should handle undefined metadata', async () => {
        await archiveChat('/test/project', 'conversation content', 5000, undefined);

        expect(mockStatement.run).toHaveBeenCalledWith(
          '/test/project',
          'conversation content',
          5000,
          JSON.stringify({})
        );
      });

      it('should handle complex metadata objects', async () => {
        const complexMetadata = {
          participants: ['user', 'assistant'],
          tags: ['important', 'bug-fix'],
          nested: { level: 1, data: 'test' }
        };

        await archiveChat('/test/project', 'content', 1000, complexMetadata);

        expect(mockStatement.run).toHaveBeenCalledWith(
          '/test/project',
          'content',
          1000,
          JSON.stringify(complexMetadata)
        );
      });

      it('should handle database errors', async () => {
        mockStatement.run.mockImplementation(() => {
          throw new Error('Database archive error');
        });

        await expect(archiveChat('/test/project', 'content', 1000)).rejects.toThrow('Database archive error');
      });

      it('should handle large conversation content', async () => {
        const largeContent = 'x'.repeat(100000);

        await expect(archiveChat('/test/project', largeContent, 50000)).resolves.toBeUndefined();
        expect(mockStatement.run).toHaveBeenCalledWith(
          '/test/project',
          largeContent,
          50000,
          JSON.stringify({})
        );
      });
    });
  });

  describe('Clipboard Operations', () => {
    let mockStatement: any;

    beforeEach(async () => {
      await setupDatabase();
      
      mockStatement = {
        run: jest.fn(),
        all: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(null)
      };

      mockDatabase.prepare.mockReturnValue(mockStatement);
    });

    describe('saveClipboardItem', () => {
      it('should save clipboard item with all parameters', async () => {
        const tags = ['javascript', 'function', 'utility'];
        
        await saveClipboardItem('clipboard content', 'code', tags);

        expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO clipboard_items'));
        expect(mockStatement.run).toHaveBeenCalledWith(
          'clipboard content',
          'code',
          JSON.stringify(tags)
        );
      });

      it('should handle missing category and tags', async () => {
        await saveClipboardItem('clipboard content');

        expect(mockStatement.run).toHaveBeenCalledWith(
          'clipboard content',
          null,
          null
        );
      });

      it('should handle undefined category and tags', async () => {
        await saveClipboardItem('clipboard content', undefined, undefined);

        expect(mockStatement.run).toHaveBeenCalledWith(
          'clipboard content',
          null,
          null
        );
      });

      it('should handle empty tags array', async () => {
        await saveClipboardItem('content', 'category', []);

        expect(mockStatement.run).toHaveBeenCalledWith(
          'content',
          'category',
          JSON.stringify([])
        );
      });

      it('should handle database errors', async () => {
        mockStatement.run.mockImplementation(() => {
          throw new Error('Database clipboard error');
        });

        await expect(saveClipboardItem('content')).rejects.toThrow('Database clipboard error');
      });
    });

    describe('getClipboardItems', () => {
      const mockItems = [
        { id: 1, content: 'item 1', category: 'code' },
        { id: 2, content: 'item 2', category: 'text' }
      ];

      it('should get items by category', async () => {
        mockStatement.all.mockReturnValue(mockItems);

        const result = await getClipboardItems('code');

        expect(mockDatabase.prepare).toHaveBeenCalledWith(
          'SELECT * FROM clipboard_items WHERE category = ? ORDER BY created_at DESC'
        );
        expect(mockStatement.all).toHaveBeenCalledWith('code');
        expect(result).toEqual(mockItems);
      });

      it('should get all items when no category specified', async () => {
        mockStatement.all.mockReturnValue(mockItems);

        const result = await getClipboardItems();

        expect(mockDatabase.prepare).toHaveBeenCalledWith(
          'SELECT * FROM clipboard_items ORDER BY created_at DESC'
        );
        expect(mockStatement.all).toHaveBeenCalledWith();
        expect(result).toEqual(mockItems);
      });

      it('should handle empty results', async () => {
        mockStatement.all.mockReturnValue([]);

        const result = await getClipboardItems('nonexistent');
        expect(result).toEqual([]);
      });

      it('should handle database errors', async () => {
        mockStatement.all.mockImplementation(() => {
          throw new Error('Database read error');
        });

        await expect(getClipboardItems()).rejects.toThrow('Database read error');
      });
    });
  });

  describe('ResumeWork Operations', () => {
    let mockStatement: any;

    beforeEach(async () => {
      await setupDatabase();
      
      mockStatement = {
        run: jest.fn(),
        all: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(null)
      };

      mockDatabase.prepare.mockReturnValue(mockStatement);
    });

    describe('saveResumeWorkSnapshot', () => {
      it('should save snapshot with valid parameters', async () => {
        await saveResumeWorkSnapshot('/valid/path', 'snapshot content', 2000);

        expect(mockValidator.validatePath).toHaveBeenCalledWith('/valid/path');
        expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO resumework_snapshots'));
        expect(mockStatement.run).toHaveBeenCalledWith('/valid/path', 'snapshot content', 2000);
      });

      it('should validate project path', async () => {
        mockValidator.validatePath.mockReturnValue(false);

        await expect(saveResumeWorkSnapshot('/invalid/path', 'content', 1000))
          .rejects.toThrow('Invalid project path');
        expect(mockStatement.run).not.toHaveBeenCalled();
      });

      it('should validate token count', async () => {
        await expect(saveResumeWorkSnapshot('/valid/path', 'content', -1))
          .rejects.toThrow('Invalid token count');

        await expect(saveResumeWorkSnapshot('/valid/path', 'content', 'invalid' as any))
          .rejects.toThrow('Invalid token count');
      });

      it('should handle database errors', async () => {
        mockStatement.run.mockImplementation(() => {
          throw new Error('Database save error');
        });

        await expect(saveResumeWorkSnapshot('/valid/path', 'content', 1000))
          .rejects.toThrow('Database save error');
      });

      it('should handle large content', async () => {
        const largeContent = 'x'.repeat(50000);

        await expect(saveResumeWorkSnapshot('/valid/path', largeContent, 25000))
          .resolves.toBeUndefined();
      });
    });

    describe('getLatestResumeWork', () => {
      const mockSnapshot = {
        id: 1,
        project_path: '/test/project',
        content: 'snapshot content',
        tokens: 2000,
        created_at: new Date()
      };

      it('should get latest snapshot for valid project', async () => {
        mockStatement.get.mockReturnValue(mockSnapshot);

        const result = await getLatestResumeWork('/valid/path');

        expect(mockValidator.validatePath).toHaveBeenCalledWith('/valid/path');
        expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining(
          'SELECT * FROM resumework_snapshots'
        ));
        expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining(
          'WHERE project_path = ?'
        ));
        expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining(
          'ORDER BY created_at DESC'
        ));
        expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining(
          'LIMIT 1'
        ));
        expect(mockStatement.get).toHaveBeenCalledWith('/valid/path');
        expect(result).toEqual(mockSnapshot);
      });

      it('should validate project path', async () => {
        mockValidator.validatePath.mockReturnValue(false);

        await expect(getLatestResumeWork('/invalid/path'))
          .rejects.toThrow('Invalid project path');
        expect(mockStatement.get).not.toHaveBeenCalled();
      });

      it('should return undefined when no snapshot exists', async () => {
        mockStatement.get.mockReturnValue(undefined);

        const result = await getLatestResumeWork('/valid/path');
        expect(result).toBeUndefined();
      });

      it('should handle database errors', async () => {
        mockStatement.get.mockImplementation(() => {
          throw new Error('Database read error');
        });

        await expect(getLatestResumeWork('/valid/path'))
          .rejects.toThrow('Database read error');
      });
    });
  });

  describe('Token Usage Operations', () => {
    let mockStatement: any;

    beforeEach(async () => {
      await setupDatabase();
      
      mockStatement = {
        run: jest.fn(),
        all: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(null)
      };

      mockDatabase.prepare.mockReturnValue(mockStatement);
    });

    describe('recordTokenUsage', () => {
      it('should record usage with all parameters', async () => {
        await recordTokenUsage(1500, 1450, 72.5, 'warning');

        expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO token_usage'));
        expect(mockStatement.run).toHaveBeenCalledWith(1500, 1450, 72.5, 'warning');
      });

      it('should record usage with minimal parameters', async () => {
        await recordTokenUsage(1000);

        expect(mockStatement.run).toHaveBeenCalledWith(1000, null, null, null);
      });

      it('should handle undefined optional parameters', async () => {
        await recordTokenUsage(1000, undefined, undefined, undefined);

        expect(mockStatement.run).toHaveBeenCalledWith(1000, null, null, null);
      });

      it('should handle zero values', async () => {
        await recordTokenUsage(0, 0, 0, 'safe');

        expect(mockStatement.run).toHaveBeenCalledWith(0, null, null, 'safe');
      });

      it('should handle database errors', async () => {
        mockStatement.run.mockImplementation(() => {
          throw new Error('Database record error');
        });

        await expect(recordTokenUsage(1000)).rejects.toThrow('Database record error');
      });

      it('should handle large token numbers', async () => {
        await recordTokenUsage(999999, 999999, 100, 'critical');

        expect(mockStatement.run).toHaveBeenCalledWith(999999, 999999, 100, 'critical');
      });
    });
  });

  describe('Database Transaction Handling', () => {
    beforeEach(async () => {
      await setupDatabase();
    });

    it('should handle concurrent operations', async () => {
      const mockStatement = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
        all: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(null)
      };

      mockDatabase.prepare.mockReturnValue(mockStatement);

      // Simulate concurrent saves
      const promises = Array.from({ length: 10 }, (_, i) =>
        saveContextLayer({
          project_path: `/test/project${i}`,
          layer_type: 'active',
          content: `content ${i}`,
          tokens: 100 + i,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => expect(result).toBe(1));
      expect(mockStatement.run).toHaveBeenCalledTimes(10);
    });

    it('should handle operation failures without affecting other operations', async () => {
      const mockStatement = {
        run: jest.fn().mockImplementation((path) => {
          if (path === '/fail/path') {
            throw new Error('Simulated failure');
          }
          return { lastInsertRowid: 1 };
        }),
        all: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(null)
      };

      mockDatabase.prepare.mockReturnValue(mockStatement);

      const validLayer = {
        project_path: '/valid/path',
        layer_type: 'active' as const,
        content: 'content',
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user' as const
      };

      const failingLayer = {
        ...validLayer,
        project_path: '/fail/path'
      };

      // One should succeed, one should fail
      await expect(saveContextLayer(validLayer)).resolves.toBe(1);
      await expect(saveContextLayer(failingLayer)).rejects.toThrow('Simulated failure');
    });
  });

  describe('Data Validation and Security', () => {
    beforeEach(async () => {
      await setupDatabase();
    });

    it('should prevent SQL injection in path validation', async () => {
      mockValidator.validatePath.mockImplementation(path => !path.includes(';'));

      const maliciousPath = "/test/path; DROP TABLE context_layers; --";

      await expect(saveContextLayer({
        project_path: maliciousPath,
        layer_type: 'active',
        content: 'content',
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user'
      })).rejects.toThrow('Invalid project path');
    });

    it('should validate field names in updates', async () => {
      mockValidator.validateFieldName.mockImplementation(field => 
        !field.includes('DROP') && !field.includes('DELETE')
      );

      const maliciousUpdate = {
        'content; DROP TABLE context_layers; --': 'malicious'
      };

      const mockStatement = {
        run: jest.fn(),
        all: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(null)
      };

      mockDatabase.prepare.mockReturnValue(mockStatement);

      await updateContextLayer(123, maliciousUpdate);

      // Should not prepare any statement since no valid fields
      expect(mockDatabase.prepare).not.toHaveBeenCalled();
    });

    it('should handle extremely large data inputs', async () => {
      const hugeContent = 'x'.repeat(1000000); // 1MB of data

      const mockStatement = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
        all: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(null)
      };

      mockDatabase.prepare.mockReturnValue(mockStatement);

      await expect(saveContextLayer({
        project_path: '/test/path',
        layer_type: 'active',
        content: hugeContent,
        tokens: 250000,
        is_starred: false,
        is_immutable: false,
        source: 'user'
      })).resolves.toBe(1);
    });

    it('should handle special characters in content', async () => {
      const specialContent = "Content with 'quotes', \"double quotes\", and \n newlines \t tabs";

      const mockStatement = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
        all: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(null)
      };

      mockDatabase.prepare.mockReturnValue(mockStatement);

      await expect(saveContextLayer({
        project_path: '/test/path',
        layer_type: 'active',
        content: specialContent,
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user'
      })).resolves.toBe(1);

      expect(mockStatement.run).toHaveBeenCalledWith(
        '/test/path',
        'active',
        specialContent,
        100,
        null,
        0,
        0,
        'user'
      );
    });

    it('should handle unicode characters', async () => {
      const unicodeContent = "Unicode content: 👋 こんにちは 🌟 Émojis and special chars ñáéíóú";

      const mockStatement = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
        all: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(null)
      };

      mockDatabase.prepare.mockReturnValue(mockStatement);

      await expect(saveContextLayer({
        project_path: '/test/path',
        layer_type: 'active',
        content: unicodeContent,
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user'
      })).resolves.toBe(1);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    beforeEach(async () => {
      await setupDatabase();
    });

    it('should handle database corruption gracefully', async () => {
      mockDatabase.prepare.mockImplementation(() => {
        throw new Error('database disk image is malformed');
      });

      await expect(saveContextLayer({
        project_path: '/test/path',
        layer_type: 'active',
        content: 'content',
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user'
      })).rejects.toThrow('database disk image is malformed');
    });

    it('should handle missing tables gracefully', async () => {
      mockDatabase.prepare.mockImplementation(() => {
        throw new Error('no such table: context_layers');
      });

      await expect(getContextLayers('/test/path')).rejects.toThrow('no such table: context_layers');
    });

    it('should handle database lock timeout', async () => {
      mockDatabase.prepare.mockImplementation(() => {
        throw new Error('database is locked');
      });

      await expect(deleteContextLayer(123)).rejects.toThrow('database is locked');
    });

    it('should handle out of memory errors', async () => {
      const mockStatement = {
        run: jest.fn().mockImplementation(() => {
          throw new Error('out of memory');
        }),
        all: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(null)
      };

      mockDatabase.prepare.mockReturnValue(mockStatement);

      await expect(recordTokenUsage(1000000)).rejects.toThrow('out of memory');
    });
  });
});