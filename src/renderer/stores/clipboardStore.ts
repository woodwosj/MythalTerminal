import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import debounce from 'lodash/debounce';

// Memory protection constants
const MAX_ENTRIES = 100;
const MAX_CONTENT_SIZE = 1024 * 1024; // 1MB per entry

// Content type detection patterns
const URL_PATTERN = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
const CODE_PATTERNS = {
  javascript: /(?:function|const|let|var|=>|class|import|export|async|await)/,
  python: /(?:def |class |import |from |if __name__|print\(|lambda )/,
  sql: /(?:SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s/i,
  json: /^\s*[\[{][\s\S]*[\]}]\s*$/,
  markdown: /(?:^#{1,6}\s|^\*\s|^\d+\.\s|```|^\|.*\|$)/m,
  shell: /(?:^\$|^>|npm |yarn |git |cd |ls |mkdir |rm |cp |mv |chmod )/,
};

export type ContentType = 'text' | 'url' | 'code' | 'json' | 'markdown' | 'shell' | 'command';

export interface ClipboardEntry {
  id: string;
  content: string;
  type: ContentType;
  category: string;
  tags: string[];
  metadata: {
    length: number;
    lines?: number;
    language?: string;
    url?: string;
    timestamp: number;
    lastModified: number;
    frequency: number; // Usage frequency
  };
  searchableText: string; // Lowercase version for fast searching
}

interface ClipboardStore {
  entries: ClipboardEntry[];
  currentContent: string;
  searchQuery: string;
  selectedCategory: string | null;
  selectedTags: string[];
  isLoading: boolean;
  lastSaveTime: number | null;
  isPasteEvent: boolean; // Track if content came from paste
  
  // Actions
  setCurrentContent: (content: string, fromPaste?: boolean) => void;
  addEntry: (content: string) => Promise<void>;
  updateEntry: (id: string, updates: Partial<ClipboardEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  toggleTag: (tag: string) => void;
  loadEntries: () => Promise<void>;
  
  // Smart features
  detectContentType: (content: string) => ContentType;
  extractTags: (content: string) => string[];
  getFilteredEntries: () => ClipboardEntry[];
  incrementFrequency: (id: string) => void;
  
  // Auto-save
  autoSave: () => Promise<void>;
  debouncedAutoSave: ReturnType<typeof debounce>;
}

const useClipboardStore = create<ClipboardStore>()(
  subscribeWithSelector((set, get) => ({
    entries: [],
    currentContent: '',
    searchQuery: '',
    selectedCategory: null,
    selectedTags: [],
    isLoading: false,
    lastSaveTime: null,
    isPasteEvent: false,

    setCurrentContent: (content, fromPaste = false) => {
      set({ currentContent: content, isPasteEvent: fromPaste });
      // Only auto-save if this is a paste event
      if (fromPaste && content.trim()) {
        get().debouncedAutoSave();
      }
    },

    detectContentType: (content) => {
      if (!content || content.trim().length === 0) return 'text';
      
      // Check for URLs
      if (URL_PATTERN.test(content.trim())) return 'url';
      
      // Check for JSON
      try {
        JSON.parse(content);
        return 'json';
      } catch {}
      
      // Check for code patterns
      for (const [lang, pattern] of Object.entries(CODE_PATTERNS)) {
        if (pattern.test(content)) {
          if (lang === 'shell') return 'shell';
          if (lang === 'markdown') return 'markdown';
          return 'code';
        }
      }
      
      // Check for terminal commands
      if (content.startsWith('$') || content.startsWith('>')) {
        return 'command';
      }
      
      return 'text';
    },

    extractTags: (content) => {
      const tags = new Set<string>();
      
      // Extract hashtags
      const hashtagMatches = content.match(/#\w+/g);
      if (hashtagMatches) {
        hashtagMatches.forEach(tag => tags.add(tag.substring(1).toLowerCase()));
      }
      
      // Extract TODO/FIXME/NOTE tags
      const todoMatches = content.match(/\b(TODO|FIXME|NOTE|HACK|BUG|WARNING)[:|\s]/gi);
      if (todoMatches) {
        todoMatches.forEach(tag => tags.add(tag.replace(/[:|\s]/g, '').toLowerCase()));
      }
      
      // Extract file extensions
      const fileExtMatches = content.match(/\.\w{2,4}\b/g);
      if (fileExtMatches) {
        fileExtMatches.forEach(ext => {
          const cleaned = ext.substring(1).toLowerCase();
          if (['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'sh', 'sql', 'json', 'xml', 'yaml', 'yml', 'md'].includes(cleaned)) {
            tags.add(cleaned);
          }
        });
      }
      
      return Array.from(tags);
    },

    addEntry: async (content) => {
      if (!content.trim()) return;
      
      // Memory protection: check content size
      if (content.length > MAX_CONTENT_SIZE) {
        console.warn(`Content too large (${content.length} bytes), truncating to ${MAX_CONTENT_SIZE} bytes`);
        content = content.substring(0, MAX_CONTENT_SIZE);
      }
      
      const state = get();
      const type = state.detectContentType(content);
      const autoTags = state.extractTags(content);
      
      const entry: ClipboardEntry = {
        id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content,
        type,
        category: type === 'url' ? 'links' : 
                  type === 'code' || type === 'json' ? 'code' :
                  type === 'command' || type === 'shell' ? 'commands' : 'general',
        tags: autoTags,
        metadata: {
          length: content.length,
          lines: content.split('\n').length,
          language: type === 'code' ? detectProgrammingLanguage(content) : undefined,
          url: type === 'url' ? content.trim() : undefined,
          timestamp: Date.now(),
          lastModified: Date.now(),
          frequency: 0
        },
        searchableText: content.toLowerCase()
      };
      
      // Check for duplicates
      const existingIndex = state.entries.findIndex(e => 
        e.content === content || 
        (e.metadata.url && e.metadata.url === entry.metadata.url)
      );
      
      if (existingIndex >= 0) {
        // Update existing entry's frequency and timestamp
        const existing = state.entries[existingIndex];
        existing.metadata.frequency++;
        existing.metadata.lastModified = Date.now();
        set({ entries: [...state.entries] });
      } else {
        // Add new entry with automatic pruning
        let newEntries = [entry, ...state.entries];
        
        // Memory protection: prune oldest entries if we exceed MAX_ENTRIES
        if (newEntries.length > MAX_ENTRIES) {
          // Keep the most frequently used and recent entries
          newEntries = newEntries
            .sort((a, b) => {
              // Prioritize by frequency first
              const freqDiff = (b.metadata.frequency || 0) - (a.metadata.frequency || 0);
              if (freqDiff !== 0) return freqDiff;
              // Then by recency
              return b.metadata.lastModified - a.metadata.lastModified;
            })
            .slice(0, MAX_ENTRIES);
        }
        
        set({ entries: newEntries });
      }
      
      // Persist to backend
      await state.autoSave();
      
      // Clear current content and reset paste flag after successful save
      set({ currentContent: '', lastSaveTime: Date.now(), isPasteEvent: false });
    },

    updateEntry: async (id, updates) => {
      set(state => ({
        entries: state.entries.map(entry =>
          entry.id === id 
            ? { ...entry, ...updates, metadata: { ...entry.metadata, lastModified: Date.now() } }
            : entry
        )
      }));
      await get().autoSave();
    },

    deleteEntry: async (id) => {
      set(state => ({
        entries: state.entries.filter(entry => entry.id !== id)
      }));
      await get().autoSave();
    },

    setSearchQuery: (query) => set({ searchQuery: query }),
    
    setSelectedCategory: (category) => set({ selectedCategory: category }),
    
    toggleTag: (tag) => set(state => ({
      selectedTags: state.selectedTags.includes(tag)
        ? state.selectedTags.filter(t => t !== tag)
        : [...state.selectedTags, tag]
    })),

    getFilteredEntries: () => {
      const state = get();
      let filtered = [...state.entries];
      
      // Filter by category
      if (state.selectedCategory) {
        filtered = filtered.filter(e => e.category === state.selectedCategory);
      }
      
      // Filter by tags
      if (state.selectedTags.length > 0) {
        filtered = filtered.filter(e => 
          state.selectedTags.some(tag => e.tags.includes(tag))
        );
      }
      
      // Filter by search query
      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(e => 
          e.searchableText.includes(query) ||
          e.tags.some(tag => tag.includes(query)) ||
          e.category.includes(query)
        );
      }
      
      // Sort by frequency and recency
      filtered.sort((a, b) => {
        // First by frequency
        if (a.metadata.frequency !== b.metadata.frequency) {
          return b.metadata.frequency - a.metadata.frequency;
        }
        // Then by last modified
        return b.metadata.lastModified - a.metadata.lastModified;
      });
      
      return filtered;
    },

    incrementFrequency: (id) => {
      set(state => ({
        entries: state.entries.map(entry =>
          entry.id === id 
            ? { ...entry, metadata: { ...entry.metadata, frequency: entry.metadata.frequency + 1 } }
            : entry
        )
      }));
    },

    loadEntries: async () => {
      set({ isLoading: true });
      try {
        const result = await window.mythalAPI.clipboard.get();
        if (result.success && result.items) {
          // Transform legacy items to new format if needed
          const entries = result.items.map((item: any) => {
            if (item.id && item.content && item.type) {
              return item; // Already in new format
            }
            
            // Convert from legacy format
            const content = item.content || '';
            const type = get().detectContentType(content);
            return {
              id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              content,
              type,
              category: item.category || 'general',
              tags: item.tags || get().extractTags(content),
              metadata: {
                length: content.length,
                lines: content.split('\n').length,
                timestamp: new Date(item.created_at || Date.now()).getTime(),
                lastModified: new Date(item.created_at || Date.now()).getTime(),
                frequency: 0
              },
              searchableText: content.toLowerCase()
            };
          });
          set({ entries });
        }
      } catch (error) {
        console.error('Failed to load clipboard entries:', error);
      } finally {
        set({ isLoading: false });
      }
    },

    autoSave: async () => {
      const state = get();
      
      // If this is a paste event and we have content, add it as an entry
      if (state.isPasteEvent && state.currentContent.trim()) {
        await state.addEntry(state.currentContent);
        return; // addEntry will handle the save
      }
      
      try {
        // Save all entries to backend
        await window.mythalAPI.clipboard.save(
          JSON.stringify(state.entries),
          'clipboard_data',
          ['auto_save']
        );
        set({ lastSaveTime: Date.now() });
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    },

    debouncedAutoSave: debounce(async () => {
      await get().autoSave();
    }, 300)
  }))
);

// Helper function to detect programming language
function detectProgrammingLanguage(content: string): string | undefined {
  const patterns: Record<string, RegExp> = {
    javascript: /(?:function|const|let|var|=>|class|import|export|async|await|console\.log)/,
    typescript: /(?:interface|type |enum |namespace |declare |implements |private |public |protected)/,
    python: /(?:def |class |import |from |if __name__|print\(|lambda |with |as |try:|except:)/,
    java: /(?:public class |private |protected |static |void |int |String |boolean |extends |implements)/,
    cpp: /(?:#include|namespace |using |cout|cin|std::|template|typename)/,
    go: /(?:package |func |import |type |struct |interface |defer |go |chan )/,
    rust: /(?:fn |let mut |impl |pub |struct |enum |match |use |mod |trait )/,
    sql: /(?:SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER|DROP)\s/i,
  };
  
  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(content)) {
      return lang;
    }
  }
  
  return undefined;
}

export default useClipboardStore;