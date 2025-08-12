import { contextBridge, ipcRenderer } from 'electron';

const api = {
  terminal: {
    create: (id: string) => ipcRenderer.invoke('terminal:create', id),
    write: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    destroy: (id: string) => ipcRenderer.invoke('terminal:destroy', id),
    onOutput: (id: string, callback: (data: string) => void) => {
      const channel = `terminal:output:${id}`;
      const handler = (_: any, data: string) => callback(data);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
    onExit: (id: string, callback: (data: any) => void) => {
      const channel = `terminal:exit:${id}`;
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    }
  },
  
  claude: {
    send: (instanceKey: string, message: string) => ipcRenderer.invoke('claude:send', instanceKey, message),
    status: (instanceKey?: string) => ipcRenderer.invoke('claude:status', instanceKey),
    start: (instanceKey: string) => ipcRenderer.invoke('claude:start', instanceKey),
    startAll: () => ipcRenderer.invoke('claude:startAll'),
    onOutput: (instanceKey: string, callback: (data: string) => void) => {
      const channel = `claude:output:${instanceKey}`;
      const handler = (_: any, data: string) => callback(data);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
    onError: (instanceKey: string, callback: (data: string) => void) => {
      const channel = `claude:error:${instanceKey}`;
      const handler = (_: any, data: string) => callback(data);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
    onStarted: (callback: (instanceKey: string) => void) => {
      const handler = (_: any, instanceKey: string) => callback(instanceKey);
      ipcRenderer.on('claude:started', handler);
      return () => ipcRenderer.removeListener('claude:started', handler);
    },
    onFailed: (callback: (instanceKey: string) => void) => {
      const handler = (_: any, instanceKey: string) => callback(instanceKey);
      ipcRenderer.on('claude:failed', handler);
      return () => ipcRenderer.removeListener('claude:failed', handler);
    }
  },
  
  context: {
    save: (layer: any) => ipcRenderer.invoke('context:save', layer),
    get: (projectPath: string) => ipcRenderer.invoke('context:get', projectPath),
    update: (id: number, updates: any) => ipcRenderer.invoke('context:update', id, updates),
    delete: (id: number) => ipcRenderer.invoke('context:delete', id)
  },
  
  chat: {
    archive: (projectPath: string, conversation: string, tokens: number, metadata?: any) =>
      ipcRenderer.invoke('chat:archive', projectPath, conversation, tokens, metadata)
  },
  
  clipboard: {
    save: (content: string, category?: string, tags?: string[]) =>
      ipcRenderer.invoke('clipboard:save', content, category, tags),
    get: (category?: string) => ipcRenderer.invoke('clipboard:get', category)
  },
  
  resumework: {
    save: (projectPath: string, content: string, tokens: number) =>
      ipcRenderer.invoke('resumework:save', projectPath, content, tokens),
    get: (projectPath: string) => ipcRenderer.invoke('resumework:get', projectPath),
    generate: (projectPath: string) => ipcRenderer.invoke('resumework:generate', projectPath)
  },
  
  tokens: {
    record: (estimated: number, actual?: number, percentage?: number, warningLevel?: string) =>
      ipcRenderer.invoke('tokens:record', estimated, actual, percentage, warningLevel)
  },

  settings: {
    setApiKey: (apiKey: string) => ipcRenderer.invoke('settings:setApiKey', apiKey),
    getApiKey: () => ipcRenderer.invoke('settings:getApiKey'),
    deleteApiKey: () => ipcRenderer.invoke('settings:deleteApiKey'),
    hasApiKey: () => ipcRenderer.invoke('settings:hasApiKey'),
    getTheme: () => ipcRenderer.invoke('settings:getTheme'),
    setTheme: (theme: 'dark' | 'light') => ipcRenderer.invoke('settings:setTheme', theme),
    getTerminalSettings: () => ipcRenderer.invoke('settings:getTerminalSettings'),
    setTerminalSettings: (settings: any) => ipcRenderer.invoke('settings:setTerminalSettings', settings)
  }
};

contextBridge.exposeInMainWorld('mythalAPI', api);

export type MythalAPI = typeof api;