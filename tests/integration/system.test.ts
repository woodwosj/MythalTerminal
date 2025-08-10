import { ClaudeInstanceManager } from '../../src/main/claudeManager';
import * as database from '../../src/main/database';
import { useContextStore } from '../../src/renderer/stores/contextStore';
import { renderHook, act } from '@testing-library/react';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import Database from 'better-sqlite3';

// Mock external dependencies
jest.mock('child_process');
jest.mock('fs/promises');
jest.mock('better-sqlite3');
jest.mock('electron', () => require('../mocks/electron'));

// Mock child process for Claude instances
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockFs = fs as jest.Mocked<typeof fs>;

// Setup database mock
const mockDatabase = {
  pragma: jest.fn(),
  exec: jest.fn(),
  prepare: jest.fn(() => ({
    run: jest.fn(() => ({ lastInsertRowid: 1, changes: 1 })),
    get: jest.fn(),
    all: jest.fn(() => [])
  })),
  transaction: jest.fn((fn) => fn()),
  close: jest.fn()
};

(Database as jest.Mock).mockImplementation(() => mockDatabase);

// Mock window.mythalAPI for integration tests
const mockMythalAPI = {
  context: {
    get: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  claude: {
    send: jest.fn(),
    status: jest.fn()
  }
};

Object.defineProperty(window, 'mythalAPI', {
  value: mockMythalAPI,
  writable: true
});

// Mock console to avoid test noise
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.error = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

describe('System Integration Tests', () => {
  let claudeManager: ClaudeInstanceManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    claudeManager = new ClaudeInstanceManager();
    
    // Reset database state
    (database as any).db = null;
    
    // Reset context store
    useContextStore.setState({
      layers: [],
      totalTokens: 0,
      starredTokens: 0,
      activeTokens: 0,
      referenceTokens: 0,
      archiveTokens: 0
    });

    // Setup default mock responses
    mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
    mockFs.readdir.mockResolvedValue(['project1', 'project2'] as any);
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
    mockFs.access.mockRejectedValue(new Error('ENOENT'));
    mockFs.mkdir.mockResolvedValue(undefined);

    // Setup mock child process
    const mockProcess = {
      stdin: { write: jest.fn() },
      stdout: { on: jest.fn(), emit: jest.fn() },
      stderr: { on: jest.fn(), emit: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(() => true),
      killed: false,
      exitCode: null
    };
    mockSpawn.mockReturnValue(mockProcess as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    claudeManager.shutdown();
  });

  describe('Database and Claude Manager Integration', () => {
    it('should initialize database and Claude manager together', async () => {
      await database.setupDatabase();
      await claudeManager.initialize();

      expect(mockDatabase.pragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(mockDatabase.pragma).toHaveBeenCalledWith('foreign_keys = ON');
      expect(claudeManager.getStatus('main')).toBe('idle');
    });

    it('should save context and start Claude instance for processing', async () => {
      await database.setupDatabase();
      await claudeManager.initialize();

      // Save a context layer
      const layer: database.ContextLayer = {
        project_path: '/test/project',
        layer_type: 'active',
        content: 'Test context for Claude processing',
        tokens: 150,
        is_starred: false,
        is_immutable: false,
        source: 'user'
      };

      const savedId = await database.saveContextLayer(layer);
      expect(savedId).toBe(1);

      // Start Claude instance to process the context
      await claudeManager.spawnInstance('contextManager');
      expect(claudeManager.getStatus('contextManager')).toBe('running');

      // Send context to Claude for processing
      await claudeManager.sendToInstance('contextManager', layer.content);
      
      expect(mockSpawn).toHaveBeenCalledWith('claude', 
        expect.arrayContaining(['--no-interactive']),
        expect.any(Object)
      );
    });

    it('should handle database operations during Claude processing', async () => {
      await database.setupDatabase();
      await claudeManager.initialize();

      // Simulate multiple context layers being processed
      const layers = [
        {
          project_path: '/test/project',
          layer_type: 'core' as const,
          content: 'Core context',
          tokens: 200,
          is_starred: true,
          is_immutable: true,
          source: 'system' as const
        },
        {
          project_path: '/test/project',
          layer_type: 'active' as const,
          content: 'Active context',
          tokens: 150,
          is_starred: false,
          is_immutable: false,
          source: 'user' as const
        }
      ];

      // Save layers concurrently
      const savePromises = layers.map(layer => database.saveContextLayer(layer));
      const savedIds = await Promise.all(savePromises);
      
      expect(savedIds).toEqual([1, 1]); // Mock returns 1 for each

      // Start multiple Claude instances
      await claudeManager.startAll();
      
      expect(claudeManager.getStatus('main')).toBe('running');
      expect(claudeManager.getStatus('contextManager')).toBe('running');
      expect(claudeManager.getStatus('summarizer')).toBe('running');
    });

    it('should recover from Claude crash and preserve database state', async () => {
      await database.setupDatabase();
      await claudeManager.initialize();

      // Save important context
      const layer: database.ContextLayer = {
        project_path: '/test/project',
        layer_type: 'core',
        content: 'Important context that must survive crash',
        tokens: 300,
        is_starred: true,
        is_immutable: true,
        source: 'system'
      };

      await database.saveContextLayer(layer);

      // Start Claude instance
      await claudeManager.spawnInstance('main');
      const mockProcess = (mockSpawn as any).mock.results[0].value;

      // Simulate crash
      mockProcess.on.mock.calls
        .find(([event]: [string]) => event === 'exit')[1](1, null);

      expect(claudeManager.getStatus('main')).toBe('crashed');

      // Advance time to trigger restart
      jest.advanceTimersByTime(1000);
      
      // Verify database still accessible
      const layers = await database.getContextLayers('/test/project');
      mockDatabase.prepare().all.mockReturnValue([layer]);
      
      expect(layers).toBeDefined();
    });

    it('should handle concurrent database writes during Claude operations', async () => {
      await database.setupDatabase();
      await claudeManager.initialize();
      
      await claudeManager.startAll();

      // Simulate concurrent operations
      const operations = [
        database.saveContextLayer({
          project_path: '/proj1',
          layer_type: 'active',
          content: 'Context 1',
          tokens: 100,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        }),
        database.archiveChat('/proj1', 'Chat 1', 200),
        database.saveClipboardItem('Code snippet 1', 'javascript'),
        database.recordTokenUsage(500, 480, 85.5, 'safe'),
        claudeManager.sendToInstance('main', 'Process this'),
        claudeManager.sendToInstance('contextManager', 'Update context')
      ];

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });

  describe('Context Store and Database Integration', () => {
    beforeEach(async () => {
      await database.setupDatabase();
    });

    it('should sync context store with database operations', async () => {
      // Mock database responses
      mockMythalAPI.context.save.mockResolvedValue({ success: true, id: 123 });
      mockMythalAPI.context.get.mockResolvedValue({
        success: true,
        layers: [{
          id: 123,
          project_path: '/test/project',
          layer_type: 'active',
          content: 'Test layer',
          tokens: 150,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        }]
      });

      const { result } = renderHook(() => useContextStore());

      // Add layer through store
      await act(async () => {
        await result.current.addLayer({
          project_path: '/test/project',
          layer_type: 'active',
          content: 'Test layer',
          tokens: 150,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        });
      });

      expect(result.current.layers).toHaveLength(1);
      expect(result.current.totalTokens).toBe(150);

      // Load from database
      await act(async () => {
        await result.current.loadContext('/test/project');
      });

      expect(mockMythalAPI.context.get).toHaveBeenCalledWith('/test/project');
      expect(result.current.layers).toHaveLength(1);
    });

    it('should handle database constraints in context store', async () => {
      mockMythalAPI.context.save.mockResolvedValue({
        success: false,
        error: 'Duplicate entry'
      });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.addLayer({
          project_path: '/test/project',
          layer_type: 'active',
          content: 'Duplicate layer',
          tokens: 100,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        });
      });

      expect(result.current.layers).toHaveLength(0); // Should not add on failure
    });

    it('should maintain token consistency across operations', async () => {
      const layers = [
        {
          id: 1,
          project_path: '/test/project',
          layer_type: 'active' as const,
          content: 'Layer 1',
          tokens: 100,
          actual_tokens: 95,
          is_starred: false,
          is_immutable: false,
          source: 'user' as const
        },
        {
          id: 2,
          project_path: '/test/project',
          layer_type: 'reference' as const,
          content: 'Layer 2',
          tokens: 200,
          is_starred: true,
          is_immutable: false,
          source: 'ai' as const
        }
      ];

      mockMythalAPI.context.get.mockResolvedValue({
        success: true,
        layers
      });
      mockMythalAPI.context.update.mockResolvedValue({ success: true });
      mockMythalAPI.context.delete.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useContextStore());

      // Load initial data
      await act(async () => {
        await result.current.loadContext('/test/project');
      });

      expect(result.current.totalTokens).toBe(295); // 95 + 200

      // Update a layer
      await act(async () => {
        await result.current.updateLayer(1, { tokens: 120, actual_tokens: 115 });
      });

      expect(result.current.totalTokens).toBe(315); // 115 + 200

      // Delete a layer
      await act(async () => {
        await result.current.deleteLayer(2);
      });

      expect(result.current.totalTokens).toBe(115); // Only layer 1 remains
    });
  });

  describe('Claude Manager and Context Store Integration', () => {
    it('should process context updates through Claude', async () => {
      await claudeManager.initialize();
      await database.setupDatabase();

      mockMythalAPI.context.save.mockResolvedValue({ success: true, id: 1 });
      
      const { result } = renderHook(() => useContextStore());

      // Start context manager instance
      await claudeManager.spawnInstance('contextManager');

      // Add context that needs processing
      await act(async () => {
        await result.current.addLayer({
          project_path: '/test/project',
          layer_type: 'active',
          content: 'New context that needs Claude processing',
          tokens: 200,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        });
      });

      // Send to Claude for context analysis
      await claudeManager.sendToInstance('contextManager', 
        'Analyze: ' + result.current.layers[0].content);

      expect(claudeManager.getStatus('contextManager')).toBe('running');
      expect(result.current.layers).toHaveLength(1);
    });

    it('should handle token limit warnings across components', async () => {
      await claudeManager.initialize();
      await database.setupDatabase();

      // Setup high token usage scenario
      mockMythalAPI.context.get.mockResolvedValue({
        success: true,
        layers: [{
          id: 1,
          project_path: '/test/project',
          layer_type: 'active',
          content: 'Very large context',
          tokens: 190000, // Near limit
          is_starred: false,
          is_immutable: false,
          source: 'user'
        }]
      });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.loadContext('/test/project');
      });

      expect(result.current.totalTokens).toBe(190000);
      
      // Token usage approaching limit should affect Claude operations
      await claudeManager.spawnInstance('main');
      await claudeManager.sendToInstance('main', 'Large context processing');

      // Record token usage
      await database.recordTokenUsage(190000, 195000, 97.5, 'critical');
      
      expect(mockDatabase.prepare).toHaveBeenCalled();
    });

    it('should coordinate multi-instance Claude operations with shared context', async () => {
      await claudeManager.initialize();
      await database.setupDatabase();

      // Setup shared context
      const sharedContext = {
        id: 1,
        project_path: '/shared/project',
        layer_type: 'core' as const,
        content: 'Shared context for multiple Claude instances',
        tokens: 500,
        is_starred: true,
        is_immutable: true,
        source: 'system' as const
      };

      mockMythalAPI.context.get.mockResolvedValue({
        success: true,
        layers: [sharedContext]
      });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.loadContext('/shared/project');
      });

      // Start multiple Claude instances
      await claudeManager.startAll();
      
      jest.advanceTimersByTime(2000); // Account for startup delays

      // Send context to different instances for different purposes
      const operations = [
        claudeManager.sendToInstance('main', 'Main processing: ' + sharedContext.content),
        claudeManager.sendToInstance('contextManager', 'Context analysis: ' + sharedContext.content),
        claudeManager.sendToInstance('summarizer', 'Summarize: ' + sharedContext.content)
      ];

      await Promise.all(operations);

      expect(claudeManager.getAllStatuses()).toMatchObject({
        main: 'running',
        contextManager: 'running',
        summarizer: 'running',
        planner: 'running'
      });
    });
  });

  describe('Error Recovery and Consistency', () => {
    it('should maintain system consistency during partial failures', async () => {
      await claudeManager.initialize();
      await database.setupDatabase();

      // Setup scenario where some operations succeed and others fail
      mockMythalAPI.context.save
        .mockResolvedValueOnce({ success: true, id: 1 })
        .mockResolvedValueOnce({ success: false, error: 'Database constraint' })
        .mockResolvedValueOnce({ success: true, id: 2 });

      const { result } = renderHook(() => useContextStore());

      // Attempt multiple operations
      const operations = [
        result.current.addLayer({
          project_path: '/test/project',
          layer_type: 'active',
          content: 'Layer 1',
          tokens: 100,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        }),
        result.current.addLayer({
          project_path: '/test/project',
          layer_type: 'active',
          content: 'Layer 2 (will fail)',
          tokens: 100,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        }),
        result.current.addLayer({
          project_path: '/test/project',
          layer_type: 'reference',
          content: 'Layer 3',
          tokens: 150,
          is_starred: false,
          is_immutable: false,
          source: 'ai'
        })
      ];

      await act(async () => {
        await Promise.all(operations);
      });

      // Should have 2 successful layers
      expect(result.current.layers).toHaveLength(2);
      expect(result.current.totalTokens).toBe(250); // 100 + 150
    });

    it('should recover from Claude instance failures without losing context', async () => {
      await claudeManager.initialize();
      await database.setupDatabase();

      // Save important context first
      const importantLayer: database.ContextLayer = {
        project_path: '/critical/project',
        layer_type: 'core',
        content: 'Critical system context',
        tokens: 400,
        is_starred: true,
        is_immutable: true,
        source: 'system'
      };

      await database.saveContextLayer(importantLayer);

      // Start Claude instance
      await claudeManager.spawnInstance('main');
      const mockProcess = (mockSpawn as any).mock.results[0].value;

      // Simulate multiple rapid failures
      for (let i = 0; i < 3; i++) {
        mockProcess.on.mock.calls
          .find(([event]: [string]) => event === 'exit')[1](1, null);
        
        jest.advanceTimersByTime(1000);
      }

      expect(claudeManager.getStatus('main')).toBe('crashed');

      // Context should still be accessible in database
      const savedLayers = await database.getContextLayers('/critical/project');
      expect(mockDatabase.prepare).toHaveBeenCalled();

      // Store should be unaffected
      mockMythalAPI.context.get.mockResolvedValue({
        success: true,
        layers: [importantLayer]
      });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.loadContext('/critical/project');
      });

      expect(result.current.layers).toHaveLength(1);
      expect(result.current.totalTokens).toBe(400);
    });

    it('should handle database corruption gracefully', async () => {
      // Simulate database corruption
      mockDatabase.prepare.mockImplementation(() => {
        throw new Error('Database disk image is malformed');
      });

      await expect(database.setupDatabase()).rejects.toThrow('Database disk image is malformed');

      // Claude manager should still initialize
      await expect(claudeManager.initialize()).resolves.not.toThrow();

      // Context store should handle database errors
      mockMythalAPI.context.get.mockRejectedValue(new Error('Database unavailable'));

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.loadContext('/test/project');
      });

      expect(result.current.layers).toEqual([]);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-throughput context operations', async () => {
      await claudeManager.initialize();
      await database.setupDatabase();
      await claudeManager.startAll();

      jest.advanceTimersByTime(2000); // Account for startup delays

      // Simulate high-throughput operations
      const batchOperations = Array(100).fill(0).map(async (_, i) => {
        return Promise.all([
          database.saveContextLayer({
            project_path: `/project${i % 10}`,
            layer_type: 'active',
            content: `Batch content ${i}`,
            tokens: 100 + i,
            is_starred: i % 5 === 0,
            is_immutable: false,
            source: 'user'
          }),
          claudeManager.sendToInstance('main', `Batch message ${i}`)
        ]);
      });

      await expect(Promise.all(batchOperations)).resolves.not.toThrow();
    });

    it('should manage memory efficiently during long-running operations', async () => {
      await claudeManager.initialize();
      await database.setupDatabase();

      const largeContent = 'x'.repeat(10000); // Large content string

      // Simulate long-running session with large contexts
      for (let i = 0; i < 50; i++) {
        await database.saveContextLayer({
          project_path: '/memory/test',
          layer_type: 'active',
          content: `${largeContent} - iteration ${i}`,
          tokens: 5000 + i,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        });

        // Simulate periodic token usage recording
        await database.recordTokenUsage(5000 + i, null, null, 'safe');

        // Simulate Claude processing
        await claudeManager.spawnInstance('main');
        await claudeManager.sendToInstance('main', `Process iteration ${i}`);

        // Occasional cleanup
        if (i % 10 === 0) {
          claudeManager.shutdown();
          await claudeManager.initialize();
        }
      }

      expect(mockDatabase.prepare).toHaveBeenCalled();
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should simulate a complete development session', async () => {
      await database.setupDatabase();
      await claudeManager.initialize();

      // Start of development session
      await claudeManager.startAll();
      jest.advanceTimersByTime(2000);

      const { result } = renderHook(() => useContextStore());

      // Load existing project context
      mockMythalAPI.context.get.mockResolvedValue({
        success: true,
        layers: [{
          id: 1,
          project_path: '/dev/project',
          layer_type: 'core',
          content: 'Project configuration and setup',
          tokens: 300,
          is_starred: true,
          is_immutable: true,
          source: 'system'
        }]
      });

      await act(async () => {
        await result.current.loadContext('/dev/project');
      });

      // Developer adds new context during work
      mockMythalAPI.context.save.mockResolvedValue({ success: true, id: 2 });
      
      await act(async () => {
        await result.current.addLayer({
          project_path: '/dev/project',
          layer_type: 'active',
          content: 'Working on new feature implementation',
          tokens: 250,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        });
      });

      // Claude processes the context
      await claudeManager.sendToInstance('main', 
        result.current.layers[1].content);

      // Save conversation for later reference
      await database.archiveChat('/dev/project', 
        'Discussion about feature implementation', 800);

      // Save useful code snippet
      await database.saveClipboardItem(
        'function newFeature() { return "implemented"; }',
        'javascript',
        ['feature', 'implementation']
      );

      // Record token usage
      await database.recordTokenUsage(550, 545, 72.5, 'safe');

      // Update context based on progress
      mockMythalAPI.context.update.mockResolvedValue({ success: true });
      
      await act(async () => {
        await result.current.updateLayer(2, {
          content: 'Feature implementation completed',
          tokens: 200,
          is_starred: true
        });
      });

      expect(result.current.totalTokens).toBe(500); // 300 + 200
      expect(result.current.starredTokens).toBe(500); // Both layers starred
    });

    it('should handle context overflow and archiving', async () => {
      await database.setupDatabase();
      await claudeManager.initialize();

      const { result } = renderHook(() => useContextStore());

      // Simulate context near token limit
      const largeLayers = Array(10).fill(0).map((_, i) => ({
        id: i + 1,
        project_path: '/large/project',
        layer_type: 'active' as const,
        content: `Large context block ${i}`,
        tokens: 18000, // Each layer uses significant tokens
        is_starred: false,
        is_immutable: false,
        source: 'user' as const
      }));

      mockMythalAPI.context.get.mockResolvedValue({
        success: true,
        layers: largeLayers
      });

      await act(async () => {
        await result.current.loadContext('/large/project');
      });

      expect(result.current.totalTokens).toBe(180000); // Near limit

      // Archive old context
      for (const layer of largeLayers.slice(0, 5)) {
        await database.archiveChat('/large/project', layer.content, layer.tokens);
      }

      // Update store to reflect archival
      mockMythalAPI.context.update.mockResolvedValue({ success: true });
      
      await act(async () => {
        await result.current.updateLayer(1, { layer_type: 'archive' });
        await result.current.updateLayer(2, { layer_type: 'archive' });
      });

      expect(result.current.archiveTokens).toBe(36000); // 2 archived layers
    });
  });
});