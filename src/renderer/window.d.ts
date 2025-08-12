declare global {
  interface Window {
    mythalAPI: {
      terminal: {
        create: (id: string) => Promise<{ success: boolean }>;
        write: (id: string, data: string) => Promise<{ success: boolean; error?: string }>;
        resize: (id: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>;
        destroy: (id: string) => Promise<{ success: boolean; error?: string }>;
        onOutput: (id: string, callback: (data: string) => void) => () => void;
        onExit: (id: string, callback: (data: any) => void) => () => void;
      };
      
      claude: {
        send: (instanceKey: string, message: string) => Promise<{ success: boolean; error?: string }>;
        status: (instanceKey?: string) => Promise<any>;
        start: (instanceKey: string) => Promise<{ success: boolean; error?: string }>;
        startAll: () => Promise<{ success: boolean; error?: string }>;
        onOutput: (instanceKey: string, callback: (data: string) => void) => () => void;
        onError: (instanceKey: string, callback: (data: string) => void) => () => void;
        onStarted: (callback: (instanceKey: string) => void) => () => void;
        onFailed: (callback: (instanceKey: string) => void) => () => void;
      };
      
      context: {
        save: (layer: any) => Promise<{ success: boolean; id?: number; error?: string }>;
        get: (projectPath: string) => Promise<{ success: boolean; layers?: any[]; error?: string }>;
        update: (id: number, updates: any) => Promise<{ success: boolean; error?: string }>;
        delete: (id: number) => Promise<{ success: boolean; error?: string }>;
      };
      
      chat: {
        archive: (projectPath: string, conversation: string, tokens: number, metadata?: any) =>
          Promise<{ success: boolean; error?: string }>;
      };
      
      clipboard: {
        save: (content: string, category?: string, tags?: string[]) =>
          Promise<{ success: boolean; error?: string }>;
        get: (category?: string) => Promise<{ success: boolean; items?: any[]; error?: string }>;
      };
      
      resumework: {
        save: (projectPath: string, content: string, tokens: number) =>
          Promise<{ success: boolean; error?: string }>;
        get: (projectPath: string) => Promise<{ success: boolean; snapshot?: any; error?: string }>;
      };
      
      tokens: {
        record: (estimated: number, actual?: number, percentage?: number, warningLevel?: string) =>
          Promise<{ success: boolean; error?: string }>;
      };

      settings: {
        setApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
        getApiKey: () => Promise<{ success: boolean; apiKey?: string; error?: string }>;
        deleteApiKey: () => Promise<{ success: boolean; error?: string }>;
        hasApiKey: () => Promise<{ success: boolean; hasKey?: boolean; error?: string }>;
        getTheme: () => Promise<{ success: boolean; theme?: 'dark' | 'light'; error?: string }>;
        setTheme: (theme: 'dark' | 'light') => Promise<{ success: boolean; error?: string }>;
        getTerminalSettings: () => Promise<{ success: boolean; settings?: any; error?: string }>;
        setTerminalSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}

export {};