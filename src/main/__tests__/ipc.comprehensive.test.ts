import { ipcMain, BrowserWindow } from 'electron';
import { setupIPC } from '../ipc';
import { ClaudeInstanceManager } from '../claudeManager';
import * as db from '../database';
import * as pty from 'node-pty';

// Mock all dependencies
jest.mock('electron');
jest.mock('../claudeManager');
jest.mock('../database');
jest.mock('node-pty');
jest.mock('child_process');

describe('IPC Comprehensive Tests', () => {
  let mockClaudeManager: jest.Mocked<ClaudeInstanceManager>;
  let mockIPCMain: jest.Mocked<typeof ipcMain>;
  let mockBrowserWindow: jest.Mocked<typeof BrowserWindow>;
  let mockPtySpawn: jest.MockedFunction<typeof pty.spawn>;
  let mockTerminal: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock terminal
    mockTerminal = {
      onData: jest.fn(),
      onExit: jest.fn(),
      write: jest.fn(),
      resize: jest.fn(),
      kill: jest.fn()
    };

    // Setup mocks
    mockIPCMain = ipcMain as jest.Mocked<typeof ipcMain>;
    mockBrowserWindow = BrowserWindow as jest.Mocked<typeof BrowserWindow>;
    mockPtySpawn = pty.spawn as jest.MockedFunction<typeof pty.spawn>;
    mockPtySpawn.mockReturnValue(mockTerminal);

    mockClaudeManager = {
      sendToInstance: jest.fn(),
      getStatus: jest.fn(),
      getAllStatuses: jest.fn(),
      spawnInstance: jest.fn(),
      startAll: jest.fn(),
      on: jest.fn()
    } as any;

    mockBrowserWindow.getAllWindows = jest.fn().mockReturnValue([{
      webContents: {
        send: jest.fn()
      }
    }]);

    // Mock database functions
    (db.saveContextLayer as jest.Mock).mockResolvedValue(123);
    (db.getContextLayers as jest.Mock).mockResolvedValue([]);
    (db.updateContextLayer as jest.Mock).mockResolvedValue(undefined);
    (db.deleteContextLayer as jest.Mock).mockResolvedValue(undefined);
    (db.archiveChat as jest.Mock).mockResolvedValue(undefined);
    (db.saveClipboardItem as jest.Mock).mockResolvedValue(undefined);
    (db.getClipboardItems as jest.Mock).mockResolvedValue([]);
    (db.saveResumeWorkSnapshot as jest.Mock).mockResolvedValue(undefined);
    (db.getLatestResumeWork as jest.Mock).mockResolvedValue(null);
    (db.recordTokenUsage as jest.Mock).mockResolvedValue(undefined);
  });

  describe('setupIPC', () => {
    it('should register all IPC handlers', () => {
      setupIPC(mockClaudeManager);

      const expectedHandlers = [
        'terminal:create',
        'terminal:write',
        'terminal:resize',
        'terminal:destroy',
        'claude:send',
        'claude:status',
        'claude:start',
        'claude:startAll',
        'context:save',
        'context:get',
        'context:update',
        'context:delete',
        'chat:archive',
        'clipboard:save',
        'clipboard:get',
        'resumework:save',
        'resumework:get',
        'tokens:record'
      ];

      expectedHandlers.forEach(handler => {
        expect(mockIPCMain.handle).toHaveBeenCalledWith(
          handler,
          expect.any(Function)
        );
      });
    });

    it('should setup Claude instance event listeners', () => {
      setupIPC(mockClaudeManager);

      const expectedEvents = [
        'instance:started',
        'instance:failed',
        'main:output',
        'main:error',
        'contextManager:output',
        'contextManager:error',
        'summarizer:output',
        'summarizer:error',
        'planner:output',
        'planner:error'
      ];

      expectedEvents.forEach(event => {
        expect(mockClaudeManager.on).toHaveBeenCalledWith(
          event,
          expect.any(Function)
        );
      });
    });
  });

  describe('Terminal Management', () => {
    let terminalCreateHandler: any;
    let terminalWriteHandler: any;
    let terminalResizeHandler: any;
    let terminalDestroyHandler: any;

    beforeEach(() => {
      setupIPC(mockClaudeManager);
      
      // Extract handlers from mock calls
      const handleCalls = mockIPCMain.handle.mock.calls;
      terminalCreateHandler = handleCalls.find(call => call[0] === 'terminal:create')?.[1];
      terminalWriteHandler = handleCalls.find(call => call[0] === 'terminal:write')?.[1];
      terminalResizeHandler = handleCalls.find(call => call[0] === 'terminal:resize')?.[1];
      terminalDestroyHandler = handleCalls.find(call => call[0] === 'terminal:destroy')?.[1];
    });

    it('should create terminal successfully', async () => {
      const mockEvent = { sender: { send: jest.fn() } };
      const terminalId = 'test-terminal-1';

      const result = await terminalCreateHandler(mockEvent, terminalId);

      expect(pty.spawn).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          name: 'xterm-color',
          cols: 80,
          rows: 30,
          cwd: process.cwd(),
          env: process.env
        })
      );
      expect(mockTerminal.onData).toHaveBeenCalled();
      expect(mockTerminal.onExit).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should handle terminal data output', async () => {
      const mockEvent = { sender: { send: jest.fn() } };
      const terminalId = 'test-terminal-1';

      await terminalCreateHandler(mockEvent, terminalId);

      // Simulate terminal data
      const onDataCallback = mockTerminal.onData.mock.calls[0][0];
      onDataCallback('test output');

      expect(mockEvent.sender.send).toHaveBeenCalledWith(
        `terminal:output:${terminalId}`,
        'test output'
      );
    });

    it('should handle terminal exit', async () => {
      const mockEvent = { sender: { send: jest.fn() } };
      const terminalId = 'test-terminal-1';

      await terminalCreateHandler(mockEvent, terminalId);

      // Simulate terminal exit
      const onExitCallback = mockTerminal.onExit.mock.calls[0][0];
      onExitCallback({ exitCode: 0, signal: null });

      expect(mockEvent.sender.send).toHaveBeenCalledWith(
        `terminal:exit:${terminalId}`,
        { exitCode: 0, signal: null }
      );
    });

    it('should write to terminal successfully', async () => {
      const mockEvent = { sender: { send: jest.fn() } };
      const terminalId = 'test-terminal-1';

      // Create terminal first
      await terminalCreateHandler(mockEvent, terminalId);

      // Write to terminal
      const result = await terminalWriteHandler(mockEvent, terminalId, 'test command');

      expect(mockTerminal.write).toHaveBeenCalledWith('test command');
      expect(result).toEqual({ success: true });
    });

    it('should handle write to non-existent terminal', async () => {
      const mockEvent = { sender: { send: jest.fn() } };
      const result = await terminalWriteHandler(mockEvent, 'non-existent', 'test');

      expect(result).toEqual({ success: false, error: 'Terminal not found' });
    });

    it('should resize terminal successfully', async () => {
      const mockEvent = { sender: { send: jest.fn() } };
      const terminalId = 'test-terminal-1';

      await terminalCreateHandler(mockEvent, terminalId);

      const result = await terminalResizeHandler(mockEvent, terminalId, 120, 40);

      expect(mockTerminal.resize).toHaveBeenCalledWith(120, 40);
      expect(result).toEqual({ success: true });
    });

    it('should handle resize of non-existent terminal', async () => {
      const mockEvent = { sender: { send: jest.fn() } };
      const result = await terminalResizeHandler(mockEvent, 'non-existent', 120, 40);

      expect(result).toEqual({ success: false, error: 'Terminal not found' });
    });

    it('should destroy terminal successfully', async () => {
      const mockEvent = { sender: { send: jest.fn() } };
      const terminalId = 'test-terminal-1';

      await terminalCreateHandler(mockEvent, terminalId);

      const result = await terminalDestroyHandler(mockEvent, terminalId);

      expect(mockTerminal.kill).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should handle destroy of non-existent terminal', async () => {
      const mockEvent = { sender: { send: jest.fn() } };
      const result = await terminalDestroyHandler(mockEvent, 'non-existent');

      expect(result).toEqual({ success: false, error: 'Terminal not found' });
    });
  });

  describe('Claude Instance Management', () => {
    let claudeSendHandler: any;
    let claudeStatusHandler: any;
    let claudeStartHandler: any;
    let claudeStartAllHandler: any;

    beforeEach(() => {
      setupIPC(mockClaudeManager);
      
      const handleCalls = mockIPCMain.handle.mock.calls;
      claudeSendHandler = handleCalls.find(call => call[0] === 'claude:send')?.[1];
      claudeStatusHandler = handleCalls.find(call => call[0] === 'claude:status')?.[1];
      claudeStartHandler = handleCalls.find(call => call[0] === 'claude:start')?.[1];
      claudeStartAllHandler = handleCalls.find(call => call[0] === 'claude:startAll')?.[1];
    });

    it('should send message to Claude instance successfully', async () => {
      mockClaudeManager.sendToInstance.mockResolvedValue(undefined);

      const result = await claudeSendHandler(null, 'main', 'test message');

      expect(mockClaudeManager.sendToInstance).toHaveBeenCalledWith('main', 'test message');
      expect(result).toEqual({ success: true });
    });

    it('should handle Claude send error', async () => {
      mockClaudeManager.sendToInstance.mockRejectedValue(new Error('Claude error'));

      const result = await claudeSendHandler(null, 'main', 'test message');

      expect(result).toEqual({ success: false, error: 'Claude error' });
    });

    it('should get status for specific instance', async () => {
      const mockStatus = { status: 'idle', uptime: 1000 };
      mockClaudeManager.getStatus.mockReturnValue(mockStatus);

      const result = await claudeStatusHandler(null, 'main');

      expect(mockClaudeManager.getStatus).toHaveBeenCalledWith('main');
      expect(result).toBe(mockStatus);
    });

    it('should get all statuses when no instance specified', async () => {
      const mockStatuses = { main: { status: 'idle' }, contextManager: { status: 'busy' } };
      mockClaudeManager.getAllStatuses.mockReturnValue(mockStatuses);

      const result = await claudeStatusHandler(null);

      expect(mockClaudeManager.getAllStatuses).toHaveBeenCalled();
      expect(result).toBe(mockStatuses);
    });

    it('should start Claude instance successfully', async () => {
      mockClaudeManager.spawnInstance.mockResolvedValue(undefined);

      const result = await claudeStartHandler(null, 'main');

      expect(mockClaudeManager.spawnInstance).toHaveBeenCalledWith('main');
      expect(result).toEqual({ success: true });
    });

    it('should handle Claude start error', async () => {
      mockClaudeManager.spawnInstance.mockRejectedValue(new Error('Start error'));

      const result = await claudeStartHandler(null, 'main');

      expect(result).toEqual({ success: false, error: 'Start error' });
    });

    it('should start all Claude instances successfully', async () => {
      mockClaudeManager.startAll.mockResolvedValue(undefined);

      const result = await claudeStartAllHandler(null);

      expect(mockClaudeManager.startAll).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should handle start all error', async () => {
      mockClaudeManager.startAll.mockRejectedValue(new Error('Start all error'));

      const result = await claudeStartAllHandler(null);

      expect(result).toEqual({ success: false, error: 'Start all error' });
    });
  });

  describe('Context Layer Management', () => {
    let contextSaveHandler: any;
    let contextGetHandler: any;
    let contextUpdateHandler: any;
    let contextDeleteHandler: any;

    beforeEach(() => {
      setupIPC(mockClaudeManager);
      
      const handleCalls = mockIPCMain.handle.mock.calls;
      contextSaveHandler = handleCalls.find(call => call[0] === 'context:save')?.[1];
      contextGetHandler = handleCalls.find(call => call[0] === 'context:get')?.[1];
      contextUpdateHandler = handleCalls.find(call => call[0] === 'context:update')?.[1];
      contextDeleteHandler = handleCalls.find(call => call[0] === 'context:delete')?.[1];
    });

    it('should save context layer successfully', async () => {
      const mockLayer = {
        project_path: '/test/project',
        layer_type: 'active' as const,
        content: 'test content',
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user' as const
      };

      const result = await contextSaveHandler(null, mockLayer);

      expect(db.saveContextLayer).toHaveBeenCalledWith(mockLayer);
      expect(result).toEqual({ success: true, id: 123 });
    });

    it('should handle context save error', async () => {
      const mockLayer = {
        project_path: '/test/project',
        layer_type: 'active' as const,
        content: 'test content',
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user' as const
      };

      (db.saveContextLayer as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await contextSaveHandler(null, mockLayer);

      expect(result).toEqual({ success: false, error: 'DB error' });
    });

    it('should get context layers successfully', async () => {
      const mockLayers = [
        { id: 1, layer_type: 'core', content: 'layer 1' },
        { id: 2, layer_type: 'active', content: 'layer 2' }
      ];
      (db.getContextLayers as jest.Mock).mockResolvedValue(mockLayers);

      const result = await contextGetHandler(null, '/test/project');

      expect(db.getContextLayers).toHaveBeenCalledWith('/test/project');
      expect(result).toEqual({ success: true, layers: mockLayers });
    });

    it('should handle context get error', async () => {
      (db.getContextLayers as jest.Mock).mockRejectedValue(new Error('Get error'));

      const result = await contextGetHandler(null, '/test/project');

      expect(result).toEqual({ success: false, error: 'Get error' });
    });

    it('should update context layer successfully', async () => {
      const updates = { is_starred: true, content: 'updated content' };

      const result = await contextUpdateHandler(null, 123, updates);

      expect(db.updateContextLayer).toHaveBeenCalledWith(123, updates);
      expect(result).toEqual({ success: true });
    });

    it('should handle context update error', async () => {
      (db.updateContextLayer as jest.Mock).mockRejectedValue(new Error('Update error'));

      const result = await contextUpdateHandler(null, 123, { is_starred: true });

      expect(result).toEqual({ success: false, error: 'Update error' });
    });

    it('should delete context layer successfully', async () => {
      const result = await contextDeleteHandler(null, 123);

      expect(db.deleteContextLayer).toHaveBeenCalledWith(123);
      expect(result).toEqual({ success: true });
    });

    it('should handle context delete error', async () => {
      (db.deleteContextLayer as jest.Mock).mockRejectedValue(new Error('Delete error'));

      const result = await contextDeleteHandler(null, 123);

      expect(result).toEqual({ success: false, error: 'Delete error' });
    });
  });

  describe('Chat Archive Management', () => {
    let chatArchiveHandler: any;

    beforeEach(() => {
      setupIPC(mockClaudeManager);
      
      const handleCalls = mockIPCMain.handle.mock.calls;
      chatArchiveHandler = handleCalls.find(call => call[0] === 'chat:archive')?.[1];
    });

    it('should archive chat successfully', async () => {
      const result = await chatArchiveHandler(
        null,
        '/test/project',
        'conversation content',
        5000,
        { type: 'chat', version: '1.0' }
      );

      expect(db.archiveChat).toHaveBeenCalledWith(
        '/test/project',
        'conversation content',
        5000,
        { type: 'chat', version: '1.0' }
      );
      expect(result).toEqual({ success: true });
    });

    it('should handle chat archive error', async () => {
      (db.archiveChat as jest.Mock).mockRejectedValue(new Error('Archive error'));

      const result = await chatArchiveHandler(
        null,
        '/test/project',
        'conversation content',
        5000
      );

      expect(result).toEqual({ success: false, error: 'Archive error' });
    });
  });

  describe('Clipboard Management', () => {
    let clipboardSaveHandler: any;
    let clipboardGetHandler: any;

    beforeEach(() => {
      setupIPC(mockClaudeManager);
      
      const handleCalls = mockIPCMain.handle.mock.calls;
      clipboardSaveHandler = handleCalls.find(call => call[0] === 'clipboard:save')?.[1];
      clipboardGetHandler = handleCalls.find(call => call[0] === 'clipboard:get')?.[1];
    });

    it('should save clipboard item successfully', async () => {
      const result = await clipboardSaveHandler(
        null,
        'clipboard content',
        'code',
        ['javascript', 'function']
      );

      expect(db.saveClipboardItem).toHaveBeenCalledWith(
        'clipboard content',
        'code',
        ['javascript', 'function']
      );
      expect(result).toEqual({ success: true });
    });

    it('should handle clipboard save error', async () => {
      (db.saveClipboardItem as jest.Mock).mockRejectedValue(new Error('Save error'));

      const result = await clipboardSaveHandler(null, 'content');

      expect(result).toEqual({ success: false, error: 'Save error' });
    });

    it('should get clipboard items successfully', async () => {
      const mockItems = [
        { id: 1, content: 'item 1', category: 'code' },
        { id: 2, content: 'item 2', category: 'text' }
      ];
      (db.getClipboardItems as jest.Mock).mockResolvedValue(mockItems);

      const result = await clipboardGetHandler(null, 'code');

      expect(db.getClipboardItems).toHaveBeenCalledWith('code');
      expect(result).toEqual({ success: true, items: mockItems });
    });

    it('should get all clipboard items when no category specified', async () => {
      const mockItems = [{ id: 1, content: 'item 1' }];
      (db.getClipboardItems as jest.Mock).mockResolvedValue(mockItems);

      const result = await clipboardGetHandler(null);

      expect(db.getClipboardItems).toHaveBeenCalledWith(undefined);
      expect(result).toEqual({ success: true, items: mockItems });
    });

    it('should handle clipboard get error', async () => {
      (db.getClipboardItems as jest.Mock).mockRejectedValue(new Error('Get error'));

      const result = await clipboardGetHandler(null);

      expect(result).toEqual({ success: false, error: 'Get error' });
    });
  });

  describe('ResumeWork Management', () => {
    let resumeworkSaveHandler: any;
    let resumeworkGetHandler: any;

    beforeEach(() => {
      setupIPC(mockClaudeManager);
      
      const handleCalls = mockIPCMain.handle.mock.calls;
      resumeworkSaveHandler = handleCalls.find(call => call[0] === 'resumework:save')?.[1];
      resumeworkGetHandler = handleCalls.find(call => call[0] === 'resumework:get')?.[1];
    });

    it('should save resumework snapshot successfully', async () => {
      const result = await resumeworkSaveHandler(
        null,
        '/test/project',
        'snapshot content',
        2000
      );

      expect(db.saveResumeWorkSnapshot).toHaveBeenCalledWith(
        '/test/project',
        'snapshot content',
        2000
      );
      expect(result).toEqual({ success: true });
    });

    it('should handle resumework save error', async () => {
      (db.saveResumeWorkSnapshot as jest.Mock).mockRejectedValue(new Error('Save error'));

      const result = await resumeworkSaveHandler(
        null,
        '/test/project',
        'content',
        2000
      );

      expect(result).toEqual({ success: false, error: 'Save error' });
    });

    it('should get latest resumework snapshot successfully', async () => {
      const mockSnapshot = {
        id: 1,
        project_path: '/test/project',
        content: 'snapshot content',
        tokens: 2000,
        created_at: new Date()
      };
      (db.getLatestResumeWork as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await resumeworkGetHandler(null, '/test/project');

      expect(db.getLatestResumeWork).toHaveBeenCalledWith('/test/project');
      expect(result).toEqual({ success: true, snapshot: mockSnapshot });
    });

    it('should handle resumework get error', async () => {
      (db.getLatestResumeWork as jest.Mock).mockRejectedValue(new Error('Get error'));

      const result = await resumeworkGetHandler(null, '/test/project');

      expect(result).toEqual({ success: false, error: 'Get error' });
    });
  });

  describe('Token Usage Tracking', () => {
    let tokensRecordHandler: any;

    beforeEach(() => {
      setupIPC(mockClaudeManager);
      
      const handleCalls = mockIPCMain.handle.mock.calls;
      tokensRecordHandler = handleCalls.find(call => call[0] === 'tokens:record')?.[1];
    });

    it('should record token usage successfully', async () => {
      const result = await tokensRecordHandler(null, 1500, 1450, 72.5, 'warning');

      expect(db.recordTokenUsage).toHaveBeenCalledWith(1500, 1450, 72.5, 'warning');
      expect(result).toEqual({ success: true });
    });

    it('should record token usage with minimal parameters', async () => {
      const result = await tokensRecordHandler(null, 1000);

      expect(db.recordTokenUsage).toHaveBeenCalledWith(1000, undefined, undefined, undefined);
      expect(result).toEqual({ success: true });
    });

    it('should handle token usage recording error', async () => {
      (db.recordTokenUsage as jest.Mock).mockRejectedValue(new Error('Record error'));

      const result = await tokensRecordHandler(null, 1000);

      expect(result).toEqual({ success: false, error: 'Record error' });
    });
  });

  describe('Event Broadcasting', () => {
    beforeEach(() => {
      setupIPC(mockClaudeManager);
    });

    it('should broadcast instance started event', () => {
      const onInstanceStarted = mockClaudeManager.on.mock.calls.find(
        call => call[0] === 'instance:started'
      )?.[1];

      onInstanceStarted('main');

      expect(mockBrowserWindow.getAllWindows).toHaveBeenCalled();
    });

    it('should broadcast instance failed event', () => {
      const onInstanceFailed = mockClaudeManager.on.mock.calls.find(
        call => call[0] === 'instance:failed'
      )?.[1];

      onInstanceFailed('contextManager');

      expect(mockBrowserWindow.getAllWindows).toHaveBeenCalled();
    });

    it('should broadcast instance output events', () => {
      const instanceKeys = ['main', 'contextManager', 'summarizer', 'planner'];

      instanceKeys.forEach(instanceKey => {
        const onOutput = mockClaudeManager.on.mock.calls.find(
          call => call[0] === `${instanceKey}:output`
        )?.[1];

        expect(onOutput).toBeDefined();

        if (onOutput) {
          onOutput('test output data');
          expect(mockBrowserWindow.getAllWindows).toHaveBeenCalled();
        }
      });
    });

    it('should broadcast instance error events', () => {
      const instanceKeys = ['main', 'contextManager', 'summarizer', 'planner'];

      instanceKeys.forEach(instanceKey => {
        const onError = mockClaudeManager.on.mock.calls.find(
          call => call[0] === `${instanceKey}:error`
        )?.[1];

        expect(onError).toBeDefined();

        if (onError) {
          onError('test error data');
          expect(mockBrowserWindow.getAllWindows).toHaveBeenCalled();
        }
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      setupIPC(mockClaudeManager);
    });

    it('should handle null/undefined parameters gracefully', async () => {
      const handleCalls = mockIPCMain.handle.mock.calls;
      const contextSaveHandler = handleCalls.find(call => call[0] === 'context:save')?.[1];

      const result = await contextSaveHandler(null, null);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty string parameters', async () => {
      const handleCalls = mockIPCMain.handle.mock.calls;
      const contextGetHandler = handleCalls.find(call => call[0] === 'context:get')?.[1];

      const result = await contextGetHandler(null, '');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid terminal IDs', async () => {
      const handleCalls = mockIPCMain.handle.mock.calls;
      const terminalWriteHandler = handleCalls.find(call => call[0] === 'terminal:write')?.[1];

      const result = await terminalWriteHandler(null, '', 'test');

      expect(result).toEqual({ success: false, error: 'Terminal not found' });
    });

    it('should handle Claude manager being null', async () => {
      const nullClaudeManager = null as any;
      
      expect(() => {
        setupIPC(nullClaudeManager);
      }).toThrow();
    });

    it('should handle database connection errors', async () => {
      (db.saveContextLayer as jest.Mock).mockRejectedValue(new Error('Database connection lost'));

      const handleCalls = mockIPCMain.handle.mock.calls;
      const contextSaveHandler = handleCalls.find(call => call[0] === 'context:save')?.[1];

      const result = await contextSaveHandler(null, {
        project_path: '/test',
        layer_type: 'active',
        content: 'test',
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user'
      });

      expect(result).toEqual({ success: false, error: 'Database connection lost' });
    });
  });

  describe('Performance and Concurrency', () => {
    beforeEach(() => {
      setupIPC(mockClaudeManager);
    });

    it('should handle multiple simultaneous terminal operations', async () => {
      const handleCalls = mockIPCMain.handle.mock.calls;
      const terminalCreateHandler = handleCalls.find(call => call[0] === 'terminal:create')?.[1];
      const terminalWriteHandler = handleCalls.find(call => call[0] === 'terminal:write')?.[1];

      const mockEvent = { sender: { send: jest.fn() } };

      // Create multiple terminals simultaneously
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        terminalCreateHandler(mockEvent, `terminal-${i}`)
      );

      const results = await Promise.all(createPromises);

      results.forEach(result => {
        expect(result).toEqual({ success: true });
      });

      // Write to all terminals simultaneously
      const writePromises = Array.from({ length: 5 }, (_, i) =>
        terminalWriteHandler(mockEvent, `terminal-${i}`, `command-${i}`)
      );

      const writeResults = await Promise.all(writePromises);

      writeResults.forEach(result => {
        expect(result).toEqual({ success: true });
      });
    });

    it('should handle concurrent context layer operations', async () => {
      const handleCalls = mockIPCMain.handle.mock.calls;
      const contextSaveHandler = handleCalls.find(call => call[0] === 'context:save')?.[1];

      // Simulate concurrent saves
      const savePromises = Array.from({ length: 10 }, (_, i) =>
        contextSaveHandler(null, {
          project_path: '/test',
          layer_type: 'active',
          content: `content-${i}`,
          tokens: 100 + i,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        })
      );

      const results = await Promise.all(savePromises);

      results.forEach(result => {
        expect(result).toEqual({ success: true, id: 123 });
      });

      expect(db.saveContextLayer).toHaveBeenCalledTimes(10);
    });

    it('should handle event broadcasting to multiple windows', () => {
      const windows = Array.from({ length: 3 }, () => ({
        webContents: { send: jest.fn() }
      }));

      mockBrowserWindow.getAllWindows.mockReturnValue(windows);

      const onInstanceStarted = mockClaudeManager.on.mock.calls.find(
        call => call[0] === 'instance:started'
      )?.[1];

      onInstanceStarted('main');

      windows.forEach(window => {
        expect(window.webContents.send).toHaveBeenCalledWith('claude:started', 'main');
      });
    });
  });
});