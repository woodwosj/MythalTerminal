import { create } from 'zustand';
import { 
  countTokens, 
  calculateTokenUsage, 
  calculatePruningTarget,
  DEFAULT_TOKEN_LIMITS,
  type TokenUsage,
  type TokenLimits 
} from '../../shared/tokenUtils';

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
  tokenUsage: TokenUsage;
  tokenLimits: TokenLimits;
  
  // Core layer management
  loadContext: (projectPath: string) => Promise<void>;
  addLayer: (layer: ContextLayer) => Promise<void>;
  updateLayer: (id: number, updates: Partial<ContextLayer>) => Promise<void>;
  deleteLayer: (id: number) => Promise<void>;
  toggleStar: (id: number) => Promise<void>;
  
  // Intelligent context management
  calculateTokens: () => void;
  promoteLayer: (id: number, targetType: 'core' | 'active' | 'reference') => Promise<void>;
  demoteLayer: (id: number) => Promise<void>;
  archiveLayer: (id: number, reason?: string) => Promise<void>;
  autoArchiveOldLayers: (olderThanDays?: number) => Promise<void>;
  autoPrune: (targetPercentage?: number) => Promise<ContextLayer[]>;
  
  // Context layer suggestions
  getSuggestedArchives: () => ContextLayer[];
  getSuggestedPromotions: () => ContextLayer[];
  
  // Token management
  updateTokenLimits: (limits: Partial<TokenLimits>) => void;
  recalculateActualTokens: () => Promise<void>;
  
  // ConPort integration
  searchSimilarContext: (query: string, limit?: number) => Promise<ContextLayer[]>;
  getRelatedConversations: (layerId: number) => Promise<any[]>;
  logContextDecision: (summary: string, rationale: string, layerId?: number) => Promise<void>;
  syncWithConPort: () => Promise<void>;
}

