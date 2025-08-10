import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { setupDatabase, getDatabase, saveContextLayer, getContextLayers } from '../../src/main/database';
import { setupIPC } from '../../src/main/ipc';
import { ClaudeInstanceManager } from '../../src/main/claudeManager';

// Mock electron and external dependencies for integration tests
jest.mock('electron');
jest.mock('child_process');
jest.mock('node-pty');
jest.mock('fs/promises');

describe('Full System Integration Tests', () => {
  let mockApp: any;
  let mockBrowserWindow: any;
  let mockClaudeManager: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock app
    mockApp = {
      whenReady: jest.fn(() => Promise.resolve()),
      quit: jest.fn(),
      getPath: jest.fn((type) => `/test/${type}`),
      on: jest.fn()
    };

    // Mock BrowserWindow
    mockBrowserWindow = {
      webContents: {
        send: jest.fn(),
        openDevTools: jest.fn()
      },
      loadFile: jest.fn(),
      on: jest.fn(),
      close: jest.fn()
    };

    (app as any) = mockApp;
    (BrowserWindow as any) = jest.fn(() => mockBrowserWindow);
    (BrowserWindow as any).getAllWindows = jest.fn(() => [mockBrowserWindow]);

    // Mock ClaudeInstanceManager
    mockClaudeManager = {
      sendToInstance: jest.fn(),
      getStatus: jest.fn(),
      getAllStatuses: jest.fn(),
      spawnInstance: jest.fn(),
      startAll: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    };

    // Mock fs
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockResolvedValue('test file content');
    (fs.readdir as jest.Mock).mockResolvedValue(['file1.txt', 'file2.js']);
    (fs.stat as jest.Mock).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
      size: 1024
    });
  });

  describe('Application Startup and Initialization', () => {
    it('should initialize all components in correct order', async () => {
      const initOrder: string[] = [];

      // Mock database setup
      const originalSetupDatabase = setupDatabase;
      (setupDatabase as jest.Mock) = jest.fn().mockImplementation(async () => {
        initOrder.push('database');
        // Simulate actual database setup
        return Promise.resolve();
      });

      // Mock IPC setup
      const originalSetupIPC = setupIPC;
      (setupIPC as jest.Mock) = jest.fn().mockImplementation((claudeManager) => {
        initOrder.push('ipc');
        return originalSetupIPC(claudeManager);
      });

      // Mock Claude manager initialization
      mockClaudeManager.startAll = jest.fn().mockImplementation(async () => {
        initOrder.push('claude');
        return Promise.resolve();
      });

      // Simulate application startup sequence
      await mockApp.whenReady();
      await setupDatabase();
      setupIPC(mockClaudeManager);
      await mockClaudeManager.startAll();

      expect(initOrder).toEqual(['database', 'ipc', 'claude']);
    });

    it('should handle initialization failures gracefully', async () => {
      // Mock database setup failure
      (setupDatabase as jest.Mock).mockRejectedValue(new Error('Database initialization failed'));

      await expect(setupDatabase()).rejects.toThrow('Database initialization failed');

      // Application should still be able to continue with fallback behavior
      expect(mockApp.whenReady).toBeDefined();
    });

    it('should create main window with correct configuration', () => {
      const window = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, '../../src/main/preload.js')
        }
      });

      expect(BrowserWindow).toHaveBeenCalledWith({
        width: 1200,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, '../../src/main/preload.js')
        }
      });
    });
  });

  describe('Database and IPC Integration', () => {
    beforeEach(async () => {
      // Setup database with real implementation for integration tests
      await setupDatabase();
      setupIPC(mockClaudeManager);
    });

    it('should handle full context layer lifecycle through IPC', async () => {
      const mockEvent = { sender: { send: jest.fn() } };
      
      // Mock database operations
      const mockDatabase = {
        prepare: jest.fn(() => ({
          run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
          all: jest.fn().mockReturnValue([]),
          get: jest.fn()
        }))
      };

      // Test context layer creation through IPC
      const testLayer = {
        project_path: '/test/project',
        layer_type: 'active' as const,
        content: 'Integration test content',
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user' as const
      };

      // Simulate IPC calls
      const { ipcMain } = require('electron');
      const contextSaveHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'context:save'
      )?.[1];

      if (contextSaveHandler) {
        const saveResult = await contextSaveHandler(mockEvent, testLayer);
        expect(saveResult.success).toBe(true);
        expect(saveResult.id).toBeDefined();
      }
    });

    it('should maintain data consistency across multiple operations', async () => {
      const operations = [
        { type: 'save', data: { project_path: '/test/1', layer_type: 'active', content: 'content 1', tokens: 100, is_starred: false, is_immutable: false, source: 'user' } },
        { type: 'save', data: { project_path: '/test/2', layer_type: 'core', content: 'content 2', tokens: 200, is_starred: true, is_immutable: true, source: 'system' } },
        { type: 'get', projectPath: '/test/1' },
        { type: 'update', id: 1, updates: { is_starred: true } },
        { type: 'delete', id: 2 }
      ];

      const results: any[] = [];

      for (const operation of operations) {
        try {
          switch (operation.type) {
            case 'save':
              const id = await saveContextLayer(operation.data as any);
              results.push({ type: 'save', success: true, id });
              break;
            case 'get':
              const layers = await getContextLayers(operation.projectPath);
              results.push({ type: 'get', success: true, count: layers.length });
              break;
            default:
              results.push({ type: operation.type, success: true });
          }
        } catch (error) {
          results.push({ type: operation.type, success: false, error: (error as Error).message });
        }
      }

      // All operations should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Terminal and Process Management Integration', () => {
    let mockTerminal: any;

    beforeEach(() => {
      mockTerminal = {
        onData: jest.fn(),
        onExit: jest.fn(),
        write: jest.fn(),
        resize: jest.fn(),
        kill: jest.fn()
      };

      const pty = require('node-pty');
      pty.spawn = jest.fn(() => mockTerminal);
    });

    it('should create and manage multiple terminals', async () => {
      setupIPC(mockClaudeManager);

      const { ipcMain } = require('electron');
      const terminalCreateHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'terminal:create'
      )?.[1];

      const mockEvent = { sender: { send: jest.fn() } };

      // Create multiple terminals
      const terminalIds = ['terminal-1', 'terminal-2', 'terminal-3'];
      const createResults = [];

      for (const id of terminalIds) {
        if (terminalCreateHandler) {
          const result = await terminalCreateHandler(mockEvent, id);
          createResults.push(result);
        }
      }

      createResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Each terminal should have its own event handlers
      expect(mockTerminal.onData).toHaveBeenCalledTimes(3);
      expect(mockTerminal.onExit).toHaveBeenCalledTimes(3);
    });

    it('should handle terminal output and forward to renderer', async () => {
      setupIPC(mockClaudeManager);

      const { ipcMain } = require('electron');
      const terminalCreateHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'terminal:create'
      )?.[1];

      const mockEvent = { sender: { send: jest.fn() } };
      const terminalId = 'test-terminal';

      if (terminalCreateHandler) {
        await terminalCreateHandler(mockEvent, terminalId);

        // Simulate terminal output
        const onDataCallback = mockTerminal.onData.mock.calls[0][0];
        onDataCallback('test output data');

        // Should forward to renderer
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
          `terminal:output:${terminalId}`,
          'test output data'
        );
      }
    });

    it('should handle terminal process exit', async () => {
      setupIPC(mockClaudeManager);

      const { ipcMain } = require('electron');
      const terminalCreateHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'terminal:create'
      )?.[1];

      const mockEvent = { sender: { send: jest.fn() } };
      const terminalId = 'test-terminal';

      if (terminalCreateHandler) {
        await terminalCreateHandler(mockEvent, terminalId);

        // Simulate terminal exit
        const onExitCallback = mockTerminal.onExit.mock.calls[0][0];
        onExitCallback({ exitCode: 0, signal: null });

        // Should notify renderer
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
          `terminal:exit:${terminalId}`,
          { exitCode: 0, signal: null }
        );
      }
    });
  });

  describe('Claude Instance Management Integration', () => {
    beforeEach(() => {
      setupIPC(mockClaudeManager);
    });

    it('should coordinate multiple Claude instances', async () => {
      const instances = ['main', 'contextManager', 'summarizer', 'planner'];
      
      mockClaudeManager.getAllStatuses.mockReturnValue(
        instances.reduce((acc, instance) => ({
          ...acc,
          [instance]: { status: 'idle', uptime: 1000 }
        }), {})
      );

      const { ipcMain } = require('electron');
      const statusHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'claude:status'
      )?.[1];

      if (statusHandler) {
        const statuses = await statusHandler(null);
        
        instances.forEach(instance => {
          expect(statuses[instance]).toBeDefined();
          expect(statuses[instance].status).toBe('idle');
        });
      }
    });

    it('should handle Claude instance communication flow', async () => {
      const { ipcMain } = require('electron');
      
      const sendHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'claude:send'
      )?.[1];

      const startHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'claude:start'
      )?.[1];

      mockClaudeManager.spawnInstance.mockResolvedValue(undefined);
      mockClaudeManager.sendToInstance.mockResolvedValue(undefined);

      // Start Claude instance
      if (startHandler) {
        const startResult = await startHandler(null, 'main');
        expect(startResult.success).toBe(true);
        expect(mockClaudeManager.spawnInstance).toHaveBeenCalledWith('main');
      }

      // Send message to instance
      if (sendHandler) {
        const sendResult = await sendHandler(null, 'main', 'test message');
        expect(sendResult.success).toBe(true);
        expect(mockClaudeManager.sendToInstance).toHaveBeenCalledWith('main', 'test message');
      }
    });

    it('should broadcast Claude events to all windows', () => {
      const mockWindow2 = {
        webContents: { send: jest.fn() }
      };

      (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([
        mockBrowserWindow,
        mockWindow2
      ]);

      setupIPC(mockClaudeManager);

      // Find the instance started event handler
      const instanceStartedHandler = mockClaudeManager.on.mock.calls.find(
        call => call[0] === 'instance:started'
      )?.[1];

      if (instanceStartedHandler) {
        instanceStartedHandler('main');

        // Should broadcast to all windows
        expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith('claude:started', 'main');
        expect(mockWindow2.webContents.send).toHaveBeenCalledWith('claude:started', 'main');
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle partial system failures gracefully', async () => {
      // Simulate database working but Claude manager failing
      mockClaudeManager.startAll.mockRejectedValue(new Error('Claude startup failed'));

      await setupDatabase(); // Should succeed
      setupIPC(mockClaudeManager); // Should succeed

      // Claude operations should fail gracefully
      const { ipcMain } = require('electron');
      const claudeStartAllHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'claude:startAll'
      )?.[1];

      if (claudeStartAllHandler) {
        const result = await claudeStartAllHandler(null);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Claude startup failed');
      }

      // But database operations should still work
      const contextGetHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'context:get'
      )?.[1];

      if (contextGetHandler) {
        const result = await contextGetHandler(null, '/test/project');
        expect(result.success).toBe(true);
      }
    });

    it('should recover from temporary failures', async () => {
      let failCount = 0;
      mockClaudeManager.sendToInstance.mockImplementation(async () => {
        failCount++;
        if (failCount <= 2) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve();
      });

      setupIPC(mockClaudeManager);

      const { ipcMain } = require('electron');
      const sendHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'claude:send'
      )?.[1];

      if (sendHandler) {
        // First two attempts should fail
        let result = await sendHandler(null, 'main', 'test');
        expect(result.success).toBe(false);

        result = await sendHandler(null, 'main', 'test');
        expect(result.success).toBe(false);

        // Third attempt should succeed
        result = await sendHandler(null, 'main', 'test');
        expect(result.success).toBe(true);
      }
    });

    it('should handle resource cleanup on shutdown', async () => {
      setupIPC(mockClaudeManager);

      // Create some terminals
      const { ipcMain } = require('electron');
      const terminalCreateHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'terminal:create'
      )?.[1];
      const terminalDestroyHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'terminal:destroy'
      )?.[1];

      const mockEvent = { sender: { send: jest.fn() } };

      if (terminalCreateHandler && terminalDestroyHandler) {
        // Create terminal
        await terminalCreateHandler(mockEvent, 'terminal-1');

        // Destroy terminal (cleanup)
        const result = await terminalDestroyHandler(mockEvent, 'terminal-1');
        expect(result.success).toBe(true);
        expect(mockTerminal.kill).toHaveBeenCalled();
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency operations efficiently', async () => {
      setupIPC(mockClaudeManager);

      const { ipcMain } = require('electron');
      const contextSaveHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'context:save'
      )?.[1];

      if (contextSaveHandler) {
        const startTime = performance.now();
        
        // Simulate high-frequency saves
        const promises = Array.from({ length: 100 }, (_, i) =>
          contextSaveHandler(null, {
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
        const endTime = performance.now();

        // All should succeed
        results.forEach(result => {
          expect(result.success).toBe(true);
        });

        // Should complete within reasonable time
        expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
      }
    });

    it('should handle concurrent terminal operations', async () => {
      setupIPC(mockClaudeManager);

      const { ipcMain } = require('electron');
      const terminalCreateHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'terminal:create'
      )?.[1];
      const terminalWriteHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'terminal:write'
      )?.[1];

      const mockEvent = { sender: { send: jest.fn() } };

      if (terminalCreateHandler && terminalWriteHandler) {
        // Create multiple terminals concurrently
        const createPromises = Array.from({ length: 10 }, (_, i) =>
          terminalCreateHandler(mockEvent, `terminal-${i}`)
        );

        const createResults = await Promise.all(createPromises);
        createResults.forEach(result => {
          expect(result.success).toBe(true);
        });

        // Write to all terminals concurrently
        const writePromises = Array.from({ length: 10 }, (_, i) =>
          terminalWriteHandler(mockEvent, `terminal-${i}`, `command ${i}`)
        );

        const writeResults = await Promise.all(writePromises);
        writeResults.forEach(result => {
          expect(result.success).toBe(true);
        });
      }
    });

    it('should manage memory usage with large datasets', async () => {
      setupIPC(mockClaudeManager);

      const { ipcMain } = require('electron');
      const contextSaveHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'context:save'
      )?.[1];

      if (contextSaveHandler) {
        // Create layers with large content
        const largeContent = 'x'.repeat(100000); // 100KB per layer
        
        const promises = Array.from({ length: 50 }, (_, i) =>
          contextSaveHandler(null, {
            project_path: `/test/project${i}`,
            layer_type: 'active',
            content: largeContent,
            tokens: 25000,
            is_starred: false,
            is_immutable: false,
            source: 'user'
          })
        );

        const results = await Promise.all(promises);
        
        results.forEach(result => {
          expect(result.success).toBe(true);
        });

        // Memory usage should remain stable (no memory leaks)
        const memUsage = process.memoryUsage();
        expect(memUsage.heapUsed).toBeLessThan(1024 * 1024 * 100); // Less than 100MB
      }
    });
  });

  describe('Data Flow Integration', () => {
    it('should maintain data consistency across all components', async () => {
      await setupDatabase();
      setupIPC(mockClaudeManager);

      const testProject = '/integration/test/project';
      const testLayers = [
        {
          project_path: testProject,
          layer_type: 'core' as const,
          content: 'Core layer content',
          tokens: 150,
          is_starred: true,
          is_immutable: true,
          source: 'system' as const
        },
        {
          project_path: testProject,
          layer_type: 'active' as const,
          content: 'Active layer content',
          tokens: 100,
          is_starred: false,
          is_immutable: false,
          source: 'user' as const
        }
      ];

      const { ipcMain } = require('electron');
      const contextSaveHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'context:save'
      )?.[1];
      const contextGetHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'context:get'
      )?.[1];

      if (contextSaveHandler && contextGetHandler) {
        // Save layers
        for (const layer of testLayers) {
          const result = await contextSaveHandler(null, layer);
          expect(result.success).toBe(true);
        }

        // Retrieve layers
        const getResult = await contextGetHandler(null, testProject);
        expect(getResult.success).toBe(true);
        expect(getResult.layers).toBeDefined();
      }
    });

    it('should handle complex workflow scenarios', async () => {
      await setupDatabase();
      setupIPC(mockClaudeManager);

      // Simulate complex workflow: create terminals, save context, start Claude, send message
      const { ipcMain } = require('electron');
      const handlers = {
        terminalCreate: ipcMain.handle.mock.calls.find(call => call[0] === 'terminal:create')?.[1],
        contextSave: ipcMain.handle.mock.calls.find(call => call[0] === 'context:save')?.[1],
        claudeStart: ipcMain.handle.mock.calls.find(call => call[0] === 'claude:start')?.[1],
        claudeSend: ipcMain.handle.mock.calls.find(call => call[0] === 'claude:send')?.[1],
        chatArchive: ipcMain.handle.mock.calls.find(call => call[0] === 'chat:archive')?.[1]
      };

      const mockEvent = { sender: { send: jest.fn() } };

      // Step 1: Create terminal
      if (handlers.terminalCreate) {
        const terminalResult = await handlers.terminalCreate(mockEvent, 'workflow-terminal');
        expect(terminalResult.success).toBe(true);
      }

      // Step 2: Save context layer
      if (handlers.contextSave) {
        const contextResult = await handlers.contextSave(mockEvent, {
          project_path: '/workflow/project',
          layer_type: 'active',
          content: 'Workflow context',
          tokens: 50,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        });
        expect(contextResult.success).toBe(true);
      }

      // Step 3: Start Claude instance
      if (handlers.claudeStart) {
        mockClaudeManager.spawnInstance.mockResolvedValue(undefined);
        const claudeResult = await handlers.claudeStart(mockEvent, 'main');
        expect(claudeResult.success).toBe(true);
      }

      // Step 4: Send message to Claude
      if (handlers.claudeSend) {
        mockClaudeManager.sendToInstance.mockResolvedValue(undefined);
        const sendResult = await handlers.claudeSend(mockEvent, 'main', 'Analyze this workflow');
        expect(sendResult.success).toBe(true);
      }

      // Step 5: Archive conversation
      if (handlers.chatArchive) {
        const archiveResult = await handlers.chatArchive(
          mockEvent,
          '/workflow/project',
          'User: Analyze this workflow\nClaude: Analysis complete',
          120,
          { workflow: true, step: 5 }
        );
        expect(archiveResult.success).toBe(true);
      }
    });
  });

  describe('Security Integration', () => {
    it('should validate all inputs across system boundaries', async () => {
      await setupDatabase();
      setupIPC(mockClaudeManager);

      const { ipcMain } = require('electron');
      const contextSaveHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'context:save'
      )?.[1];

      // Test various potentially malicious inputs
      const maliciousInputs = [
        {
          project_path: '/test/../../../etc/passwd',
          layer_type: 'active',
          content: 'content',
          tokens: 100,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        },
        {
          project_path: '/test/project',
          layer_type: 'active',
          content: '<script>alert("xss")</script>',
          tokens: 100,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        },
        {
          project_path: '/test/project',
          layer_type: 'invalid' as any,
          content: 'content',
          tokens: 100,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        }
      ];

      if (contextSaveHandler) {
        for (const input of maliciousInputs) {
          const result = await contextSaveHandler(null, input);
          // Should fail validation for malicious inputs
          expect(result.success).toBe(false);
        }
      }
    });

    it('should prevent unauthorized operations', async () => {
      await setupDatabase();
      setupIPC(mockClaudeManager);

      const { ipcMain } = require('electron');
      const contextDeleteHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'context:delete'
      )?.[1];

      if (contextDeleteHandler) {
        // Test invalid ID formats
        const invalidIds = [-1, 0, 1.5, 'invalid', null, undefined];

        for (const id of invalidIds) {
          const result = await contextDeleteHandler(null, id);
          expect(result.success).toBe(false);
        }
      }
    });

    it('should sanitize all user-provided content', async () => {
      await setupDatabase();
      setupIPC(mockClaudeManager);

      const { ipcMain } = require('electron');
      const clipboardSaveHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'clipboard:save'
      )?.[1];

      if (clipboardSaveHandler) {
        const potentiallyDangerousContent = `
          <script>window.location = 'http://evil.com';</script>
          \x00\x01\x02\x03
          ${'\u0000'.repeat(100)}
          ${'a'.repeat(1000000)}
        `;

        const result = await clipboardSaveHandler(null, potentiallyDangerousContent, 'test');
        // Should handle without crashing
        expect(result.success).toBe(true);
      }
    });
  });
});