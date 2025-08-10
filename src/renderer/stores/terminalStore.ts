import { create } from 'zustand';

interface TerminalState {
  claudeInstances: Record<string, 'idle' | 'running' | 'crashed' | 'restarting'>;
  currentConversation: string;
  initializeClaude: () => Promise<void>;
  sendToClaude: (instanceKey: string, message: string) => Promise<void>;
  archiveConversation: (projectPath: string) => Promise<void>;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  claudeInstances: {
    main: 'idle',
    contextManager: 'idle',
    summarizer: 'idle',
    planner: 'idle',
  },
  currentConversation: '',

  initializeClaude: async () => {
    try {
      await window.mythalAPI.claude.startAll();
      
      window.mythalAPI.claude.onStarted((instanceKey) => {
        set((state) => ({
          claudeInstances: {
            ...state.claudeInstances,
            [instanceKey]: 'running',
          },
        }));
      });

      window.mythalAPI.claude.onFailed((instanceKey) => {
        set((state) => ({
          claudeInstances: {
            ...state.claudeInstances,
            [instanceKey]: 'crashed',
          },
        }));
      });

      const statuses = await window.mythalAPI.claude.status();
      set({ claudeInstances: statuses });
    } catch (error) {
      console.error('Failed to initialize Claude instances:', error);
    }
  },

  sendToClaude: async (instanceKey: string, message: string) => {
    try {
      const result = await window.mythalAPI.claude.send(instanceKey, message);
      if (!result.success) {
        console.error('Failed to send to Claude:', result.error);
      }
      
      set((state) => ({
        currentConversation: state.currentConversation + `\nUser: ${message}\n`,
      }));
    } catch (error) {
      console.error('Error sending to Claude:', error);
    }
  },

  archiveConversation: async (projectPath: string) => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    const tokens = Math.ceil(currentConversation.length / 4);
    try {
      await window.mythalAPI.chat.archive(projectPath, currentConversation, tokens);
      set({ currentConversation: '' });
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  },
}));