export const useContextStore = create<ContextState>((set, get) => ({
  layers: [],
  totalTokens: 0,
  maxTokens: DEFAULT_TOKEN_LIMITS.maxTokens,
  starredTokens: 0,
  activeTokens: 0,
  referenceTokens: 0,
  archiveTokens: 0,
  tokenUsage: { estimated: 0, percentage: 0, warningLevel: 'safe' },
  tokenLimits: DEFAULT_TOKEN_LIMITS,

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

    const tokenUsage = calculateTokenUsage(total, get().tokenLimits);

    set({
      totalTokens: total,
      starredTokens: starred,
      activeTokens: active,
      referenceTokens: reference,
      archiveTokens: archive,
      tokenUsage,
    });
  },

  promoteLayer: async (id: number, targetType: 'core' | 'active' | 'reference') => {
    const layer = get().layers.find(l => l.id === id);
    if (!layer) return;
    
    // Log the promotion decision
    const updates = { 
      layer_type: targetType,
      is_starred: targetType === 'core' ? true : layer.is_starred,
      last_accessed: new Date(),
      access_count: (layer.access_count || 0) + 1
    };
    
    await get().updateLayer(id, updates);
  },

  demoteLayer: async (id: number) => {
    const layer = get().layers.find(l => l.id === id);
    if (!layer) return;
    
    let newType: 'reference' | 'archive' = 'reference';
    
    // Auto-demote based on usage patterns
    const daysSinceAccess = layer.last_accessed ? 
      (Date.now() - new Date(layer.last_accessed).getTime()) / (1000 * 60 * 60 * 24) : 999;
    
    if (daysSinceAccess > 7 || (layer.access_count || 0) < 3) {
      newType = 'archive';
    }
    
    await get().updateLayer(id, { 
      layer_type: newType,
      is_starred: false // Remove starring when demoting
    });
  },

  archiveLayer: async (id: number, reason = 'manual') => {
    const layer = get().layers.find(l => l.id === id);
    if (!layer) return;
    
    // Archive the conversation if it contains chat history
    if (layer.source === 'ai' && layer.content.includes('Claude:')) {
      try {
        await window.mythalAPI.chat.archive(
          layer.project_path, 
          layer.content, 
          layer.actual_tokens || layer.tokens,
          { reason, archived_from: layer.layer_type }
        );
      } catch (error) {
        console.warn('Failed to archive conversation:', error);
      }
    }
    
    await get().updateLayer(id, { layer_type: 'archive' });
  },

  autoArchiveOldLayers: async (olderThanDays = 30) => {
    const { layers } = get();
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    
    for (const layer of layers) {
      if (layer.layer_type === 'archive' || layer.is_starred || layer.is_immutable) continue;
      
      const lastAccessed = layer.last_accessed ? new Date(layer.last_accessed) : new Date(layer.created_at!);
      if (lastAccessed < cutoffDate && (layer.access_count || 0) < 2) {
        await get().archiveLayer(layer.id!, 'auto-archive-old');
      }
    }
    
    get().calculateTokens();
  },

  autoPrune: async (targetPercentage = 0.7) => {
    const { layers, totalTokens, tokenLimits } = get();
    const tokensToRemove = calculatePruningTarget(totalTokens, targetPercentage, tokenLimits);
    
    if (tokensToRemove <= 0) return [];
    
    // Sort layers by pruning priority (least important first)
    const prunableLayers = layers
      .filter(l => !l.is_starred && !l.is_immutable && l.layer_type !== 'core')
      .sort((a, b) => {
        // Priority: archive > reference > active
        const typeWeight = { archive: 0, reference: 1, active: 2 };
        if (a.layer_type !== b.layer_type) {
          return typeWeight[a.layer_type] - typeWeight[b.layer_type];
        }
        
        // Then by access count (lower first)
        const aAccess = a.access_count || 0;
        const bAccess = b.access_count || 0;
        if (aAccess !== bAccess) {
          return aAccess - bAccess;
        }
        
        // Then by last accessed (older first)
        const aTime = new Date(a.last_accessed || a.created_at!).getTime();
        const bTime = new Date(b.last_accessed || b.created_at!).getTime();
        return aTime - bTime;
      });
    
    const prunedLayers: ContextLayer[] = [];
    let tokensPruned = 0;
    
    for (const layer of prunableLayers) {
      if (tokensPruned >= tokensToRemove) break;
      
      const layerTokens = layer.actual_tokens || layer.tokens;
      await get().deleteLayer(layer.id!);
      prunedLayers.push(layer);
      tokensPruned += layerTokens;
    }
    
    get().calculateTokens();
    return prunedLayers;
  },

  getSuggestedArchives: () => {
    const { layers } = get();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    return layers.filter(layer => {
      if (layer.is_starred || layer.is_immutable || layer.layer_type === 'archive') return false;
      
      const lastAccessed = new Date(layer.last_accessed || layer.created_at!);
      const lowAccess = (layer.access_count || 0) < 2;
      const isOld = lastAccessed < thirtyDaysAgo;
      
      return isOld && lowAccess;
    });
  },

  getSuggestedPromotions: () => {
    const { layers } = get();
    const recentDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    return layers.filter(layer => {
      if (layer.layer_type === 'core' || layer.layer_type === 'active') return false;
      
      const lastAccessed = new Date(layer.last_accessed || layer.created_at!);
      const highAccess = (layer.access_count || 0) >= 5;
      const isRecent = lastAccessed > recentDate;
      
      return isRecent && highAccess;
    });
  },

  updateTokenLimits: (limits: Partial<TokenLimits>) => {
    const { tokenLimits } = get();
    const newLimits = { ...tokenLimits, ...limits };
    set({ tokenLimits: newLimits });
    get().calculateTokens();
  },

  recalculateActualTokens: async () => {
    const { layers } = get();
    
    for (const layer of layers) {
      const actualTokens = countTokens(layer.content);
      if (actualTokens !== layer.tokens) {
        await get().updateLayer(layer.id!, { 
          actual_tokens: actualTokens,
          tokens: actualTokens // Update estimated too
        });
      }
    }
    
    get().calculateTokens();
  },
  
  searchSimilarContext: async (query: string, limit = 5) => {
    try {
      // In a full implementation, this would use the ConPort MCP server
      // For now, we'll do a simple text-based search through existing layers
      const { layers } = get();
      const queryLower = query.toLowerCase();
      
      const scoredLayers = layers
        .map(layer => ({
          ...layer,
          relevanceScore: calculateRelevanceScore(layer.content.toLowerCase(), queryLower)
        }))
        .filter(layer => layer.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
      
      return scoredLayers;
    } catch (error) {
      console.error('Semantic search failed:', error);
      return [];
    }
  },
  
  getRelatedConversations: async (layerId: number) => {
    try {
      // This would query ConPort for conversations related to this layer
      // For now, return placeholder data
      const layer = get().layers.find(l => l.id === layerId);
      if (!layer) return [];
      
      // Simple keyword-based search through other layers
      const keywords = extractKeywords(layer.content);
      const relatedLayers = get().layers.filter(l => 
        l.id !== layerId && 
        keywords.some(keyword => l.content.toLowerCase().includes(keyword.toLowerCase()))
      );
      
      return relatedLayers.slice(0, 3);
    } catch (error) {
      console.error('Failed to get related conversations:', error);
      return [];
    }
  },
  
  logContextDecision: async (summary: string, rationale: string, layerId?: number) => {
    try {
      // This would log decisions to ConPort with proper linking
      // For now, we'll use a simple approach
      const decision = {
        summary,
        rationale,
        implementation_details: layerId ? `Related to context layer #${layerId}` : 'General context management',
        tags: ['context-management', 'intelligent-layers']
      };
      
      // In full implementation, would call ConPort MCP server
      console.log('Context decision logged:', decision);
      
      // If layerId provided, update the layer with decision reference
      if (layerId) {
        const layer = get().layers.find(l => l.id === layerId);
        if (layer) {
          await get().updateLayer(layerId, {
            last_accessed: new Date(),
            access_count: (layer.access_count || 0) + 1
          });
        }
      }
    } catch (error) {
      console.error('Failed to log context decision:', error);
    }
  },
  
  syncWithConPort: async () => {
    try {
      const { layers } = get();
      
      // This would sync context layers with ConPort knowledge base
      // For each layer, we could:
      // 1. Store as custom data in ConPort
      // 2. Create semantic embeddings
      // 3. Link related conversations
      
      console.log(`Syncing ${layers.length} context layers with ConPort...`);
      
      // Placeholder: In real implementation, would call ConPort MCP functions
      for (const layer of layers) {
        if (layer.layer_type !== 'archive') {
          // Log layer as custom data in ConPort
          const customDataEntry = {
            category: 'ContextLayers',
            key: `layer-${layer.id}-${layer.layer_type}`,
            value: {
              id: layer.id,
              type: layer.layer_type,
              content: layer.content.substring(0, 500), // Truncate for storage
              tokens: layer.actual_tokens || layer.tokens,
              isStarred: layer.is_starred,
              source: layer.source,
              createdAt: layer.created_at,
              lastAccessed: layer.last_accessed
            }
          };
          
          console.log('Would store in ConPort:', customDataEntry.key);
        }
      }
      
      // Log sync decision
      await get().logContextDecision(
        'Synced context layers with ConPort',
        `Synchronized ${layers.length} layers with knowledge base for semantic search`
      );
      
    } catch (error) {
      console.error('ConPort sync failed:', error);
    }
  },
}));

