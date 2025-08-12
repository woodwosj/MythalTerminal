import { InputValidator, SECURITY_CONSTANTS } from '../shared/security';

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

  constructor() {
    const Store = require('electron-store');
    this.store = new Store({
      name: 'mythal-settings',
      // Encrypt the store to protect API keys
      encryptionKey: 'mythalterminal-secret-key',
      defaults: {
        theme: 'dark',
        terminalSettings: {
          fontSize: 14,
          fontFamily: 'Monaco, "Cascadia Code", "Fira Code", monospace',
          scrollback: 1000,
        }
      }
    });
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

      this.store.set('anthropicApiKey', apiKey);
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
      return this.store.get('anthropicApiKey') || null;
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
      this.store.delete('anthropicApiKey');
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
    const settings = { ...this.store.store } as AppSettings;
    const { anthropicApiKey, ...publicSettings } = settings;
    return publicSettings;
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