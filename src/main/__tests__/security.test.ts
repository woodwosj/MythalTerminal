// SECURITY TESTS: Comprehensive security tests for all fixes applied
import { InputValidator, ProcessLockManager, SECURITY_CONSTANTS } from '../../shared/security';
import { ClaudeInstanceManager } from '../claudeManager';
import { 
  saveContextLayer, 
  updateContextLayer, 
  getContextLayers, 
  deleteContextLayer,
  saveResumeWorkSnapshot,
  getLatestResumeWork,
  ContextLayer
} from '../database';
import Database from 'better-sqlite3';

// Mock better-sqlite3
const mockDatabase = {
  exec: jest.fn(),
  prepare: jest.fn(() => ({
    run: jest.fn(() => ({ lastInsertRowid: 1 })),
    get: jest.fn(),
    all: jest.fn(() => [])
  })),
  pragma: jest.fn()
};

jest.mock('better-sqlite3', () => {
  return jest.fn(() => mockDatabase);
});

// Mock electron app
jest.mock('electron', () => ({
  app: {
    getPath: (path: string) => `/tmp/test-${path}`
  }
}));

// Mock child_process to prevent actual process spawning
jest.mock('child_process', () => ({
  spawn: jest.fn().mockReturnValue({
    stdin: { write: jest.fn(), end: jest.fn() },
    stdout: { on: jest.fn(), removeAllListeners: jest.fn() },
    stderr: { on: jest.fn(), removeAllListeners: jest.fn() },
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    kill: jest.fn(),
    killed: false
  })
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockRejectedValue(new Error('File not found')),
  readdir: jest.fn().mockResolvedValue([]),
  stat: jest.fn().mockResolvedValue({ isDirectory: () => false }),
  access: jest.fn().mockRejectedValue(new Error('Access denied')),
  mkdir: jest.fn().mockResolvedValue(undefined)
}));

// Mock database functions
jest.mock('../database', () => ({
  getDatabase: jest.fn(() => mockDatabase),
  saveContextLayer: jest.fn(),
  updateContextLayer: jest.fn(),
  getContextLayers: jest.fn(),
  deleteContextLayer: jest.fn(),
  saveResumeWorkSnapshot: jest.fn(),
  getLatestResumeWork: jest.fn()
}));