// Helper functions for semantic search
function calculateRelevanceScore(content: string, query: string): number {
  const queryWords = query.split(' ').filter(w => w.length > 2);
  if (queryWords.length === 0) return 0;
  
  let score = 0;
  for (const word of queryWords) {
    const regex = new RegExp(word, 'gi');
    const matches = content.match(regex);
    if (matches) {
      score += matches.length;
    }
  }
  
  // Normalize by content length and query length
  return score / (content.length / 1000 + queryWords.length);
}

function extractKeywords(content: string): string[] {
  // Simple keyword extraction - in production would use more sophisticated NLP
  const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
  const commonWords = new Set(['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'would', 'there', 'could', 'other', 'more', 'very', 'what', 'know', 'just', 'into', 'over', 'think', 'also', 'your', 'work', 'life', 'only', 'some', 'even', 'back', 'after', 'well', 'many', 'still', 'good', 'such', 'much', 'make', 'most', 'like', 'long', 'never', 'being', 'here', 'during', 'again', 'come', 'before', 'where', 'every', 'same', 'those', 'through', 'should', 'because']);
  
  const filtered = words.filter(word => !commonWords.has(word));
  const frequency = filtered.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(frequency)
    .filter(([_, count]) => count > 1)
    .sort(([_, a], [__, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);
}

// Export utility functions for use in components
export { 
  countTokens, 
  formatTokenCount, 
  getTokenUsageColor, 
  getTokenUsageBackground 
} from '../../shared/tokenUtils';