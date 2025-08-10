import { create } from 'zustand';

interface ContextLayer {
  id?: number;
  project_path: string;
  layer_type: 'core' | 'active' | 'reference' | 'archive';
  content: string;
  tokens: number;
  actual_tokens?: number;
  is_starred: boolean;
  is_immutable: boolean;
  created_at?: Date;
  updated_at?: Date;
  last_accessed?: Date;
  access_count?: number;
  source: 'user' | 'ai' | 'system';
}

interface ContextState {
  layers: ContextLayer[];
  totalTokens: number;
  maxTokens: number;
  starredTokens: number;
  activeTokens: number;
  referenceTokens: number;
  archiveTokens: number;
  
  loadContext: (projectPath: string) => Promise<void>;
  addLayer: (layer: ContextLayer) => Promise<void>;
  updateLayer: (id: number, updates: Partial<ContextLayer>) => Promise<void>;
  deleteLayer: (id: number) => Promise<void>;
  toggleStar: (id: number) => Promise<void>;
  calculateTokens: () => void;
}

export const useContextStore = create<ContextState>((set, get) => ({
  layers: [],
  totalTokens: 0,
  maxTokens: 200000,
  starredTokens: 0,
  activeTokens: 0,
  referenceTokens: 0,
  archiveTokens: 0,

  loadContext: async (projectPath: string) => {
    try {
      const result = await window.mythalAPI.context.get(projectPath);
      if (result.success) {
        set({ layers: result.layers });
        get().calculateTokens();
      }
    } catch (error) {
      console.error('Failed to load context:', error);
    }
  },

  addLayer: async (layer: ContextLayer) => {
    try {
      const result = await window.mythalAPI.context.save(layer);
      if (result.success) {
        const newLayer = { ...layer, id: result.id };
        set((state) => ({
          layers: [...state.layers, newLayer],
        }));
        get().calculateTokens();
      }
    } catch (error) {
      console.error('Failed to add layer:', error);
    }
  },

  updateLayer: async (id: number, updates: Partial<ContextLayer>) => {
    try {
      const result = await window.mythalAPI.context.update(id, updates);
      if (result.success) {
        set((state) => ({
          layers: state.layers.map((layer) =>
            layer.id === id ? { ...layer, ...updates } : layer
          ),
        }));
        get().calculateTokens();
      }
    } catch (error) {
      console.error('Failed to update layer:', error);
    }
  },

  deleteLayer: async (id: number) => {
    try {
      const result = await window.mythalAPI.context.delete(id);
      if (result.success) {
        set((state) => ({
          layers: state.layers.filter((layer) => layer.id !== id),
        }));
        get().calculateTokens();
      }
    } catch (error) {
      console.error('Failed to delete layer:', error);
    }
  },

  toggleStar: async (id: number) => {
    const layer = get().layers.find((l) => l.id === id);
    if (layer) {
      await get().updateLayer(id, { is_starred: !layer.is_starred });
    }
  },

  calculateTokens: () => {
    const { layers } = get();
    
    let total = 0;
    let starred = 0;
    let active = 0;
    let reference = 0;
    let archive = 0;

    for (const layer of layers) {
      const tokens = layer.actual_tokens || layer.tokens;
      total += tokens;

      if (layer.is_starred) {
        starred += tokens;
      }

      switch (layer.layer_type) {
        case 'core':
          starred += tokens;
          break;
        case 'active':
          active += tokens;
          break;
        case 'reference':
          reference += tokens;
          break;
        case 'archive':
          archive += tokens;
          break;
      }
    }

    set({
      totalTokens: total,
      starredTokens: starred,
      activeTokens: active,
      referenceTokens: reference,
      archiveTokens: archive,
    });
  },
}));