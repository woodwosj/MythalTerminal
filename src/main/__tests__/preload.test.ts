/**
 * @jest-environment jsdom
 */

import { contextBridge, ipcRenderer } from 'electron';

// Mock electron
jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: jest.fn()
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  }
}));

describe('Preload Script Tests', () => {
  let mockContextBridge: any;
  let mockIpcRenderer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Re-establish mocks after reset
    jest.doMock('electron', () => ({
      contextBridge: {
        exposeInMainWorld: jest.fn()
      },
      ipcRenderer: {
        invoke: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn()
      }
    }));
    
    const { contextBridge: cb, ipcRenderer: ipc } = require('electron');
    mockContextBridge = cb;
    mockIpcRenderer = ipc;
    
    // Reset window object
    delete (global as any).window;
    (global as any).window = {};
  });

  it('should expose mythalAPI to main world', () => {
    // Load the preload script
    require('../preload');

    expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'mythalAPI',
      expect.any(Object)
    );
  });

  it('should create terminal API methods', () => {
    require('../preload');

    const exposedAPI = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    
    expect(exposedAPI.terminal).toBeDefined();
    expect(exposedAPI.terminal.create).toBeDefined();
    expect(exposedAPI.terminal.write).toBeDefined();
    expect(exposedAPI.terminal.resize).toBeDefined();
    expect(exposedAPI.terminal.destroy).toBeDefined();
    expect(exposedAPI.terminal.onOutput).toBeDefined();
    expect(exposedAPI.terminal.onExit).toBeDefined();
  });

  it('should create Claude API methods', () => {
    require('../preload');

    const exposedAPI = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    
    expect(exposedAPI.claude).toBeDefined();
    expect(exposedAPI.claude.send).toBeDefined();
    expect(exposedAPI.claude.status).toBeDefined();
    expect(exposedAPI.claude.start).toBeDefined();
    expect(exposedAPI.claude.startAll).toBeDefined();
    expect(exposedAPI.claude.onOutput).toBeDefined();
    expect(exposedAPI.claude.onError).toBeDefined();
    expect(exposedAPI.claude.onStarted).toBeDefined();
    expect(exposedAPI.claude.onFailed).toBeDefined();
  });

  it('should create context API methods', () => {
    require('../preload');

    const exposedAPI = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    
    expect(exposedAPI.context).toBeDefined();
    expect(exposedAPI.context.save).toBeDefined();
    expect(exposedAPI.context.get).toBeDefined();
    expect(exposedAPI.context.update).toBeDefined();
    expect(exposedAPI.context.delete).toBeDefined();
  });

  it('should create other API methods', () => {
    require('../preload');

    const exposedAPI = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    
    expect(exposedAPI.chat).toBeDefined();
    expect(exposedAPI.clipboard).toBeDefined();
    expect(exposedAPI.resumework).toBeDefined();
    expect(exposedAPI.tokens).toBeDefined();
  });

  it('should handle terminal create method', async () => {
    mockIpcRenderer.invoke.mockResolvedValue({ success: true });
    require('../preload');

    const exposedAPI = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    
    const result = await exposedAPI.terminal.create('test-terminal');
    
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('terminal:create', 'test-terminal');
    expect(result).toEqual({ success: true });
  });

  it('should handle terminal write method', async () => {
    mockIpcRenderer.invoke.mockResolvedValue({ success: true });
    require('../preload');

    const exposedAPI = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    
    const result = await exposedAPI.terminal.write('test-terminal', 'command');
    
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('terminal:write', 'test-terminal', 'command');
    expect(result).toEqual({ success: true });
  });

  it('should handle terminal resize method', async () => {
    mockIpcRenderer.invoke.mockResolvedValue({ success: true });
    require('../preload');

    const exposedAPI = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    
    const result = await exposedAPI.terminal.resize('test-terminal', 80, 24);
    
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('terminal:resize', 'test-terminal', 80, 24);
    expect(result).toEqual({ success: true });
  });

  it('should handle terminal destroy method', async () => {
    mockIpcRenderer.invoke.mockResolvedValue({ success: true });
    require('../preload');

    const exposedAPI = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    
    const result = await exposedAPI.terminal.destroy('test-terminal');
    
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('terminal:destroy', 'test-terminal');
    expect(result).toEqual({ success: true });
  });

  it('should handle terminal event listeners', () => {
    require('../preload');

    const exposedAPI = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    
    const callback = jest.fn();
    const unsubscribe = exposedAPI.terminal.onOutput('test-terminal', callback);
    
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('terminal:output:test-terminal', expect.any(Function));
    expect(typeof unsubscribe).toBe('function');
  });

  it('should handle Claude methods', async () => {
    mockIpcRenderer.invoke.mockResolvedValue({ success: true });
    require('../preload');

    const exposedAPI = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    
    // Test send
    await exposedAPI.claude.send('main', 'message');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:send', 'main', 'message');
    
    // Test status
    await exposedAPI.claude.status('main');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:status', 'main');
    
    // Test start
    await exposedAPI.claude.start('main');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:start', 'main');
    
    // Test startAll
    await exposedAPI.claude.startAll();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:startAll');
  });

  it('should handle context methods', async () => {
    mockIpcRenderer.invoke.mockResolvedValue({ success: true });
    require('../preload');

    const exposedAPI = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    
    const layer = {
      project_path: '/test',
      layer_type: 'active',
      content: 'test',
      tokens: 100,
      is_starred: false,
      is_immutable: false,
      source: 'user'
    };
    
    // Test save
    await exposedAPI.context.save(layer);
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('context:save', layer);
    
    // Test get
    await exposedAPI.context.get('/test/project');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('context:get', '/test/project');
    
    // Test update
    await exposedAPI.context.update(123, { is_starred: true });
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('context:update', 123, { is_starred: true });
    
    // Test delete
    await exposedAPI.context.delete(123);
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('context:delete', 123);
  });

  it('should handle other API methods', async () => {
    mockIpcRenderer.invoke.mockResolvedValue({ success: true });
    require('../preload');

    const exposedAPI = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    
    // Test chat archive
    await exposedAPI.chat.archive('/test', 'conversation', 100, {});
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('chat:archive', '/test', 'conversation', 100, {});
    
    // Test clipboard save
    await exposedAPI.clipboard.save('content', 'category', ['tag']);
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('clipboard:save', 'content', 'category', ['tag']);
    
    // Test clipboard get
    await exposedAPI.clipboard.get('category');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('clipboard:get', 'category');
    
    // Test resumework save
    await exposedAPI.resumework.save('/test', 'content', 100);
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('resumework:save', '/test', 'content', 100);
    
    // Test resumework get
    await exposedAPI.resumework.get('/test');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('resumework:get', '/test');
    
    // Test tokens record
    await exposedAPI.tokens.record(100, 95, 75.5, 'warning');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('tokens:record', 100, 95, 75.5, 'warning');
  });

  it('should handle event listeners with proper cleanup', () => {
    require('../preload');

    const exposedAPI = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    
    const callback = jest.fn();
    
    // Test terminal onOutput
    const unsubscribeOutput = exposedAPI.terminal.onOutput('test-terminal', callback);
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('terminal:output:test-terminal', expect.any(Function));
    
    // Test unsubscribe
    unsubscribeOutput();
    expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('terminal:output:test-terminal', expect.any(Function));
    
    // Test terminal onExit
    const unsubscribeExit = exposedAPI.terminal.onExit('test-terminal', callback);
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('terminal:exit:test-terminal', expect.any(Function));
    
    // Test Claude event listeners
    const unsubscribeClaudeOutput = exposedAPI.claude.onOutput('main', callback);
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('claude:output:main', expect.any(Function));
    
    const unsubscribeClaudeError = exposedAPI.claude.onError('main', callback);
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('claude:error:main', expect.any(Function));
    
    const unsubscribeClaudeStarted = exposedAPI.claude.onStarted(callback);
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('claude:started', expect.any(Function));
    
    const unsubscribeClaudeFailed = exposedAPI.claude.onFailed(callback);
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('claude:failed', expect.any(Function));
  });
});