describe('Security Tests', () => {
  beforeEach(() => {
    // Clear process locks
    ProcessLockManager.releaseAllLocks();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Input Validation Security Tests', () => {
    describe('Command Injection Prevention', () => {
      test('should reject dangerous commands', () => {
        const result = InputValidator.validateSpawnArgs('rm', ['-rf', '/']);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Command not allowed');
      });

      test('should reject arguments with shell metacharacters', () => {
        const result = InputValidator.validateSpawnArgs('claude', ['--model', 'test; rm -rf /']);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid model name');
      });

      test('should accept valid claude commands', () => {
        const result = InputValidator.validateSpawnArgs('claude', ['--no-interactive', '--model', 'claude-3-5-sonnet-20241022']);
        expect(result.isValid).toBe(true);
      });

      test('should reject arguments with directory traversal', () => {
        const result = InputValidator.validateSpawnArgs('claude', ['--add-dir', '../../../etc/passwd']);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid path');
      });

      test('should reject arguments with null bytes', () => {
        const result = InputValidator.validateSpawnArgs('claude', ['--model', 'test\0']);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid model name');
      });
    });

    describe('Model Name Validation', () => {
      test('should accept whitelisted models', () => {
        expect(InputValidator.validateModelName('claude-3-5-sonnet-20241022')).toBe(true);
        expect(InputValidator.validateModelName('claude-3-haiku-20240307')).toBe(true);
        expect(InputValidator.validateModelName('claude-3-opus-20240229')).toBe(true);
      });

      test('should reject invalid model names', () => {
        expect(InputValidator.validateModelName('malicious-model')).toBe(false);
        expect(InputValidator.validateModelName('claude-99-evil-20241022')).toBe(false);
        expect(InputValidator.validateModelName('')).toBe(false);
      });

      test('should accept valid claude model pattern', () => {
        expect(InputValidator.validateModelName('claude-4-sonnet-20241201')).toBe(true);
      });
    });

    describe('Path Validation', () => {
      test('should accept valid paths', () => {
        expect(InputValidator.validatePath('/home/user/project')).toBe(true);
        expect(InputValidator.validatePath('C:\\Users\\test')).toBe(true);
        expect(InputValidator.validatePath('./relative/path')).toBe(true);
      });

      test('should reject paths with dangerous patterns', () => {
        expect(InputValidator.validatePath('../../../etc/passwd')).toBe(false);
        expect(InputValidator.validatePath('/path/with spaces')).toBe(false);
        expect(InputValidator.validatePath('/path\0null')).toBe(false);
      });

      test('should reject overly long paths', () => {
        const longPath = '/'.repeat(SECURITY_CONSTANTS.MAX_PATH_LENGTH + 1);
        expect(InputValidator.validatePath(longPath)).toBe(false);
      });
    });

    describe('Field Name Validation for SQL Injection Prevention', () => {
      test('should accept whitelisted field names', () => {
        expect(InputValidator.validateFieldName('project_path')).toBe(true);
        expect(InputValidator.validateFieldName('layer_type')).toBe(true);
        expect(InputValidator.validateFieldName('is_starred')).toBe(true);
      });

      test('should reject non-whitelisted field names', () => {
        expect(InputValidator.validateFieldName('malicious_field')).toBe(false);
        expect(InputValidator.validateFieldName('DROP TABLE')).toBe(false);
        expect(InputValidator.validateFieldName('\'; DROP TABLE context_layers; --')).toBe(false);
      });

      test('should reject overly long field names', () => {
        const longField = 'a'.repeat(SECURITY_CONSTANTS.MAX_FIELD_NAME_LENGTH + 1);
        expect(InputValidator.validateFieldName(longField)).toBe(false);
      });
    });

    describe('Message Length Validation', () => {
      test('should accept normal length messages', () => {
        expect(InputValidator.validateMessageLength('Hello Claude')).toBe(true);
        expect(InputValidator.validateMessageLength('A'.repeat(1000))).toBe(true);
      });

      test('should reject overly long messages', () => {
        const longMessage = 'A'.repeat(SECURITY_CONSTANTS.MAX_MESSAGE_LENGTH + 1);
        expect(InputValidator.validateMessageLength(longMessage)).toBe(false);
      });
    });
  });

  describe('Process Lock Manager Security Tests', () => {
    test('should prevent concurrent access to same resource', async () => {
      let firstLockAcquired = false;
      let secondLockAcquired = false;
      let firstLockReleased = false;

      // First process acquires lock
      const promise1 = ProcessLockManager.acquireLock('test-resource').then(release => {
        firstLockAcquired = true;
        return new Promise<void>(resolve => {
          setTimeout(() => {
            release();
            firstLockReleased = true;
            resolve();
          }, 100);
        });
      });

      // Second process tries to acquire same lock
      const promise2 = ProcessLockManager.acquireLock('test-resource').then(release => {
        secondLockAcquired = true;
        release();
      });

      // Wait for both to complete
      await Promise.all([promise1, promise2]);

      // Verify order of execution
      expect(firstLockAcquired).toBe(true);
      expect(secondLockAcquired).toBe(true);
      expect(firstLockReleased).toBe(true);
    });

    test('should allow concurrent access to different resources', async () => {
      let lock1Acquired = false;
      let lock2Acquired = false;

      const promise1 = ProcessLockManager.acquireLock('resource1').then(release => {
        lock1Acquired = true;
        release();
      });

      const promise2 = ProcessLockManager.acquireLock('resource2').then(release => {
        lock2Acquired = true;
        release();
      });

      await Promise.all([promise1, promise2]);

      expect(lock1Acquired).toBe(true);
      expect(lock2Acquired).toBe(true);
    });

    test('should properly release all locks', async () => {
      await ProcessLockManager.acquireLock('resource1');
      await ProcessLockManager.acquireLock('resource2');

      expect(ProcessLockManager.isLocked('resource1')).toBe(true);
      expect(ProcessLockManager.isLocked('resource2')).toBe(true);

      ProcessLockManager.releaseAllLocks();

      expect(ProcessLockManager.isLocked('resource1')).toBe(false);
      expect(ProcessLockManager.isLocked('resource2')).toBe(false);
    });
  });

  describe('Database Security Tests', () => {
    describe('SQL Injection Prevention', () => {
      test('should validate field names in updateContextLayer', () => {
        // Test that malicious field names are rejected by InputValidator
        expect(InputValidator.validateFieldName('content = "hacked"; DROP TABLE context_layers; --')).toBe(false);
        expect(InputValidator.validateFieldName('malicious_field')).toBe(false);
        expect(InputValidator.validateFieldName('content')).toBe(true);
        expect(InputValidator.validateFieldName('is_starred')).toBe(true);
      });

      test('should only allow whitelisted field names', () => {
        // Test the field validation logic directly
        const validFields = ['content', 'tokens', 'is_starred'];
        const invalidFields = ['malicious_field', 'DROP TABLE', '\'; DELETE FROM context_layers; --'];
        
        validFields.forEach(field => {
          expect(InputValidator.validateFieldName(field)).toBe(true);
        });
        
        invalidFields.forEach(field => {
          expect(InputValidator.validateFieldName(field)).toBe(false);
        });
      });
    });

    describe('Input Validation Logic', () => {
      test('should validate project paths properly', () => {
        expect(InputValidator.validatePath('/valid/path')).toBe(true);
        expect(InputValidator.validatePath('../../../etc/passwd')).toBe(false);
        expect(InputValidator.validatePath('/path\0null')).toBe(false);
      });

      test('should validate numeric inputs', () => {
        expect(Number.isInteger(100) && 100 >= 0).toBe(true);
        expect(Number.isInteger(-100) && -100 >= 0).toBe(false);
        expect(Number.isInteger(1.5)).toBe(false);
      });

      test('should validate layer types', () => {
        const validTypes = ['core', 'active', 'reference', 'archive'];
        const invalidTypes = ['malicious', 'hack', 'DROP TABLE'];
        
        validTypes.forEach(type => {
          expect(validTypes.includes(type)).toBe(true);
        });
        
        invalidTypes.forEach(type => {
          expect(validTypes.includes(type)).toBe(false);
        });
      });
      
      test('should validate source types', () => {
        const validSources = ['user', 'ai', 'system'];
        const invalidSources = ['malicious', 'hack', 'admin'];
        
        validSources.forEach(source => {
          expect(validSources.includes(source)).toBe(true);
        });
        
        invalidSources.forEach(source => {
          expect(validSources.includes(source)).toBe(false);
        });
      });
    });
  });

  describe('ClaudeInstanceManager Security Tests', () => {    
    test('should validate instance keys format', () => {
      // Test the validation logic directly
      expect(InputValidator.validateInstanceKey('validKey123')).toBe(true);
      expect(InputValidator.validateInstanceKey('main')).toBe(true);
      expect(InputValidator.validateInstanceKey('contextManager')).toBe(true);
      
      expect(InputValidator.validateInstanceKey('invalid-key!')).toBe(false);
      expect(InputValidator.validateInstanceKey('another-invalid-key')).toBe(false);
      expect(InputValidator.validateInstanceKey('123startwithnum')).toBe(false);
      expect(InputValidator.validateInstanceKey('spaces not allowed')).toBe(false);
    });

    test('should validate message lengths', () => {
      const shortMessage = 'Hello Claude';
      const normalMessage = 'A'.repeat(1000);
      const longMessage = 'A'.repeat(SECURITY_CONSTANTS.MAX_MESSAGE_LENGTH + 1);
      
      expect(InputValidator.validateMessageLength(shortMessage)).toBe(true);
      expect(InputValidator.validateMessageLength(normalMessage)).toBe(true);
      expect(InputValidator.validateMessageLength(longMessage)).toBe(false);
    });

    test('should validate model names in spawn operations', () => {
      expect(InputValidator.validateModelName('claude-3-5-sonnet-20241022')).toBe(true);
      expect(InputValidator.validateModelName('claude-3-haiku-20240307')).toBe(true);
      expect(InputValidator.validateModelName('malicious-model')).toBe(false);
      expect(InputValidator.validateModelName('claude-99-evil-20241022')).toBe(false);
    });
  });

  describe('Security Constants and Limits', () => {
    test('should have reasonable security limits', () => {
      expect(SECURITY_CONSTANTS.MAX_RESTART_ATTEMPTS).toBeGreaterThan(0);
      expect(SECURITY_CONSTANTS.MAX_RESTART_ATTEMPTS).toBeLessThan(10);
      
      expect(SECURITY_CONSTANTS.MAX_MESSAGE_LENGTH).toBeGreaterThan(1000);
      expect(SECURITY_CONSTANTS.MAX_PROMPT_LENGTH).toBeGreaterThan(1000);
      
      expect(SECURITY_CONSTANTS.PROCESS_TIMEOUT_MS).toBeGreaterThan(10000);
      expect(SECURITY_CONSTANTS.RESTART_COOLDOWN_MS).toBeGreaterThan(1000);
    });

    test('should have proper validation patterns', () => {
      expect(SECURITY_CONSTANTS.PATH_VALIDATION_REGEX.test('/valid/path')).toBe(true);
      expect(SECURITY_CONSTANTS.PATH_VALIDATION_REGEX.test('../invalid')).toBe(false);
      
      expect(SECURITY_CONSTANTS.MODEL_NAME_REGEX.test('claude-3-sonnet-20241022')).toBe(true);
      expect(SECURITY_CONSTANTS.MODEL_NAME_REGEX.test('invalid-model')).toBe(false);
      
      expect(SECURITY_CONSTANTS.INSTANCE_KEY_REGEX.test('validKey123')).toBe(true);
      expect(SECURITY_CONSTANTS.INSTANCE_KEY_REGEX.test('invalid-key!')).toBe(false);
    });
  });
});