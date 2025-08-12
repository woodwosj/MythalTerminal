import { InputValidator, SECURITY_CONSTANTS } from '../shared/security';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Dynamic imports to handle both Electron and Node.js contexts
let app: any;
let safeStorage: any;
let isElectronEnvironment = false;

try {
  // Check if we're in Electron main process
  const electron = require('electron');
  app = electron.app;
  safeStorage = electron.safeStorage;
  isElectronEnvironment = true;
} catch (e) {
  // Running in Node.js context (e.g., setup script)
  isElectronEnvironment = false;
}

export interface AppSettings {
  anthropicApiKey?: string;
  theme?: 'dark' | 'light';
  terminalSettings?: {
    fontSize?: number;
    fontFamily?: string;
    scrollback?: number;
  };
}

export class SettingsManager {
  private store: any;
  private encryptionKey: string | null = null;
  private isInitialized: boolean = false;
  private inMemoryMode: boolean = false;
  private randomSalt: string | null = null;
  private nodeEncryptionAlgorithm = 'aes-256-gcm';
  private nodeEncryptionKeyPath: string;
  private nodeEncryptionKey: Buffer | null = null;

  constructor() {
    // Set up paths for Node.js encryption
    const userDataPath = this.getUserDataPath();
    this.nodeEncryptionKeyPath = path.join(userDataPath, '.mythal-encryption-key');
    this.initializeStore();
  }

  private getUserDataPath(): string {
    if (isElectronEnvironment && app && app.getPath) {
      return app.getPath('userData');
    } else {
      // Fallback for Node.js context
      return path.join(os.homedir(), '.config', 'mythalterminal');
    }
  }

  private initializeStore() {
    const Store = require('electron-store');
    
    // Initialize Node.js encryption if not in Electron or safeStorage unavailable
    if (!isElectronEnvironment || !safeStorage?.isEncryptionAvailable?.()) {
      this.initializeNodeEncryption();
    }
    
    try {
      // First attempt: Try to initialize with current settings
      const storeConfig: any = {
        name: 'mythal-settings',
        // Don't use electron-store encryption for sensitive data
        // We'll handle encryption ourselves
        encryptionKey: undefined,
        defaults: {
          theme: 'dark',
          terminalSettings: {
            fontSize: 14,
            fontFamily: 'Monaco, "Cascadia Code", "Fira Code", monospace',
            scrollback: 1000,
          }
        }
      };
      
      // Set custom path for Node.js context
      if (!isElectronEnvironment) {
        storeConfig.cwd = this.getUserDataPath();
      }
      
      this.store = new Store(storeConfig);
      
      // Test if we can read from the store
      this.store.get('theme');
      this.isInitialized = true;
      
      // Migrate existing plaintext keys if found
      this.migrateApiKeyIfNeeded();
      
      console.log('Settings store initialized successfully');
      
    } catch (error: any) {
      console.error('Failed to initialize settings store, attempting recovery:', error.message);
      
      try {
        // Second attempt: Clear corrupted settings and start fresh
        const storePath = path.join(this.getUserDataPath(), 'mythal-settings.json');
        
        // Backup corrupted file if it exists
        if (fs.existsSync(storePath)) {
          // Security fix: Use path.basename to prevent directory traversal
          const baseName = path.basename('mythal-settings.json', '.json');
          const backupDir = path.dirname(storePath);
          const timestamp = Date.now();
          const backupPath = path.join(backupDir, `${baseName}.backup.${timestamp}.json`);
          
          fs.copyFileSync(storePath, backupPath);
          console.log(`Backed up corrupted settings to: ${backupPath}`);
          
          // Implement backup rotation - keep only last 5 backups
          this.rotateBackups(backupDir, baseName);
          
          // Delete the corrupted file
          fs.unlinkSync(storePath);
          console.log('Removed corrupted settings file');
        }
        
        // Create new store with defaults
        const recoveryConfig: any = {
          name: 'mythal-settings',
          encryptionKey: undefined,
          defaults: {
            theme: 'dark',
            terminalSettings: {
              fontSize: 14,
              fontFamily: 'Monaco, "Cascadia Code", "Fira Code", monospace',
              scrollback: 1000,
            }
          }
        };
        
        if (!isElectronEnvironment) {
          recoveryConfig.cwd = this.getUserDataPath();
        }
        
        this.store = new Store(recoveryConfig);
        
        this.isInitialized = true;
        console.log('Settings store recovered with defaults');
        
      } catch (recoveryError: any) {
        console.error('Failed to recover settings store:', recoveryError);
        
        // Final fallback: Create in-memory store with defaults
        this.store = {
          store: {
            theme: 'dark',
            terminalSettings: {
              fontSize: 14,
              fontFamily: 'Monaco, "Cascadia Code", "Fira Code", monospace',
              scrollback: 1000,
            }
          },
          get: (key: string, defaultValue?: any) => {
            const keys = key.split('.');
            let value: any = this.store.store;
            for (const k of keys) {
              value = value?.[k];
              if (value === undefined) return defaultValue;
            }
            return value ?? defaultValue;
          },
          set: (key: string, value: any) => {
            const keys = key.split('.');
            const lastKey = keys.pop()!;
            let target: any = this.store.store;
            for (const k of keys) {
              target[k] = target[k] || {};
              target = target[k];
            }
            target[lastKey] = value;
          },
          delete: (key: string) => {
            const keys = key.split('.');
            const lastKey = keys.pop()!;
            let target: any = this.store.store;
            for (const k of keys) {
              target = target?.[k];
              if (!target) return;
            }
            delete target[lastKey];
          },
          clear: () => {
            this.store.store = {
              theme: 'dark',
              terminalSettings: {
                fontSize: 14,
                fontFamily: 'Monaco, "Cascadia Code", "Fira Code", monospace',
                scrollback: 1000,
              }
            };
          },
          path: 'in-memory'
        };
        
        this.isInitialized = true;
        this.inMemoryMode = true;
        console.warn('Using in-memory settings store (changes will not persist)');
        
        // Notify renderer about in-memory fallback
        this.notifyInMemoryMode();
      }
    }
  }

