/**
 * Enhanced comprehensive tests for preload.ts
 * Testing all IPC bridge functionality and edge cases
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

describe('Preload Script Enhanced Tests', () => {
  let mockContextBridge: any;
  let mockIpcRenderer: any;
  let exposedAPI: any;

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

  const getExposedAPI = () => {
    require('../preload');
    return mockContextBridge.exposeInMainWorld.mock.calls[0][1];
  };

  describe('API Structure and Exposure', () => {
    it('should expose mythalAPI to main world', () => {
      require('../preload');

      expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        'mythalAPI',
        expect.any(Object)
      );
    });

    it('should have all required API sections', () => {
      const api = getExposedAPI();
      
      expect(api).toHaveProperty('terminal');
      expect(api).toHaveProperty('claude');
      expect(api).toHaveProperty('context');
      expect(api).toHaveProperty('chat');
      expect(api).toHaveProperty('clipboard');
      expect(api).toHaveProperty('resumework');
      expect(api).toHaveProperty('tokens');
    });

    it('should have consistent API structure', () => {
      const api = getExposedAPI();
      
      // Terminal API
      expect(api.terminal).toHaveProperty('create');
      expect(api.terminal).toHaveProperty('write');
      expect(api.terminal).toHaveProperty('resize');
      expect(api.terminal).toHaveProperty('destroy');
      expect(api.terminal).toHaveProperty('onOutput');
      expect(api.terminal).toHaveProperty('onExit');

      // Claude API
      expect(api.claude).toHaveProperty('send');
      expect(api.claude).toHaveProperty('status');
      expect(api.claude).toHaveProperty('start');
      expect(api.claude).toHaveProperty('startAll');
      expect(api.claude).toHaveProperty('onOutput');
      expect(api.claude).toHaveProperty('onError');
      expect(api.claude).toHaveProperty('onStarted');
      expect(api.claude).toHaveProperty('onFailed');

      // Context API
      expect(api.context).toHaveProperty('save');
      expect(api.context).toHaveProperty('get');
      expect(api.context).toHaveProperty('update');
      expect(api.context).toHaveProperty('delete');

      // Other APIs
      expect(api.chat).toHaveProperty('archive');
      expect(api.clipboard).toHaveProperty('save');
      expect(api.clipboard).toHaveProperty('get');
      expect(api.resumework).toHaveProperty('save');
      expect(api.resumework).toHaveProperty('get');
      expect(api.tokens).toHaveProperty('record');
    });
  });

  describe('Terminal API Comprehensive Tests', () => {
    it('should handle terminal.create with various IDs', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      
      const testCases = [
        'simple-id',
        'terminal-123',
        'terminal_with_underscores',
        'terminal-with-dashes-and-numbers-456',
        ''  // edge case: empty string
      ];

      for (const terminalId of testCases) {
        mockIpcRenderer.invoke.mockClear();
        await api.terminal.create(terminalId);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('terminal:create', terminalId);
      }
    });

    it('should handle terminal.write with various data types', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      
      const testCases = [
        { id: 'term1', data: 'simple command' },
        { id: 'term2', data: 'command with special chars !@#$%^&*()' },
        { id: 'term3', data: 'command\nwith\nnewlines' },
        { id: 'term4', data: 'command\twith\ttabs' },
        { id: 'term5', data: '' }, // empty data
        { id: 'term6', data: '  spaced  command  ' },
        { id: 'term7', data: 'unicode: 你好 🚀 ñáéíóú' }
      ];

      for (const testCase of testCases) {
        mockIpcRenderer.invoke.mockClear();
        await api.terminal.write(testCase.id, testCase.data);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('terminal:write', testCase.id, testCase.data);
      }
    });

    it('should handle terminal.resize with various dimensions', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      
      const testCases = [
        { id: 'term1', cols: 80, rows: 24 },  // standard
        { id: 'term2', cols: 120, rows: 30 }, // larger
        { id: 'term3', cols: 40, rows: 12 },  // smaller
        { id: 'term4', cols: 1, rows: 1 },    // minimum
        { id: 'term5', cols: 300, rows: 100 }, // very large
        { id: 'term6', cols: 0, rows: 0 }     // edge case: zero
      ];

      for (const testCase of testCases) {
        mockIpcRenderer.invoke.mockClear();
        await api.terminal.resize(testCase.id, testCase.cols, testCase.rows);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('terminal:resize', testCase.id, testCase.cols, testCase.rows);
      }
    });

    it('should handle terminal event listeners with proper channels', () => {
      const api = getExposedAPI();
      const callback = jest.fn();
      
      // Test onOutput
      const unsubscribeOutput = api.terminal.onOutput('test-terminal', callback);
      expect(mockIpcRenderer.on).toHaveBeenCalledWith('terminal:output:test-terminal', expect.any(Function));
      expect(typeof unsubscribeOutput).toBe('function');

      // Test onExit
      const unsubscribeExit = api.terminal.onExit('test-terminal', callback);
      expect(mockIpcRenderer.on).toHaveBeenCalledWith('terminal:exit:test-terminal', expect.any(Function));
      expect(typeof unsubscribeExit).toBe('function');
    });

    it('should handle terminal event callbacks correctly', () => {
      const api = getExposedAPI();
      const callback = jest.fn();
      
      api.terminal.onOutput('test-terminal', callback);
      
      // Get the registered handler
      const registeredHandler = mockIpcRenderer.on.mock.calls[0][1];
      
      // Simulate event with data
      const testData = 'output data';
      registeredHandler('event', testData);
      
      expect(callback).toHaveBeenCalledWith(testData);
    });

    it('should handle terminal event unsubscription', () => {
      const api = getExposedAPI();
      const callback = jest.fn();
      
      const unsubscribe = api.terminal.onOutput('test-terminal', callback);
      const registeredHandler = mockIpcRenderer.on.mock.calls[0][1];
      
      // Call unsubscribe
      unsubscribe();
      
      expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('terminal:output:test-terminal', registeredHandler);
    });

    it('should handle errors in terminal API calls', async () => {
      const error = new Error('Terminal operation failed');
      mockIpcRenderer.invoke.mockRejectedValue(error);
      const api = getExposedAPI();
      
      await expect(api.terminal.create('test-terminal')).rejects.toThrow('Terminal operation failed');
      await expect(api.terminal.write('test-terminal', 'data')).rejects.toThrow('Terminal operation failed');
      await expect(api.terminal.resize('test-terminal', 80, 24)).rejects.toThrow('Terminal operation failed');
      await expect(api.terminal.destroy('test-terminal')).rejects.toThrow('Terminal operation failed');
    });
  });

  describe('Claude API Comprehensive Tests', () => {
    it('should handle claude.send with various message types', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      
      const testCases = [
        { instance: 'main', message: 'simple message' },
        { instance: 'contextManager', message: 'message with\nmultiple lines' },
        { instance: 'summarizer', message: 'message with "quotes" and \'apostrophes\'' },
        { instance: 'planner', message: 'message with json {"key": "value"}' },
        { instance: 'custom-instance', message: '' }, // empty message
        { instance: 'test', message: 'very long message '.repeat(100) }
      ];

      for (const testCase of testCases) {
        mockIpcRenderer.invoke.mockClear();
        await api.claude.send(testCase.instance, testCase.message);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:send', testCase.instance, testCase.message);
      }
    });

    it('should handle claude.status with and without instance key', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true, statuses: {} });
      const api = getExposedAPI();
      
      // Without instance key
      await api.claude.status();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:status', undefined);
      
      // With instance key
      mockIpcRenderer.invoke.mockClear();
      await api.claude.status('main');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:status', 'main');
    });

    it('should handle claude.start with various instance keys', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      
      const instanceKeys = ['main', 'contextManager', 'summarizer', 'planner', 'custom-instance-123'];
      
      for (const instanceKey of instanceKeys) {
        mockIpcRenderer.invoke.mockClear();
        await api.claude.start(instanceKey);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:start', instanceKey);
      }
    });

    it('should handle claude.startAll', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      
      await api.claude.startAll();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:startAll');
    });

    it('should handle claude event listeners', () => {
      const api = getExposedAPI();
      const callback = jest.fn();
      
      // Test all claude event listeners
      const unsubscribeOutput = api.claude.onOutput('main', callback);
      const unsubscribeError = api.claude.onError('main', callback);
      const unsubscribeStarted = api.claude.onStarted(callback);
      const unsubscribeFailed = api.claude.onFailed(callback);
      
      expect(mockIpcRenderer.on).toHaveBeenCalledWith('claude:output:main', expect.any(Function));
      expect(mockIpcRenderer.on).toHaveBeenCalledWith('claude:error:main', expect.any(Function));
      expect(mockIpcRenderer.on).toHaveBeenCalledWith('claude:started', expect.any(Function));
      expect(mockIpcRenderer.on).toHaveBeenCalledWith('claude:failed', expect.any(Function));
      
      expect(typeof unsubscribeOutput).toBe('function');
      expect(typeof unsubscribeError).toBe('function');
      expect(typeof unsubscribeStarted).toBe('function');
      expect(typeof unsubscribeFailed).toBe('function');
    });

    it('should handle claude event callbacks with proper data', () => {
      const api = getExposedAPI();
      const callback = jest.fn();
      
      // Test onOutput
      api.claude.onOutput('main', callback);
      const outputHandler = mockIpcRenderer.on.mock.calls[0][1];
      outputHandler('event', 'output data');
      expect(callback).toHaveBeenCalledWith('output data');
      
      // Test onError
      mockIpcRenderer.on.mockClear();
      callback.mockClear();
      api.claude.onError('main', callback);
      const errorHandler = mockIpcRenderer.on.mock.calls[0][1];
      errorHandler('event', 'error message');
      expect(callback).toHaveBeenCalledWith('error message');
      
      // Test onStarted
      mockIpcRenderer.on.mockClear();
      callback.mockClear();
      api.claude.onStarted(callback);
      const startedHandler = mockIpcRenderer.on.mock.calls[0][1];
      startedHandler('event', 'instanceKey');
      expect(callback).toHaveBeenCalledWith('instanceKey');
      
      // Test onFailed
      mockIpcRenderer.on.mockClear();
      callback.mockClear();
      api.claude.onFailed(callback);
      const failedHandler = mockIpcRenderer.on.mock.calls[0][1];
      failedHandler('event', 'instanceKey');
      expect(callback).toHaveBeenCalledWith('instanceKey');
    });

    it('should handle errors in claude API calls', async () => {
      const error = new Error('Claude operation failed');
      mockIpcRenderer.invoke.mockRejectedValue(error);
      const api = getExposedAPI();
      
      await expect(api.claude.send('main', 'message')).rejects.toThrow('Claude operation failed');
      await expect(api.claude.status()).rejects.toThrow('Claude operation failed');
      await expect(api.claude.start('main')).rejects.toThrow('Claude operation failed');
      await expect(api.claude.startAll()).rejects.toThrow('Claude operation failed');
    });
  });

  describe('Context API Comprehensive Tests', () => {
    it('should handle context.save with various layer structures', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true, id: 123 });
      const api = getExposedAPI();
      
      const testLayers = [
        {
          project_path: '/test/project',
          layer_type: 'active',
          content: 'simple content',
          tokens: 100,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        },
        {
          project_path: '/another/project',
          layer_type: 'core',
          content: 'starred content with special chars: !@#$%^&*()',
          tokens: 250,
          is_starred: true,
          is_immutable: true,
          source: 'ai'
        },
        {
          project_path: '/project/with/unicode',
          layer_type: 'reference',
          content: 'unicode content: 你好 🌟 ñáéíóú',
          tokens: 500,
          is_starred: false,
          is_immutable: false,
          source: 'system'
        }
      ];

      for (const layer of testLayers) {
        mockIpcRenderer.invoke.mockClear();
        await api.context.save(layer);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('context:save', layer);
      }
    });

    it('should handle context.get with various project paths', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true, layers: [] });
      const api = getExposedAPI();
      
      const testPaths = [
        '/simple/path',
        '/path/with spaces/in it',
        '/path/with-dashes-and_underscores',
        '/very/deeply/nested/project/structure/path',
        '/',
        '',
        '/path/with/unicode/你好'
      ];

      for (const projectPath of testPaths) {
        mockIpcRenderer.invoke.mockClear();
        await api.context.get(projectPath);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('context:get', projectPath);
      }
    });

    it('should handle context.update with various update objects', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      
      const testCases = [
        { id: 1, updates: { is_starred: true } },
        { id: 2, updates: { content: 'updated content', tokens: 150 } },
        { id: 3, updates: { layer_type: 'archive', is_immutable: true } },
        { id: 4, updates: { project_path: '/new/path', source: 'ai' } },
        { id: 5, updates: {} } // empty updates
      ];

      for (const testCase of testCases) {
        mockIpcRenderer.invoke.mockClear();
        await api.context.update(testCase.id, testCase.updates);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('context:update', testCase.id, testCase.updates);
      }
    });

    it('should handle context.delete with various IDs', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      
      const testIds = [1, 999, 0, -1, Number.MAX_SAFE_INTEGER];

      for (const id of testIds) {
        mockIpcRenderer.invoke.mockClear();
        await api.context.delete(id);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('context:delete', id);
      }
    });

    it('should handle errors in context API calls', async () => {
      const error = new Error('Context operation failed');
      mockIpcRenderer.invoke.mockRejectedValue(error);
      const api = getExposedAPI();
      
      const layer = { project_path: '/test', layer_type: 'active', content: 'test', tokens: 100, is_starred: false, is_immutable: false, source: 'user' };
      
      await expect(api.context.save(layer)).rejects.toThrow('Context operation failed');
      await expect(api.context.get('/test')).rejects.toThrow('Context operation failed');
      await expect(api.context.update(1, {})).rejects.toThrow('Context operation failed');
      await expect(api.context.delete(1)).rejects.toThrow('Context operation failed');
    });
  });

  describe('Other APIs Comprehensive Tests', () => {
    it('should handle chat.archive with various parameters', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      
      const testCases = [
        {
          projectPath: '/project',
          conversation: 'simple conversation',
          tokens: 100,
          metadata: { user: 'test' }
        },
        {
          projectPath: '/another/project',
          conversation: 'conversation with\nmultiple lines',
          tokens: 250,
          metadata: undefined
        },
        {
          projectPath: '',
          conversation: '',
          tokens: 0,
          metadata: {}
        }
      ];

      for (const testCase of testCases) {
        mockIpcRenderer.invoke.mockClear();
        await api.chat.archive(testCase.projectPath, testCase.conversation, testCase.tokens, testCase.metadata);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('chat:archive', testCase.projectPath, testCase.conversation, testCase.tokens, testCase.metadata);
      }
    });

    it('should handle clipboard.save and clipboard.get', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      
      // Test save with various parameters
      const saveTestCases = [
        { content: 'simple content', category: 'general', tags: ['tag1', 'tag2'] },
        { content: 'content with special chars: !@#$%^&*()', category: undefined, tags: undefined },
        { content: '', category: 'empty', tags: [] },
        { content: 'unicode: 你好 🌟', category: 'unicode', tags: ['unicode', 'test'] }
      ];

      for (const testCase of saveTestCases) {
        mockIpcRenderer.invoke.mockClear();
        await api.clipboard.save(testCase.content, testCase.category, testCase.tags);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('clipboard:save', testCase.content, testCase.category, testCase.tags);
      }

      // Test get with various categories
      const getTestCases = ['general', 'code', 'notes', undefined, ''];
      
      for (const category of getTestCases) {
        mockIpcRenderer.invoke.mockClear();
        await api.clipboard.get(category);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('clipboard:get', category);
      }
    });

    it('should handle resumework.save and resumework.get', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      
      // Test save
      const saveTestCases = [
        { projectPath: '/project', content: 'work content', tokens: 150 },
        { projectPath: '/another/project', content: '', tokens: 0 },
        { projectPath: '', content: 'content without project', tokens: 100 }
      ];

      for (const testCase of saveTestCases) {
        mockIpcRenderer.invoke.mockClear();
        await api.resumework.save(testCase.projectPath, testCase.content, testCase.tokens);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('resumework:save', testCase.projectPath, testCase.content, testCase.tokens);
      }

      // Test get
      const getTestCases = ['/project1', '/project2', '', '/path/with/spaces'];
      
      for (const projectPath of getTestCases) {
        mockIpcRenderer.invoke.mockClear();
        await api.resumework.get(projectPath);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('resumework:get', projectPath);
      }
    });

    it('should handle tokens.record with various parameters', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      
      const testCases = [
        { estimated: 100, actual: 95, percentage: 50.0, warningLevel: 'safe' },
        { estimated: 200, actual: undefined, percentage: 80.0, warningLevel: 'warning' },
        { estimated: 300, actual: 295, percentage: undefined, warningLevel: 'critical' },
        { estimated: 0, actual: 0, percentage: 0, warningLevel: undefined },
        { estimated: -1, actual: -1, percentage: -1, warningLevel: 'unknown' }
      ];

      for (const testCase of testCases) {
        mockIpcRenderer.invoke.mockClear();
        await api.tokens.record(testCase.estimated, testCase.actual, testCase.percentage, testCase.warningLevel);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('tokens:record', testCase.estimated, testCase.actual, testCase.percentage, testCase.warningLevel);
      }
    });

    it('should handle errors in other API calls', async () => {
      const error = new Error('API operation failed');
      mockIpcRenderer.invoke.mockRejectedValue(error);
      const api = getExposedAPI();
      
      await expect(api.chat.archive('/project', 'conversation', 100)).rejects.toThrow('API operation failed');
      await expect(api.clipboard.save('content')).rejects.toThrow('API operation failed');
      await expect(api.clipboard.get()).rejects.toThrow('API operation failed');
      await expect(api.resumework.save('/project', 'content', 100)).rejects.toThrow('API operation failed');
      await expect(api.resumework.get('/project')).rejects.toThrow('API operation failed');
      await expect(api.tokens.record(100)).rejects.toThrow('API operation failed');
    });
  });

  describe('Event Handling Edge Cases', () => {
    it('should handle multiple event listeners on same channel', () => {
      const api = getExposedAPI();
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      const unsubscribe1 = api.terminal.onOutput('test-terminal', callback1);
      const unsubscribe2 = api.terminal.onOutput('test-terminal', callback2);
      
      expect(mockIpcRenderer.on).toHaveBeenCalledTimes(2);
      expect(mockIpcRenderer.on).toHaveBeenCalledWith('terminal:output:test-terminal', expect.any(Function));
    });

    it('should handle event listener cleanup correctly', () => {
      const api = getExposedAPI();
      const callback = jest.fn();
      
      const unsubscribe = api.claude.onOutput('main', callback);
      const handler = mockIpcRenderer.on.mock.calls[0][1];
      
      unsubscribe();
      
      expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('claude:output:main', handler);
    });

    it('should handle event listeners with null/undefined callbacks', () => {
      const api = getExposedAPI();
      
      expect(() => {
        api.terminal.onOutput('test-terminal', null as any);
      }).not.toThrow();
      
      expect(() => {
        api.claude.onError('main', undefined as any);
      }).not.toThrow();
    });

    it('should handle events with various data types', () => {
      const api = getExposedAPI();
      const callback = jest.fn();
      
      api.terminal.onOutput('test-terminal', callback);
      const handler = mockIpcRenderer.on.mock.calls[0][1];
      
      // Test various data types
      const testData = [
        'string data',
        123,
        { object: 'data' },
        ['array', 'data'],
        null,
        undefined,
        true,
        false
      ];

      for (const data of testData) {
        callback.mockClear();
        handler('event', data);
        expect(callback).toHaveBeenCalledWith(data);
      }
    });
  });

  describe('Memory Management and Performance', () => {
    it('should not leak memory with multiple subscribe/unsubscribe cycles', () => {
      const api = getExposedAPI();
      const callback = jest.fn();
      
      // Multiple subscribe/unsubscribe cycles
      for (let i = 0; i < 10; i++) {
        const unsubscribe = api.terminal.onOutput(`test-terminal-${i}`, callback);
        unsubscribe();
      }
      
      expect(mockIpcRenderer.on).toHaveBeenCalledTimes(10);
      expect(mockIpcRenderer.removeListener).toHaveBeenCalledTimes(10);
    });

    it('should handle concurrent API calls', async () => {
      mockIpcRenderer.invoke.mockImplementation((channel) => {
        return Promise.resolve({ success: true, channel });
      });
      
      const api = getExposedAPI();
      
      // Make multiple concurrent calls
      const promises = [
        api.terminal.create('term1'),
        api.terminal.create('term2'),
        api.claude.send('main', 'message1'),
        api.claude.send('contextManager', 'message2'),
        api.context.get('/project1'),
        api.context.get('/project2')
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(6);
      results.forEach(result => {
        expect(result).toHaveProperty('success', true);
      });
    });

    it('should handle rapid sequential API calls', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      
      // Rapid sequential calls
      for (let i = 0; i < 50; i++) {
        await api.terminal.write('test-terminal', `command ${i}`);
      }
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledTimes(50);
    });
  });

  describe('Type Safety and Validation', () => {
    it('should maintain type consistency for exposed API', () => {
      const api = getExposedAPI();
      
      // Check that functions are callable and return expected types
      expect(typeof api.terminal.create).toBe('function');
      expect(typeof api.claude.send).toBe('function');
      expect(typeof api.context.save).toBe('function');
      
      // Check that event listeners return functions
      expect(typeof api.terminal.onOutput('test', () => {})).toBe('function');
      expect(typeof api.claude.onStarted(() => {})).toBe('function');
    });

    it('should handle API calls with missing parameters gracefully', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      
      // These should not throw but may pass undefined to IPC
      await api.terminal.create(undefined as any);
      await api.claude.send(undefined as any, undefined as any);
      await api.context.update(undefined as any, undefined as any);
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('terminal:create', undefined);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:send', undefined, undefined);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('context:update', undefined, undefined);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle typical terminal workflow', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      const outputCallback = jest.fn();
      const exitCallback = jest.fn();
      
      // Create terminal
      await api.terminal.create('workflow-terminal');
      
      // Set up listeners
      const unsubscribeOutput = api.terminal.onOutput('workflow-terminal', outputCallback);
      const unsubscribeExit = api.terminal.onExit('workflow-terminal', exitCallback);
      
      // Write commands
      await api.terminal.write('workflow-terminal', 'ls -la');
      await api.terminal.write('workflow-terminal', 'cd /home');
      
      // Resize terminal
      await api.terminal.resize('workflow-terminal', 120, 30);
      
      // Cleanup
      unsubscribeOutput();
      unsubscribeExit();
      await api.terminal.destroy('workflow-terminal');
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('terminal:create', 'workflow-terminal');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('terminal:write', 'workflow-terminal', 'ls -la');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('terminal:write', 'workflow-terminal', 'cd /home');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('terminal:resize', 'workflow-terminal', 120, 30);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('terminal:destroy', 'workflow-terminal');
    });

    it('should handle typical claude workflow', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });
      const api = getExposedAPI();
      const outputCallback = jest.fn();
      const errorCallback = jest.fn();
      
      // Set up listeners
      const unsubscribeOutput = api.claude.onOutput('main', outputCallback);
      const unsubscribeError = api.claude.onError('main', errorCallback);
      
      // Start instances
      await api.claude.start('main');
      await api.claude.startAll();
      
      // Send messages
      await api.claude.send('main', 'Hello Claude');
      await api.claude.send('contextManager', 'Process this context');
      
      // Check status
      await api.claude.status();
      await api.claude.status('main');
      
      // Cleanup
      unsubscribeOutput();
      unsubscribeError();
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:start', 'main');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:startAll');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:send', 'main', 'Hello Claude');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:send', 'contextManager', 'Process this context');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:status', undefined);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('claude:status', 'main');
    });

    it('should handle typical context management workflow', async () => {
      mockIpcRenderer.invoke
        .mockResolvedValueOnce({ success: true, id: 1 })
        .mockResolvedValueOnce({ success: true, layers: [] })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true });
        
      const api = getExposedAPI();
      
      // Save new layer
      const layer = {
        project_path: '/test/project',
        layer_type: 'active',
        content: 'test content',
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user'
      };
      
      await api.context.save(layer);
      
      // Load context
      await api.context.get('/test/project');
      
      // Update layer
      await api.context.update(1, { is_starred: true });
      
      // Delete layer
      await api.context.delete(1);
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('context:save', layer);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('context:get', '/test/project');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('context:update', 1, { is_starred: true });
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('context:delete', 1);
    });
  });
});