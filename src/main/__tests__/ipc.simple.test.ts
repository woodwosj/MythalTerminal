import { ipcMain, BrowserWindow } from 'electron';
import { setupIPC } from '../ipc';
import { ClaudeInstanceManager } from '../claudeManager';

// Mock dependencies
jest.mock('electron');
jest.mock('../claudeManager');
jest.mock('../database');
jest.mock('node-pty', () => ({
  spawn: jest.fn(() => ({
    onData: jest.fn(),
    onExit: jest.fn(),
    write: jest.fn(),
    resize: jest.fn(),
    kill: jest.fn()
  }))
}));
jest.mock('child_process');
jest.mock('os', () => ({
  platform: jest.fn(() => 'linux')
}));

describe('IPC Simple Tests', () => {
  let mockClaudeManager: jest.Mocked<ClaudeInstanceManager>;
  let mockIPCMain: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClaudeManager = {
      sendToInstance: jest.fn(),
      getStatus: jest.fn(),
      getAllStatuses: jest.fn(),
      spawnInstance: jest.fn(),
      startAll: jest.fn(),
      on: jest.fn()
    } as any;

    mockIPCMain = {
      handle: jest.fn()
    };

    (ipcMain as any) = mockIPCMain;
    (BrowserWindow.getAllWindows as jest.Mock) = jest.fn(() => []);

    // Mock database functions
    jest.doMock('../database', () => ({
      saveContextLayer: jest.fn().mockResolvedValue(123),
      getContextLayers: jest.fn().mockResolvedValue([]),
      updateContextLayer: jest.fn().mockResolvedValue(undefined),
      deleteContextLayer: jest.fn().mockResolvedValue(undefined),
      archiveChat: jest.fn().mockResolvedValue(undefined),
      saveClipboardItem: jest.fn().mockResolvedValue(undefined),
      getClipboardItems: jest.fn().mockResolvedValue([]),
      saveResumeWorkSnapshot: jest.fn().mockResolvedValue(undefined),
      getLatestResumeWork: jest.fn().mockResolvedValue(null),
      recordTokenUsage: jest.fn().mockResolvedValue(undefined)
    }));
  });

  it('should setup all IPC handlers', () => {
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

    expect(mockIPCMain.handle).toHaveBeenCalledTimes(expectedHandlers.length);

    expectedHandlers.forEach(handler => {
      expect(mockIPCMain.handle).toHaveBeenCalledWith(
        handler,
        expect.any(Function)
      );
    });
  });

  it('should setup Claude manager event listeners', () => {
    setupIPC(mockClaudeManager);

    // Verify event listeners are registered
    expect(mockClaudeManager.on).toHaveBeenCalledWith('instance:started', expect.any(Function));
    expect(mockClaudeManager.on).toHaveBeenCalledWith('instance:failed', expect.any(Function));
    
    // Verify output handlers for all instances
    const expectedInstances = ['main', 'contextManager', 'summarizer', 'planner'];
    expectedInstances.forEach(instance => {
      expect(mockClaudeManager.on).toHaveBeenCalledWith(`${instance}:output`, expect.any(Function));
      expect(mockClaudeManager.on).toHaveBeenCalledWith(`${instance}:error`, expect.any(Function));
    });
  });

  it('should handle terminal creation', async () => {
    setupIPC(mockClaudeManager);

    const terminalCreateHandler = mockIPCMain.handle.mock.calls.find(
      call => call[0] === 'terminal:create'
    )?.[1];

    expect(terminalCreateHandler).toBeDefined();

    if (terminalCreateHandler) {
      const mockEvent = { sender: { send: jest.fn() } };
      const result = await terminalCreateHandler(mockEvent, 'test-terminal');
      
      expect(result).toEqual({ success: true });
    }
  });

  it('should handle Claude operations', async () => {
    mockClaudeManager.sendToInstance.mockResolvedValue(undefined);
    mockClaudeManager.getStatus.mockReturnValue({ status: 'idle' });
    mockClaudeManager.getAllStatuses.mockReturnValue({ main: { status: 'idle' } });
    mockClaudeManager.spawnInstance.mockResolvedValue(undefined);
    mockClaudeManager.startAll.mockResolvedValue(undefined);

    setupIPC(mockClaudeManager);

    const handlers = {
      send: mockIPCMain.handle.mock.calls.find(call => call[0] === 'claude:send')?.[1],
      status: mockIPCMain.handle.mock.calls.find(call => call[0] === 'claude:status')?.[1],
      start: mockIPCMain.handle.mock.calls.find(call => call[0] === 'claude:start')?.[1],
      startAll: mockIPCMain.handle.mock.calls.find(call => call[0] === 'claude:startAll')?.[1]
    };

    // Test claude:send
    if (handlers.send) {
      const result = await handlers.send(null, 'main', 'test message');
      expect(result.success).toBe(true);
    }

    // Test claude:status
    if (handlers.status) {
      const result = await handlers.status(null, 'main');
      expect(result).toEqual({ status: 'idle' });
    }

    // Test claude:start
    if (handlers.start) {
      const result = await handlers.start(null, 'main');
      expect(result.success).toBe(true);
    }

    // Test claude:startAll
    if (handlers.startAll) {
      const result = await handlers.startAll(null);
      expect(result.success).toBe(true);
    }
  });

  it('should handle context operations', async () => {
    setupIPC(mockClaudeManager);

    const handlers = {
      save: mockIPCMain.handle.mock.calls.find(call => call[0] === 'context:save')?.[1],
      get: mockIPCMain.handle.mock.calls.find(call => call[0] === 'context:get')?.[1],
      update: mockIPCMain.handle.mock.calls.find(call => call[0] === 'context:update')?.[1],
      delete: mockIPCMain.handle.mock.calls.find(call => call[0] === 'context:delete')?.[1]
    };

    // Test all handlers exist
    Object.values(handlers).forEach(handler => {
      expect(handler).toBeDefined();
    });

    // Test context:save
    if (handlers.save) {
      const result = await handlers.save(null, {
        project_path: '/test',
        layer_type: 'active',
        content: 'test',
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user'
      });
      expect(result.success).toBe(true);
    }

    // Test context:get
    if (handlers.get) {
      const result = await handlers.get(null, '/test/project');
      expect(result.success).toBe(true);
    }

    // Test context:update
    if (handlers.update) {
      const result = await handlers.update(null, 123, { is_starred: true });
      expect(result.success).toBe(true);
    }

    // Test context:delete  
    if (handlers.delete) {
      const result = await handlers.delete(null, 123);
      expect(result.success).toBe(true);
    }
  });

  it('should handle other operations', async () => {
    setupIPC(mockClaudeManager);

    const handlers = {
      chatArchive: mockIPCMain.handle.mock.calls.find(call => call[0] === 'chat:archive')?.[1],
      clipboardSave: mockIPCMain.handle.mock.calls.find(call => call[0] === 'clipboard:save')?.[1],
      clipboardGet: mockIPCMain.handle.mock.calls.find(call => call[0] === 'clipboard:get')?.[1],
      resumeworkSave: mockIPCMain.handle.mock.calls.find(call => call[0] === 'resumework:save')?.[1],
      resumeworkGet: mockIPCMain.handle.mock.calls.find(call => call[0] === 'resumework:get')?.[1],
      tokensRecord: mockIPCMain.handle.mock.calls.find(call => call[0] === 'tokens:record')?.[1]
    };

    // Test all handlers
    if (handlers.chatArchive) {
      const result = await handlers.chatArchive(null, '/test', 'conversation', 100);
      expect(result.success).toBe(true);
    }

    if (handlers.clipboardSave) {
      const result = await handlers.clipboardSave(null, 'content');
      expect(result.success).toBe(true);
    }

    if (handlers.clipboardGet) {
      const result = await handlers.clipboardGet(null);
      expect(result.success).toBe(true);
    }

    if (handlers.resumeworkSave) {
      const result = await handlers.resumeworkSave(null, '/test', 'content', 100);
      expect(result.success).toBe(true);
    }

    if (handlers.resumeworkGet) {
      const result = await handlers.resumeworkGet(null, '/test');
      expect(result.success).toBe(true);
    }

    if (handlers.tokensRecord) {
      const result = await handlers.tokensRecord(null, 100);
      expect(result.success).toBe(true);
    }
  });
});