  /**
   * Initialize Node.js crypto for when Electron's safeStorage is not available
   */
  private initializeNodeEncryption(): void {
    try {
      if (fs.existsSync(this.nodeEncryptionKeyPath)) {
        // Read existing encryption key
        const keyData = fs.readFileSync(this.nodeEncryptionKeyPath, 'utf8');
        this.nodeEncryptionKey = Buffer.from(keyData, 'hex');
      } else {
        // Generate new encryption key
        this.nodeEncryptionKey = crypto.randomBytes(32);
        
        // Create directory if it doesn't exist
        const dir = path.dirname(this.nodeEncryptionKeyPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        }
        
        // Save key with restricted permissions
        fs.writeFileSync(
          this.nodeEncryptionKeyPath,
          this.nodeEncryptionKey.toString('hex'),
          { mode: 0o600 }
        );
      }
    } catch (error) {
      console.error('Failed to initialize Node.js encryption:', error);
      // Use a runtime-only key as fallback
      this.nodeEncryptionKey = crypto.randomBytes(32);
    }
  }

  /**
   * Encrypt data using Node.js crypto
   */
  private encryptWithNodeCrypto(text: string): string {
    if (!this.nodeEncryptionKey) {
      throw new Error('Node encryption not initialized');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.nodeEncryptionAlgorithm, this.nodeEncryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = (cipher as any).getAuthTag();
    
    // Combine iv, authTag, and encrypted data
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Decrypt data using Node.js crypto
   */
  private decryptWithNodeCrypto(encryptedData: string): string {
    if (!this.nodeEncryptionKey) {
      throw new Error('Node encryption not initialized');
    }

    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const iv = combined.slice(0, 16);
    const authTag = combined.slice(16, 32);
    const encrypted = combined.slice(32);
    
    const decipher = crypto.createDecipheriv(this.nodeEncryptionAlgorithm, this.nodeEncryptionKey, iv);
    (decipher as any).setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  }

  /**
   * Generate a machine-specific encryption key with random component for better entropy
   * @deprecated Use initializeNodeEncryption instead
   */
  private generateMachineKey(): string {
    // Path for storing the random salt
    const saltPath = path.join(this.getUserDataPath(), '.mythal-salt');
    
    try {
      // Try to read existing salt
      if (fs.existsSync(saltPath)) {
        this.randomSalt = fs.readFileSync(saltPath, 'utf8');
      } else {
        // Generate new random salt
        this.randomSalt = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(saltPath, this.randomSalt, { mode: 0o600 }); // Restrict permissions
      }
    } catch (error) {
      console.error('Error handling salt file:', error);
      // Fallback to runtime-only salt
      this.randomSalt = crypto.randomBytes(32).toString('hex');
    }
    
    // Combine machine-specific data with random salt for better entropy
    const machineId = `${os.hostname()}-${os.platform()}-${os.arch()}`;
    const combinedKey = `${machineId}-${this.randomSalt}`;
    return crypto.createHash('sha256').update(combinedKey).digest('hex').substring(0, 32);
  }

  /**
   * Rotate backup files to keep only the last 5
   */
  private rotateBackups(backupDir: string, baseName: string): void {
    const fs = require('fs');
    const path = require('path');
    
    try {
      // Find all backup files
      const files = fs.readdirSync(backupDir);
      const backupPattern = new RegExp(`^${baseName}\.backup\.\d+\.json$`);
      const backupFiles = files
        .filter((file: string) => backupPattern.test(file))
        .map((file: string) => ({
          name: file,
          path: path.join(backupDir, file),
          timestamp: parseInt(file.match(/\.(\d+)\.json$/)![1], 10)
        }))
        .sort((a: any, b: any) => b.timestamp - a.timestamp); // Sort newest first
      
      // Keep only the 5 most recent backups
      const maxBackups = 5;
      if (backupFiles.length > maxBackups) {
        const filesToDelete = backupFiles.slice(maxBackups);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          console.log(`Deleted old backup: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('Error rotating backups:', error);
    }
  }

  /**
   * Notify renderer process about in-memory mode
   */
  private notifyInMemoryMode(): void {
    if (isElectronEnvironment) {
      try {
        const { BrowserWindow } = require('electron');
        const windows = BrowserWindow.getAllWindows();
        for (const window of windows) {
          window.webContents.send('settings:in-memory-warning');
        }
      } catch (error) {
        console.error('Failed to notify about in-memory mode:', error);
      }
    }
  }

  /**
   * Migrate existing plaintext API key to encrypted storage
   */
  private migrateApiKeyIfNeeded(): void {
    try {
      const plainKey = this.store.get('anthropicApiKey');
      if (plainKey && typeof plainKey === 'string' && plainKey.startsWith('sk-ant-')) {
        console.log('Migrating plaintext API key to encrypted storage...');
        
        // Save using encrypted storage
        const result = this.setApiKey(plainKey);
        
        if (result.success) {
          // Only delete the plaintext key after successful encryption
          this.store.delete('anthropicApiKey');
          console.log('API key migration completed successfully');
        } else {
          console.error('Failed to migrate API key:', result.error);
        }
      }
    } catch (error) {
      console.error('Error during API key migration:', error);
    }
  }

  /**
   * Set the Anthropic API key securely
   */
  setApiKey(apiKey: string): { success: boolean; error?: string } {
    try {
      // Validate API key format
      if (!this.validateApiKey(apiKey)) {
        return { 
          success: false, 
          error: 'Invalid API key format. Must start with "sk-ant-" and be at least 20 characters long.' 
        };
      }

      // Validate input length for security
      if (!InputValidator.validateMessageLength(apiKey)) {
        return { 
          success: false, 
          error: 'API key exceeds maximum allowed length' 
        };
      }

      // Determine encryption method based on environment
      if (isElectronEnvironment && safeStorage?.isEncryptionAvailable?.()) {
        // Use Electron's safeStorage (most secure)
        const encryptedBuffer = safeStorage.encryptString(apiKey);
        this.store.set('encryptedApiKey', encryptedBuffer.toString('base64'));
        this.store.set('encryptionMethod', 'electron-safeStorage');
        
        // Clean up other storage methods
        this.store.delete('anthropicApiKey');
        this.store.delete('nodeEncryptedApiKey');
      } else if (this.nodeEncryptionKey) {
        // Use Node.js crypto (secure for non-Electron contexts)
        const encrypted = this.encryptWithNodeCrypto(apiKey);
        this.store.set('nodeEncryptedApiKey', encrypted);
        this.store.set('encryptionMethod', 'node-crypto');
        
        // Clean up other storage methods
        this.store.delete('anthropicApiKey');
        this.store.delete('encryptedApiKey');
      } else {
        // This should rarely happen, but if it does, refuse to store in plaintext
        return {
          success: false,
          error: 'No secure encryption method available. Cannot store API key.'
        };
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Error setting API key:', error);
      return { 
        success: false, 
        error: 'Failed to save API key securely' 
      };
    }
  }

  /**
   * Get the Anthropic API key (only for main process use)
   */
  getApiKey(): string | null {
    try {
      const encryptionMethod = this.store.get('encryptionMethod');
      
      // Try Electron safeStorage first
      if (encryptionMethod === 'electron-safeStorage' || !encryptionMethod) {
        const encryptedKey = this.store.get('encryptedApiKey');
        if (encryptedKey && isElectronEnvironment && safeStorage?.isEncryptionAvailable?.()) {
          try {
            const encryptedBuffer = Buffer.from(encryptedKey, 'base64');
            return safeStorage.decryptString(encryptedBuffer);
          } catch (decryptError) {
            console.error('Error decrypting with safeStorage:', decryptError);
            this.store.delete('encryptedApiKey');
          }
        }
      }
      
      // Try Node.js crypto
      if (encryptionMethod === 'node-crypto' || !encryptionMethod) {
        const nodeEncrypted = this.store.get('nodeEncryptedApiKey');
        if (nodeEncrypted && this.nodeEncryptionKey) {
          try {
            return this.decryptWithNodeCrypto(nodeEncrypted);
          } catch (decryptError) {
            console.error('Error decrypting with Node crypto:', decryptError);
            this.store.delete('nodeEncryptedApiKey');
          }
        }
      }
      
      // Check for legacy plaintext (for migration)
      const plainKey = this.store.get('anthropicApiKey');
      if (plainKey && typeof plainKey === 'string' && plainKey.startsWith('sk-ant-')) {
        // Attempt to migrate immediately
        console.warn('Found plaintext API key, attempting migration...');
        const result = this.setApiKey(plainKey);
        if (result.success) {
          this.store.delete('anthropicApiKey');
          return plainKey;
        }
      }
      
      return null;
    } catch (error: any) {
      console.error('Error retrieving API key:', error);
      return null;
    }
  }

  /**
   * Check if API key exists without exposing it
   */
  hasApiKey(): boolean {
    const key = this.getApiKey();
    return key !== null && key.length > 0;
  }

  /**
   * Check if settings are in memory-only mode
   */
  isInMemoryMode(): boolean {
    return this.inMemoryMode;
  }

  /**
   * Get masked API key for UI display (shows only last 4 characters)
   */
  getMaskedApiKey(): { success: boolean; apiKey?: string; error?: string } {
    try {
      const key = this.getApiKey();
      if (!key) {
        return { success: true, apiKey: '' };
      }

      const masked = '•'.repeat(Math.max(0, key.length - 4)) + key.slice(-4);
      return { success: true, apiKey: masked };
    } catch (error: any) {
      console.error('Error getting masked API key:', error);
      return { 
        success: false, 
        error: 'Failed to retrieve API key' 
      };
    }
  }

  /**
   * Delete the API key
   */
  deleteApiKey(): { success: boolean; error?: string } {
    try {
      // Delete all possible storage formats
      this.store.delete('anthropicApiKey');
      this.store.delete('encryptedApiKey');
      this.store.delete('nodeEncryptedApiKey');
      this.store.delete('encryptionMethod');
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting API key:', error);
      return { 
        success: false, 
        error: 'Failed to delete API key' 
      };
    }
  }

  /**
   * Validate API key format
   */
  private validateApiKey(apiKey: string): boolean {
    if (typeof apiKey !== 'string') return false;
    
    // Basic validation for Anthropic API key format
    const trimmed = apiKey.trim();
    return trimmed.startsWith('sk-ant-') && trimmed.length >= 20;
  }

  /**
   * Get all settings (excluding sensitive data like API keys)
   */
  getPublicSettings(): Omit<AppSettings, 'anthropicApiKey'> {
    try {
      const settings = { ...this.store.store } as AppSettings;
      const { anthropicApiKey, ...publicSettings } = settings;
      // Remove all forms of encrypted keys from public settings
      delete (publicSettings as any).encryptedApiKey;
      delete (publicSettings as any).nodeEncryptedApiKey;
      delete (publicSettings as any).encryptionMethod;
      return publicSettings;
    } catch (error: any) {
      console.error('Error getting public settings:', error);
      // Return defaults if store access fails
      return {
        theme: 'dark',
        terminalSettings: {
          fontSize: 14,
          fontFamily: 'Monaco, "Cascadia Code", "Fira Code", monospace',
          scrollback: 1000,
        }
      };
    }
  }

  /**
   * Update theme setting
   */
  setTheme(theme: 'dark' | 'light'): { success: boolean; error?: string } {
    try {
      this.store.set('theme', theme);
      return { success: true };
    } catch (error: any) {
      console.error('Error setting theme:', error);
      return { 
        success: false, 
        error: 'Failed to save theme setting' 
      };
    }
  }

  /**
   * Get theme setting
   */
  getTheme(): 'dark' | 'light' {
    return this.store.get('theme', 'dark');
  }

  /**
   * Update terminal settings
   */
  setTerminalSettings(settings: AppSettings['terminalSettings']): { success: boolean; error?: string } {
    try {
      this.store.set('terminalSettings', { 
        ...this.store.get('terminalSettings', {}),
        ...settings 
      });
      return { success: true };
    } catch (error: any) {
      console.error('Error setting terminal settings:', error);
      return { 
        success: false, 
        error: 'Failed to save terminal settings' 
      };
    }
  }

  /**
   * Get terminal settings
   */
  getTerminalSettings(): AppSettings['terminalSettings'] {
    return this.store.get('terminalSettings', {
      fontSize: 14,
      fontFamily: 'Monaco, "Cascadia Code", "Fira Code", monospace',
      scrollback: 1000,
    });
  }

  /**
   * Reset all settings to defaults
   */
  reset(): { success: boolean; error?: string } {
    try {
      this.store.clear();
      return { success: true };
    } catch (error: any) {
      console.error('Error resetting settings:', error);
      return { 
        success: false, 
        error: 'Failed to reset settings' 
      };
    }
  }

  /**
   * Get the file path where settings are stored (for debugging)
   */
  getStorePath(): string {
    return this.store.path;
  }
}