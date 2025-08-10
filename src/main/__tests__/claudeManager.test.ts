import { ClaudeInstanceManager } from '../claudeManager';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';

jest.mock('child_process');
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockRejectedValue(new Error('ENOENT')),
  readdir: jest.fn().mockResolvedValue([]),
  stat: jest.fn().mockResolvedValue({ isDirectory: () => true }),
  access: jest.fn().mockRejectedValue(new Error('ENOENT')),
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined)
}));

describe('ClaudeInstanceManager', () => {
  let manager: ClaudeInstanceManager;
  let mockProcess: any;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new ClaudeInstanceManager();
    
    mockProcess = new EventEmitter();
    mockProcess.stdin = { 
      write: jest.fn(),
      end: jest.fn(),
      destroyed: false,
      destroy: jest.fn()
    };
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = jest.fn();
    mockProcess.pid = 12345;
    // Keep original EventEmitter methods but add removeAllListeners
    mockProcess.removeAllListeners = jest.fn();
    
    (spawn as jest.Mock).mockReturnValue(mockProcess);
  });

  afterEach(() => {
    manager.shutdown();
  });

  describe('initialize', () => {
    it('should detect Claude configuration', async () => {
      await manager.initialize();
      expect(manager.getAllStatuses()).toBeDefined();
    });

    it('should create instance entries for all Claude instances', async () => {
      await manager.initialize();
      const statuses = manager.getAllStatuses();
      expect(statuses).toHaveProperty('main');
      expect(statuses).toHaveProperty('contextManager');
      expect(statuses).toHaveProperty('summarizer');
      expect(statuses).toHaveProperty('planner');
    });
  });

  describe('spawnInstance', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should spawn a Claude process with correct arguments', async () => {
      await manager.spawnInstance('main');
      
      expect(spawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['--no-interactive', '--model', 'claude-3-5-sonnet-20241022']),
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe']
        })
      );
    });

    it('should set instance status to running', async () => {
      await manager.spawnInstance('main');
      expect(manager.getStatus('main')).toBe('running');
    });

    it('should emit instance:started event', async () => {
      const startedSpy = jest.fn();
      manager.on('instance:started', startedSpy);
      
      await manager.spawnInstance('main');
      expect(startedSpy).toHaveBeenCalledWith('main');
    });

    it('should handle process exit and trigger restart', async () => {
      jest.useFakeTimers();
      await manager.spawnInstance('main');
      
      mockProcess.emit('exit', 1, null);
      
      expect(manager.getStatus('main')).toBe('crashed');
      
      jest.advanceTimersByTime(1000);
      
      jest.useRealTimers();
    });
  });

  describe('auto-restart mechanism', () => {
    beforeEach(async () => {
      await manager.initialize();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should restart crashed instance with exponential backoff', async () => {
      await manager.spawnInstance('main');
      const initialSpawnCount = (spawn as jest.Mock).mock.calls.length;
      
      // First crash - 1000ms delay (1000 * 2^0)
      mockProcess.emit('exit', 1, null);
      jest.advanceTimersByTime(1000);
      expect(spawn).toHaveBeenCalledTimes(initialSpawnCount + 1);
      
      // Second crash within cooldown - 2000ms delay (1000 * 2^1) 
      mockProcess.emit('exit', 1, null);
      jest.advanceTimersByTime(2000);
      expect(spawn).toHaveBeenCalledTimes(initialSpawnCount + 2);
    });

    it('should stop restarting after 3 attempts', async () => {
      const failedSpy = jest.fn();
      manager.on('instance:failed', failedSpy);
      
      await manager.spawnInstance('main');
      
      // First crash - restartAttempts becomes 1 
      mockProcess.emit('exit', 1, null);
      // Wait for restart timer and spawn new instance
      jest.advanceTimersByTime(1000);
      
      // Second crash within cooldown - restartAttempts becomes 2
      mockProcess.emit('exit', 1, null);
      // Wait for restart timer
      jest.advanceTimersByTime(2000);
      
      // Third crash within cooldown - restartAttempts becomes 3, should trigger failure
      mockProcess.emit('exit', 1, null);
      
      expect(failedSpy).toHaveBeenCalledWith('main');
    });
  });

  describe('sendToInstance', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should send message to running instance', async () => {
      await manager.spawnInstance('main');
      await manager.sendToInstance('main', 'test message');
      
      expect(mockProcess.stdin.write).toHaveBeenCalledWith('test message\n');
    });

    it('should spawn instance if not running', async () => {
      await manager.sendToInstance('main', 'test message');
      
      expect(spawn).toHaveBeenCalled();
      expect(mockProcess.stdin.write).toHaveBeenCalledWith('test message\n');
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should kill all running processes', async () => {
      await manager.spawnInstance('main');
      await manager.spawnInstance('contextManager');
      
      manager.shutdown();
      
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(manager.getStatus('main')).toBe('idle');
      expect(manager.getStatus('contextManager')).toBe('idle');
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should forward stdout data', async () => {
      const outputSpy = jest.fn();
      manager.on('main:output', outputSpy);
      
      await manager.spawnInstance('main');
      mockProcess.stdout.emit('data', 'test output');
      
      expect(outputSpy).toHaveBeenCalledWith('test output');
    });

    it('should forward stderr data', async () => {
      const errorSpy = jest.fn();
      manager.on('main:error', errorSpy);
      
      await manager.spawnInstance('main');
      mockProcess.stderr.emit('data', 'test error');
      
      expect(errorSpy).toHaveBeenCalledWith('test error');
    });
  });
});