import { ipcMain, BrowserWindow } from 'electron';
import { ClaudeInstanceManager } from './claudeManager';
import * as db from './database';
import { spawn } from 'child_process';
import * as pty from 'node-pty';
import os from 'os';

let terminals: Map<string, any> = new Map();

export function setupIPC(claudeManager: ClaudeInstanceManager) {
  // Terminal management
  ipcMain.handle('terminal:create', (event, id: string) => {
    const shell = process.env.SHELL || (os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash');
    const terminal = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env as any
    });

    terminals.set(id, terminal);

    terminal.onData((data: string) => {
      event.sender.send(`terminal:output:${id}`, data);
    });

    terminal.onExit(({ exitCode, signal }) => {
      terminals.delete(id);
      event.sender.send(`terminal:exit:${id}`, { exitCode, signal });
    });

    return { success: true };
  });

  ipcMain.handle('terminal:write', (event, id: string, data: string) => {
    const terminal = terminals.get(id);
    if (terminal) {
      terminal.write(data);
      return { success: true };
    }
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
      await claudeManager.sendToInstance(instanceKey, message);
      return { success: true };
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
      await claudeManager.spawnInstance(instanceKey);
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

  // Clipboard management
  ipcMain.handle('clipboard:save', async (event, content: string, category?: string, tags?: string[]) => {
    try {
      await db.saveClipboardItem(content, category, tags);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clipboard:get', async (event, category?: string) => {
    try {
      const items = await db.getClipboardItems(category);
      return { success: true, items };
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