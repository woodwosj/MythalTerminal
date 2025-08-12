import { ipcMain, BrowserWindow } from 'electron';
import { ClaudeInstanceManager } from './claudeManager';
import { SettingsManager } from './settingsManager';
import { getClipboardManager } from './clipboardManager';
import * as db from './database';
import { spawn } from 'child_process';
import * as pty from 'node-pty';
import os from 'os';

let terminals: Map<string, any> = new Map();
const settingsManager = new SettingsManager();

export function setupIPC(claudeManager: ClaudeInstanceManager) {
  // Terminal management
  ipcMain.handle('terminal:create', (event, id: string) => {
    console.log('[IPC] Creating terminal with ID:', id);
    
    try {
      const shell = process.env.SHELL || (os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash');
      console.log('[IPC] Using shell:', shell);
      
      const terminal = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: process.env as any
      });

      terminals.set(id, terminal);
      console.log('[IPC] Terminal created and stored. Total terminals:', terminals.size);

      terminal.onData((data: string) => {
        console.log('[IPC] Terminal output for', id, ':', data.substring(0, 50));
        event.sender.send(`terminal:output:${id}`, data);
      });

      terminal.onExit(({ exitCode, signal }) => {
        console.log('[IPC] Terminal exited:', id, 'exitCode:', exitCode, 'signal:', signal);
        terminals.delete(id);
        event.sender.send(`terminal:exit:${id}`, { exitCode, signal });
      });

      return { success: true };
    } catch (error: any) {
      console.error('[IPC] Failed to create terminal:', error);
      return { success: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle('terminal:write', (event, id: string, data: string) => {
    console.log('[IPC] Write to terminal:', id, 'data:', JSON.stringify(data));
    const terminal = terminals.get(id);
    if (terminal) {
      terminal.write(data);
      console.log('[IPC] Write successful to terminal:', id);
      return { success: true };
    }
    console.error('[IPC] Terminal not found for write:', id, 'Available terminals:', Array.from(terminals.keys()));
    return { success: false, error: 'Terminal not found' };
  });

  ipcMain.handle('terminal:resize', (event, id: string, cols: number, rows: number) => {
    const terminal = terminals.get(id);
    if (terminal) {
      terminal.resize(cols, rows);
      return { success: true };
    }
    return { success: false, error: 'Terminal not found' };
  });

  ipcMain.handle('terminal:destroy', (event, id: string) => {
    const terminal = terminals.get(id);
    if (terminal) {
      terminal.kill();
      terminals.delete(id);
      return { success: true };
    }
    return { success: false, error: 'Terminal not found' };
  });

  // Claude instance management
  ipcMain.handle('claude:send', async (event, instanceKey: string, message: string) => {
    try {
      const response = await claudeManager.sendToInstance(instanceKey, message);
      return { success: true, response };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('claude:status', (event, instanceKey?: string) => {
    if (instanceKey) {
      return claudeManager.getStatus(instanceKey);
    }
    return claudeManager.getAllStatuses();
  });

  ipcMain.handle('claude:start', async (event, instanceKey: string) => {
    try {
      await claudeManager.initializeInstance(instanceKey);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('claude:startAll', async () => {
    try {
      await claudeManager.startAll();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // New IPC handlers for SDK-based functionality
  ipcMain.handle('claude:getConversationHistory', (event, instanceKey: string) => {
    try {
      const history = claudeManager.getConversationHistory(instanceKey);
      return { success: true, history };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('claude:clearConversationHistory', (event, instanceKey: string) => {
    try {
      claudeManager.clearConversationHistory(instanceKey);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('claude:setApiKey', (event, apiKey: string) => {
    try {
      claudeManager.setApiKey(apiKey);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Test if an API key is valid by attempting a minimal API call
  ipcMain.handle('claude:testApiKey', async (event, apiKey: string) => {
    try {
      // Import Anthropic SDK for creating a separate test client
      const Anthropic = require('@anthropic-ai/sdk').default;
      
      // Create a separate test client to avoid modifying global state
      const testClient = new Anthropic({
        apiKey: apiKey
      });
      
      try {
        // Try to make a minimal API call with the test client
        const response = await testClient.messages.create({
          model: 'claude-3-haiku-20240307', // Use cheapest model for testing
          max_tokens: 10,
          messages: [{
            role: 'user',
            content: 'Hi'
          }]
        });
        
        // If we get here, the API key is valid
        return { success: true, message: 'API key is valid' };
      } catch (testError: any) {
        // Check for specific API errors
        const errorMessage = testError.message || testError.toString();
        
        if (testError.status === 401 || errorMessage.includes('401') || errorMessage.includes('authentication')) {
          return { success: false, error: 'Invalid API key' };
        } else if (testError.status === 429 || errorMessage.includes('429')) {
          return { success: false, error: 'Rate limit exceeded' };
        } else if (testError.status === 400 || errorMessage.includes('400')) {
          return { success: false, error: 'Invalid request format' };
        } else {
          return { success: false, error: 'Could not validate API key: ' + errorMessage };
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to test API key' };
    }
  });

  // Context layer management
  ipcMain.handle('context:save', async (event, layer: db.ContextLayer) => {
    try {
      const id = await db.saveContextLayer(layer);
      return { success: true, id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('context:get', async (event, projectPath: string) => {
    try {
      const layers = await db.getContextLayers(projectPath);
      return { success: true, layers };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('context:update', async (event, id: number, updates: Partial<db.ContextLayer>) => {
    try {
      await db.updateContextLayer(id, updates);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('context:delete', async (event, id: number) => {
    try {
      await db.deleteContextLayer(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Chat archive management
  ipcMain.handle('chat:archive', async (event, projectPath: string, conversation: string, tokens: number, metadata?: any) => {
    try {
      await db.archiveChat(projectPath, conversation, tokens, metadata);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Enhanced Clipboard management with auto-save
  ipcMain.handle('clipboard:save', async (event, content: string, category?: string, tags?: string[]) => {
    try {
      // Get the project path from the current window or use default
      const projectPath = BrowserWindow.getFocusedWindow()?.webContents.getURL().includes('projectPath=') 
        ? new URL(BrowserWindow.getFocusedWindow()!.webContents.getURL()).searchParams.get('projectPath') || undefined
        : undefined;
      
      const clipboardManager = getClipboardManager(projectPath);
      
      // If content is JSON stringified entries array, save directly
      if (category === 'clipboard_data' && tags?.includes('auto_save')) {
        const entries = JSON.parse(content);
        await clipboardManager.save(entries);
      } else {
        // Legacy save for backward compatibility
        await db.saveClipboardItem(content, category, tags);
      }
      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clipboard:get', async (event, category?: string) => {
    try {
      // Get the project path from the current window or use default
      const projectPath = BrowserWindow.getFocusedWindow()?.webContents.getURL().includes('projectPath=') 
        ? new URL(BrowserWindow.getFocusedWindow()!.webContents.getURL()).searchParams.get('projectPath') || undefined
        : undefined;
      
      const clipboardManager = getClipboardManager(projectPath);
      
      // Return new format data
      const items = await clipboardManager.get();
      return { success: true, items };
    } catch (error: any) {
      // Fallback to legacy database
      try {
        const items = await db.getClipboardItems(category);
        return { success: true, items };
      } catch (dbError: any) {
        return { success: false, error: dbError.message };
      }
    }
  });

  // New clipboard handlers for enhanced features
  ipcMain.handle('clipboard:search', async (event, query: string) => {
    try {
      const projectPath = BrowserWindow.getFocusedWindow()?.webContents.getURL().includes('projectPath=') 
        ? new URL(BrowserWindow.getFocusedWindow()!.webContents.getURL()).searchParams.get('projectPath') || undefined
        : undefined;
      
      const clipboardManager = getClipboardManager(projectPath);
      const results = await clipboardManager.search(query);
      return { success: true, results };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clipboard:stats', async (event) => {
    try {
      const projectPath = BrowserWindow.getFocusedWindow()?.webContents.getURL().includes('projectPath=') 
        ? new URL(BrowserWindow.getFocusedWindow()!.webContents.getURL()).searchParams.get('projectPath') || undefined
        : undefined;
      
      const clipboardManager = getClipboardManager(projectPath);
      const stats = await clipboardManager.getStats();
      return { success: true, stats };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clipboard:export', async (event) => {
    try {
      const projectPath = BrowserWindow.getFocusedWindow()?.webContents.getURL().includes('projectPath=') 
        ? new URL(BrowserWindow.getFocusedWindow()!.webContents.getURL()).searchParams.get('projectPath') || undefined
        : undefined;
      
      const clipboardManager = getClipboardManager(projectPath);
      const data = await clipboardManager.export();
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clipboard:import', async (event, data: string) => {
    try {
      const projectPath = BrowserWindow.getFocusedWindow()?.webContents.getURL().includes('projectPath=') 
        ? new URL(BrowserWindow.getFocusedWindow()!.webContents.getURL()).searchParams.get('projectPath') || undefined
        : undefined;
      
      const clipboardManager = getClipboardManager(projectPath);
      await clipboardManager.import(data);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ResumeWork management
  ipcMain.handle('resumework:save', async (event, projectPath: string, content: string, tokens: number) => {
    try {
      await db.saveResumeWorkSnapshot(projectPath, content, tokens);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('resumework:get', async (event, projectPath: string) => {
    try {
      const snapshot = await db.getLatestResumeWork(projectPath);
      return { success: true, snapshot };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Token usage tracking
  ipcMain.handle('tokens:record', async (event, estimated: number, actual?: number, percentage?: number, warningLevel?: string) => {
    try {
      await db.recordTokenUsage(estimated, actual, percentage, warningLevel);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // RESUMEWORK.md generation
  ipcMain.handle('resumework:generate', async (event, projectPath: string) => {
    try {
      // This would integrate with ConPort to generate comprehensive status
      // For now, return basic project state
      const layers = await db.getContextLayers(projectPath);
      const snapshot = await db.getLatestResumeWork(projectPath);
      
      const projectState = {
        name: 'MythalTerminal',
        path: projectPath,
        lastUpdated: new Date(),
        totalTokens: layers.reduce((sum, layer) => sum + (layer.actual_tokens || layer.tokens), 0),
        contextLayers: layers.map(layer => ({
          id: layer.id!,
          type: layer.layer_type,
          content: layer.content,
          tokens: layer.actual_tokens || layer.tokens,
          isStarred: layer.is_starred,
          createdAt: new Date(layer.created_at!),
          lastAccessed: layer.last_accessed ? new Date(layer.last_accessed) : undefined
        })),
        recentDecisions: [],
        activeProgress: [],
        systemPatterns: []
      };
      
      return { success: true, projectState, lastSnapshot: snapshot };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Settings management
  ipcMain.handle('settings:setApiKey', (event, apiKey: string) => {
    try {
      const result = settingsManager.setApiKey(apiKey);
      if (result.success) {
        // Also update the claude manager with the new API key
        claudeManager.setApiKey(apiKey);
      }
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:getApiKey', () => {
    try {
      return settingsManager.getMaskedApiKey();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:deleteApiKey', () => {
    try {
      const result = settingsManager.deleteApiKey();
      if (result.success) {
        // Clear API key from claude manager as well
        claudeManager.setApiKey('');
      }
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:hasApiKey', () => {
    try {
      return { success: true, hasKey: settingsManager.hasApiKey() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:getTheme', () => {
    try {
      return { success: true, theme: settingsManager.getTheme() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:setTheme', (event, theme: 'dark' | 'light') => {
    try {
      return settingsManager.setTheme(theme);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:getTerminalSettings', () => {
    try {
      return { success: true, settings: settingsManager.getTerminalSettings() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:setTerminalSettings', (event, settings: any) => {
    try {
      return settingsManager.setTerminalSettings(settings);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Check if settings are in memory-only mode
  ipcMain.handle('settings:isInMemoryMode', () => {
    try {
      return { success: true, inMemoryMode: settingsManager.isInMemoryMode() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Claude instance event forwarding
  claudeManager.on('instance:started', (instanceKey) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('claude:started', instanceKey);
    });
  });

  claudeManager.on('instance:failed', (instanceKey) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('claude:failed', instanceKey);
    });
  });

  Object.keys({ main: 1, contextManager: 1, summarizer: 1, planner: 1 }).forEach(instanceKey => {
    claudeManager.on(`${instanceKey}:output`, (data) => {
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send(`claude:output:${instanceKey}`, data);
      });
    });

    claudeManager.on(`${instanceKey}:error`, (data) => {
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send(`claude:error:${instanceKey}`, data);
      });
    });
  });
}