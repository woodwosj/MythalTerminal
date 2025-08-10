import { ClaudeInstanceManager } from '../claudeManager';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';

// Mock child_process
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Mock fs/promises
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock os
jest.mock('os');
const mockOs = os as jest.Mocked<typeof os>;

// Mock path
jest.mock('path');
const mockPath = path as jest.Mocked<typeof path>;

// Mock process.cwd
const originalCwd = process.cwd;
beforeAll(() => {
  process.cwd = jest.fn(() => '/test/project');
});

afterAll(() => {
  process.cwd = originalCwd;
});

// Create mock ChildProcess
class MockChildProcess extends EventEmitter {
  stdin = {
    write: jest.fn(),
    end: jest.fn(),
    destroyed: false,
    destroy: jest.fn()
  };
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  exitCode: number | null = null;
  pid = 12345;
  removeAllListeners = jest.fn();

  kill = jest.fn((signal?: string) => {
    this.killed = true;
    this.exitCode = 0;
    setImmediate(() => this.emit('exit', 0, signal));
    return true;
  });
}

describe('ClaudeInstanceManager - Comprehensive Tests', () => {
  let manager: ClaudeInstanceManager;
  let mockProcess: MockChildProcess;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    manager = new ClaudeInstanceManager();
    mockProcess = new MockChildProcess();

    // Setup default mocks
    mockSpawn.mockReturnValue(mockProcess as any);
    mockOs.homedir.mockReturnValue('/home/testuser');
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.dirname.mockReturnValue('/test');
    mockPath.basename.mockReturnValue('project');
    mockFs.readdir.mockResolvedValue(['project1', 'project2'] as any);
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
    mockFs.access.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    manager.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize with default instances', async () => {
      await manager.initialize();
      
      expect(manager.getStatus('main')).toBe('idle');
      expect(manager.getStatus('contextManager')).toBe('idle');
      expect(manager.getStatus('summarizer')).toBe('idle');
      expect(manager.getStatus('planner')).toBe('idle');
    });

    it('should detect Claude config from multiple paths', async () => {
      const mockConfig = { mcpServers: ['server1'], customSetting: true };
      mockFs.readFile
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce(JSON.stringify(mockConfig))
        .mockRejectedValueOnce(new Error('ENOENT'));

      await manager.initialize();
      
      expect(mockFs.readFile).toHaveBeenCalledTimes(3);
      expect(mockFs.readFile).toHaveBeenCalledWith('/test/project/.claude/settings.local.json', 'utf-8');
      expect(mockFs.readFile).toHaveBeenCalledWith('/test/project/.claude/settings.json', 'utf-8');
      expect(mockFs.readFile).toHaveBeenCalledWith('/home/testuser/.claude/settings.json', 'utf-8');
    });

    it('should handle invalid JSON in config files gracefully', async () => {
      mockFs.readFile.mockResolvedValue('invalid json');

      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should discover working directories with git repositories', async () => {
      mockFs.readdir.mockResolvedValue(['project1', 'project2', 'not-git-repo'] as any);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.access
        .mockResolvedValueOnce(undefined) // project1 has .git
        .mockResolvedValueOnce(undefined) // project2 has .git  
        .mockRejectedValueOnce(new Error('ENOENT')); // not-git-repo doesn't have .git

      await manager.initialize();
      
      expect(mockFs.access).toHaveBeenCalledWith('/test/project1/.git');
      expect(mockFs.access).toHaveBeenCalledWith('/test/project2/.git');
      expect(mockFs.access).toHaveBeenCalledWith('/test/not-git-repo/.git');
    });

    it('should handle errors during working directory discovery', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should merge multiple config files correctly', async () => {
      const config1 = { mcpServers: ['server1'], setting1: 'value1' };
      const config2 = { mcpServers: ['server2'], setting2: 'value2' };
      
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(config1))
        .mockResolvedValueOnce(JSON.stringify(config2))
        .mockRejectedValueOnce(new Error('ENOENT'));

      await manager.initialize();
      
      // Should have merged mcpServers and settings
    });
  });

  describe('Instance Spawning', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should spawn Claude instance with correct arguments', async () => {
      await manager.spawnInstance('main');

      expect(mockSpawn).toHaveBeenCalledWith('claude', [
        '--no-interactive',
        '--model', 'claude-3-5-sonnet-20241022',
        '--add-dir', '/test/project'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: expect.objectContaining({
          CLAUDE_PROMPT: expect.stringContaining('main terminal assistant')
        })
      });
    });

    it('should include working directories in spawn arguments', async () => {
      // Setup config with multiple working dirs
      mockFs.readdir.mockResolvedValue(['sibling1', 'sibling2'] as any);
      mockFs.access.mockResolvedValue(undefined);
      
      await manager.initialize();
      await manager.spawnInstance('main');

      expect(mockSpawn).toHaveBeenCalledWith('claude', 
        expect.arrayContaining([
          '--add-dir', '/test/project', '/test/sibling1', '/test/sibling2'
        ]), 
        expect.any(Object)
      );
    });

    it('should not spawn if instance is already running', async () => {
      await manager.spawnInstance('main');
      mockSpawn.mockClear();

      await manager.spawnInstance('main');

      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should throw error for unknown instance', async () => {
      await expect(manager.spawnInstance('unknown')).rejects.toThrow('Unknown instance: unknown');
    });

    it('should set correct status during spawn lifecycle', async () => {
      expect(manager.getStatus('main')).toBe('idle');

      const spawnPromise = manager.spawnInstance('main');
      expect(manager.getStatus('main')).toBe('restarting');

      await spawnPromise;
      expect(manager.getStatus('main')).toBe('running');
    });

    it('should write initial prompt to stdin after spawn', async () => {
      await manager.spawnInstance('main');

      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('main terminal assistant') + '\n'
      );
    });

    it('should emit instance:started event', async () => {
      const startedSpy = jest.fn();
      manager.on('instance:started', startedSpy);

      await manager.spawnInstance('main');

      expect(startedSpy).toHaveBeenCalledWith('main');
    });

    it('should handle spawn errors gracefully', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      await manager.spawnInstance('main');

      expect(manager.getStatus('main')).toBe('crashed');
    });

    it('should setup stdout and stderr event listeners', async () => {
      const outputSpy = jest.fn();
      const errorSpy = jest.fn();
      
      manager.on('main:output', outputSpy);
      manager.on('main:error', errorSpy);

      await manager.spawnInstance('main');

      mockProcess.stdout.emit('data', Buffer.from('test output'));
      mockProcess.stderr.emit('data', Buffer.from('test error'));

      expect(outputSpy).toHaveBeenCalledWith('test output');
      expect(errorSpy).toHaveBeenCalledWith('test error');
    });
  });

  describe('Crash Handling and Recovery', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should handle process exit and trigger restart', async () => {
      await manager.spawnInstance('main');
      
      expect(manager.getStatus('main')).toBe('running');
      mockProcess.emit('exit', 1, null);

      expect(manager.getStatus('main')).toBe('crashed');
    });

    it('should handle process error and trigger restart', async () => {
      await manager.spawnInstance('main');
      
      expect(manager.getStatus('main')).toBe('running');
      mockProcess.emit('error', new Error('Process error'));

      expect(manager.getStatus('main')).toBe('crashed');
    });

    it('should restart crashed instance after delay', async () => {
      await manager.spawnInstance('main');
      
      mockSpawn.mockClear();
      mockProcess.emit('exit', 1, null);

      // Fast forward past the restart delay
      jest.advanceTimersByTime(1000);
      await Promise.resolve(); // Allow async operations to complete

      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff for restart attempts', async () => {
      await manager.spawnInstance('main');
      
      // First crash
      mockProcess.emit('exit', 1, null);
      jest.advanceTimersByTime(1000);
      
      // Second crash within 10 seconds
      mockProcess.emit('exit', 1, null);
      jest.advanceTimersByTime(2000);
      
      // Third crash within 10 seconds
      mockProcess.emit('exit', 1, null);
      jest.advanceTimersByTime(4000);

      expect(manager.getStatus('main')).toBe('crashed');
    });

    it('should reset restart attempts after successful run', async () => {
      await manager.spawnInstance('main');
      
      // First crash
      mockProcess.emit('exit', 1, null);
      
      // Wait more than 10 seconds
      jest.advanceTimersByTime(15000);
      
      // Second crash should reset attempt counter
      mockProcess.emit('exit', 1, null);
      
      // Should use initial delay, not exponential
      jest.advanceTimersByTime(1000);
      
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should stop restarting after 3 failed attempts', async () => {
      await manager.spawnInstance('main');
      const failedSpy = jest.fn();
      manager.on('instance:failed', failedSpy);

      // Simulate 3 quick failures
      for (let i = 0; i < 3; i++) {
        mockProcess.emit('exit', 1, null);
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      }

      expect(failedSpy).toHaveBeenCalledWith('main');
      expect(manager.getStatus('main')).toBe('crashed');
    });

    it('should not queue multiple restarts for same instance', async () => {
      await manager.spawnInstance('main');
      
      // Trigger multiple crashes quickly
      mockProcess.emit('exit', 1, null);
      mockProcess.emit('exit', 1, null);
      mockProcess.emit('exit', 1, null);

      jest.advanceTimersByTime(5000);
      
      // Should only have one restart queued
      expect(mockSpawn).toHaveBeenCalledTimes(2); // Original + 1 restart
    });

    it('should cap restart delay at 10 seconds', async () => {
      await manager.spawnInstance('main');
      
      // Simulate many quick failures to test delay cap
      for (let i = 0; i < 10; i++) {
        mockProcess.emit('exit', 1, null);
        jest.advanceTimersByTime(1000);
      }

      // Delay should be capped at 10000ms
      expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 10000);
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should send message to running instance', async () => {
      await manager.spawnInstance('main');

      await manager.sendToInstance('main', 'test message');

      expect(mockProcess.stdin.write).toHaveBeenCalledWith('test message\n');
    });

    it('should spawn instance if not running before sending message', async () => {
      mockSpawn.mockClear();

      await manager.sendToInstance('main', 'test message');

      expect(mockSpawn).toHaveBeenCalled();
      expect(mockProcess.stdin.write).toHaveBeenCalledWith('test message\n');
    });

    it('should wait for instance to be ready before sending', async () => {
      const sendPromise = manager.sendToInstance('main', 'test message');
      
      // Advance timers to complete the spawn delay
      jest.advanceTimersByTime(1000);
      await sendPromise;

      expect(mockProcess.stdin.write).toHaveBeenCalledWith('test message\n');
    });

    it('should throw error if instance cannot be spawned', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new MockChildProcess();
        proc.stdin = null as any;
        return proc as any;
      });

      await expect(manager.sendToInstance('main', 'test message'))
        .rejects.toThrow('Claude instance main is not available');
    });

    it('should handle null stdin gracefully', async () => {
      await manager.spawnInstance('main');
      (mockProcess as any).stdin = null;

      await expect(manager.sendToInstance('main', 'test message'))
        .rejects.toThrow('Claude instance main is not available');
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should start all instances with delay', async () => {
      await manager.startAll();

      expect(mockSpawn).toHaveBeenCalledTimes(4); // main, contextManager, summarizer, planner
      expect(manager.getStatus('main')).toBe('running');
      expect(manager.getStatus('contextManager')).toBe('running');
      expect(manager.getStatus('summarizer')).toBe('running');
      expect(manager.getStatus('planner')).toBe('running');
    });

    it('should include delay between instance starts', async () => {
      const startPromise = manager.startAll();
      
      jest.advanceTimersByTime(2000); // 4 instances * 500ms delay
      await startPromise;

      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 500);
    });

    it('should shutdown all running instances', () => {
      manager.spawnInstance('main');
      manager.spawnInstance('contextManager');

      manager.shutdown();

      expect(mockProcess.kill).toHaveBeenCalledTimes(2);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(manager.getStatus('main')).toBe('idle');
      expect(manager.getStatus('contextManager')).toBe('idle');
    });

    it('should get all instance statuses', async () => {
      await manager.spawnInstance('main');
      
      const statuses = manager.getAllStatuses();

      expect(statuses).toEqual({
        main: 'running',
        contextManager: 'idle',
        summarizer: 'idle',
        planner: 'idle'
      });
    });
  });

  describe('Status Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should return unknown for non-existent instance', () => {
      expect(manager.getStatus('nonexistent')).toBe('unknown');
    });

    it('should track status changes through lifecycle', async () => {
      expect(manager.getStatus('main')).toBe('idle');

      const spawnPromise = manager.spawnInstance('main');
      expect(manager.getStatus('main')).toBe('restarting');

      await spawnPromise;
      expect(manager.getStatus('main')).toBe('running');

      mockProcess.emit('exit', 0, null);
      expect(manager.getStatus('main')).toBe('crashed');

      manager.shutdown();
      expect(manager.getStatus('main')).toBe('idle');
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should emit correct events during lifecycle', async () => {
      const events: string[] = [];
      
      manager.on('instance:started', (instance) => events.push(`started:${instance}`));
      manager.on('instance:failed', (instance) => events.push(`failed:${instance}`));
      manager.on('main:output', (data) => events.push(`output:${data}`));
      manager.on('main:error', (data) => events.push(`error:${data}`));

      await manager.spawnInstance('main');
      mockProcess.stdout.emit('data', 'test');
      mockProcess.stderr.emit('data', 'error');

      expect(events).toContain('started:main');
      expect(events).toContain('output:test');
      expect(events).toContain('error:error');
    });

    it('should handle multiple listeners correctly', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      manager.on('instance:started', listener1);
      manager.on('instance:started', listener2);

      await manager.spawnInstance('main');

      expect(listener1).toHaveBeenCalledWith('main');
      expect(listener2).toHaveBeenCalledWith('main');
    });

    it('should clean up event listeners on shutdown', () => {
      const outputSpy = jest.fn();
      manager.on('main:output', outputSpy);

      manager.spawnInstance('main');
      manager.shutdown();

      mockProcess.stdout.emit('data', 'should not trigger');
      expect(outputSpy).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should handle process kill failure gracefully', async () => {
      await manager.spawnInstance('main');
      mockProcess.kill.mockReturnValue(false);

      expect(() => manager.shutdown()).not.toThrow();
    });

    it('should handle corrupted instance state', async () => {
      await manager.spawnInstance('main');
      
      // Corrupt the instance state
      (manager as any).instances.set('main', { 
        ...manager.getAllStatuses(),
        process: null,
        status: 'running' 
      });

      await expect(manager.sendToInstance('main', 'test')).resolves.not.toThrow();
    });

    it('should handle rapid start/stop cycles', async () => {
      for (let i = 0; i < 5; i++) {
        await manager.spawnInstance('main');
        manager.shutdown();
      }

      expect(manager.getStatus('main')).toBe('idle');
    });

    it('should handle concurrent spawn requests', async () => {
      const promises = [
        manager.spawnInstance('main'),
        manager.spawnInstance('main'),
        manager.spawnInstance('main')
      ];

      await Promise.all(promises);

      // Should only spawn once
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should handle memory cleanup on repeated crashes', async () => {
      for (let i = 0; i < 10; i++) {
        await manager.spawnInstance('main');
        mockProcess.emit('exit', 1, null);
        jest.advanceTimersByTime(15000); // Reset restart attempts
      }

      expect(manager.getStatus('main')).toBe('crashed');
    });

    it('should handle very long messages', async () => {
      await manager.spawnInstance('main');
      const longMessage = 'x'.repeat(100000);

      await expect(manager.sendToInstance('main', longMessage)).resolves.not.toThrow();
      expect(mockProcess.stdin.write).toHaveBeenCalledWith(longMessage + '\n');
    });

    it('should handle special characters in messages', async () => {
      await manager.spawnInstance('main');
      const specialMessage = 'test\n\r\t"\'\\message';

      await manager.sendToInstance('main', specialMessage);

      expect(mockProcess.stdin.write).toHaveBeenCalledWith(specialMessage + '\n');
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle empty config files', async () => {
      mockFs.readFile.mockResolvedValue('{}');

      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should handle config files with only comments', async () => {
      mockFs.readFile.mockResolvedValue('// This is a comment\n{}');

      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should handle very deep directory structures', async () => {
      const deepPath = '/a/very/deep/directory/structure/that/goes/on/forever';
      process.cwd = jest.fn(() => deepPath);

      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should handle circular directory references', async () => {
      mockFs.readdir.mockResolvedValue(['..', '.', 'project'] as any);

      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should handle permission errors during config detection', async () => {
      mockFs.readFile.mockRejectedValue(new Error('EPERM: operation not permitted'));

      await expect(manager.initialize()).resolves.not.toThrow();
    });
  });
});