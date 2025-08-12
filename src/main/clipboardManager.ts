import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

export interface ClipboardData {
  version: string;
  entries: any[];
  lastModified: number;
  metadata: {
    totalEntries: number;
    categories: Record<string, number>;
    topTags: string[];
  };
}

export class ClipboardManager {
  private dataPath: string;
  private clipboardFile: string;
  private indexFile: string;
  private backupFile: string;
  private saveQueue: Promise<void> = Promise.resolve();
  private saveTimer: NodeJS.Timeout | null = null;
  private inMemoryCache: ClipboardData | null = null;

  constructor(projectPath?: string) {
    // Use project-specific storage or fallback to app data
    const baseDir = projectPath || app.getPath('userData');
    this.dataPath = path.join(baseDir, '.mythal', 'clipboard');
    this.clipboardFile = path.join(this.dataPath, 'clipboard.json');
    this.indexFile = path.join(this.dataPath, 'index.json');
    this.backupFile = path.join(this.dataPath, 'clipboard.backup.json');
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure directory structure exists
      if (!(await exists(this.dataPath))) {
        await mkdir(this.dataPath, { recursive: true });
      }
      
      // Load existing data or create new
      await this.loadData();
    } catch (error) {
      console.error('Failed to initialize clipboard manager:', error);
    }
  }

  private async loadData(): Promise<void> {
    try {
      if (await exists(this.clipboardFile)) {
        const data = await readFile(this.clipboardFile, 'utf-8');
        this.inMemoryCache = JSON.parse(data);
      } else {
        // Initialize with empty data
        this.inMemoryCache = {
          version: '2.0.0',
          entries: [],
          lastModified: Date.now(),
          metadata: {
            totalEntries: 0,
            categories: {},
            topTags: []
          }
        };
        await this.saveData();
      }
    } catch (error) {
      console.error('Failed to load clipboard data:', error);
      // Try to restore from backup
      await this.restoreFromBackup();
    }
  }

  private async restoreFromBackup(): Promise<void> {
    try {
      if (await exists(this.backupFile)) {
        const data = await readFile(this.backupFile, 'utf-8');
        // Validate backup data before using it
        const parsed = JSON.parse(data);
        if (parsed && parsed.version && Array.isArray(parsed.entries)) {
          this.inMemoryCache = parsed;
          await this.saveData(); // Save to main file
        } else {
          throw new Error('Invalid backup file format');
        }
      }
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      // Initialize with empty data as last resort
      this.inMemoryCache = {
        version: '2.0.0',
        entries: [],
        lastModified: Date.now(),
        metadata: {
          totalEntries: 0,
          categories: {},
          topTags: []
        }
      };
    }
  }

  public async save(entries: any[]): Promise<void> {
    // Queue save operation to prevent conflicts
    // Fix: Ensure errors are properly isolated and don't break the queue
    this.saveQueue = this.saveQueue
      .then(async () => {
        try {
          // Update cache
          this.inMemoryCache = {
            version: '2.0.0',
            entries,
            lastModified: Date.now(),
            metadata: this.generateMetadata(entries)
          };
          
          // Debounce actual file write
          if (this.saveTimer) {
            clearTimeout(this.saveTimer);
          }
          
          this.saveTimer = setTimeout(() => {
            this.saveData().catch(error => {
              console.error('Failed to write clipboard data in timer:', error);
            });
          }, 100); // Small delay to batch rapid saves
        } catch (error) {
          console.error('Failed to save clipboard data:', error);
          throw error;
        }
      })
      .catch(error => {
        // Ensure queue continues even if one save fails
        console.error('Save queue error (isolated):', error);
        // Return resolved promise to continue the queue
        return Promise.resolve();
      });
    
    return this.saveQueue;
  }

  private async saveData(): Promise<void> {
    if (!this.inMemoryCache) return;
    
    try {
      const data = JSON.stringify(this.inMemoryCache, null, 2);
      
      // Create backup before overwriting
      if (await exists(this.clipboardFile)) {
        await fs.promises.copyFile(this.clipboardFile, this.backupFile);
      }
      
      // Write main file
      await writeFile(this.clipboardFile, data, 'utf-8');
      
      // Update index for MCP access
      await this.updateIndex();
    } catch (error) {
      console.error('Failed to write clipboard data:', error);
      throw error;
    }
  }

  private async updateIndex(): Promise<void> {
    if (!this.inMemoryCache) return;
    
    try {
      // Create searchable index for MCP tools
      const index = {
        version: '2.0.0',
        lastUpdated: Date.now(),
        totalEntries: this.inMemoryCache.entries.length,
        categories: this.inMemoryCache.metadata.categories,
        tags: this.extractAllTags(),
        recentEntries: this.inMemoryCache.entries.slice(0, 10).map(e => ({
          id: e.id,
          type: e.type,
          category: e.category,
          preview: e.content.substring(0, 100),
          timestamp: e.metadata.timestamp
        })),
        frequentEntries: this.inMemoryCache.entries
          .sort((a, b) => (b.metadata?.frequency || 0) - (a.metadata?.frequency || 0))
          .slice(0, 10)
          .map(e => ({
            id: e.id,
            type: e.type,
            category: e.category,
            frequency: e.metadata?.frequency || 0
          }))
      };
      
      await writeFile(this.indexFile, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to update index:', error);
    }
  }

  private generateMetadata(entries: any[]): ClipboardData['metadata'] {
    const categories: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    
    entries.forEach(entry => {
      // Count categories
      const category = entry.category || 'general';
      categories[category] = (categories[category] || 0) + 1;
      
      // Count tags
      if (entry.tags && Array.isArray(entry.tags)) {
        entry.tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    
    // Get top tags
    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag]) => tag);
    
    return {
      totalEntries: entries.length,
      categories,
      topTags
    };
  }

  private extractAllTags(): string[] {
    if (!this.inMemoryCache) return [];
    
    const tagSet = new Set<string>();
    this.inMemoryCache.entries.forEach(entry => {
      if (entry.tags && Array.isArray(entry.tags)) {
        entry.tags.forEach((tag: string) => tagSet.add(tag));
      }
    });
    
    return Array.from(tagSet);
  }

  public async get(): Promise<any[]> {
    if (!this.inMemoryCache) {
      await this.loadData();
    }
    return this.inMemoryCache?.entries || [];
  }

  public async getByCategory(category: string): Promise<any[]> {
    const entries = await this.get();
    return entries.filter(e => e.category === category);
  }

  public async search(query: string): Promise<any[]> {
    const entries = await this.get();
    const lowerQuery = query.toLowerCase();
    
    return entries.filter(e => 
      e.content?.toLowerCase().includes(lowerQuery) ||
      e.tags?.some((tag: string) => tag.toLowerCase().includes(lowerQuery)) ||
      e.category?.toLowerCase().includes(lowerQuery)
    );
  }

  public async getStats(): Promise<any> {
    if (!this.inMemoryCache) {
      await this.loadData();
    }
    
    return {
      totalEntries: this.inMemoryCache?.entries.length || 0,
      lastModified: this.inMemoryCache?.lastModified || null,
      categories: this.inMemoryCache?.metadata.categories || {},
      topTags: this.inMemoryCache?.metadata.topTags || [],
      storageSize: await this.getStorageSize()
    };
  }

  private async getStorageSize(): Promise<number | null> {
    try {
      if (await exists(this.clipboardFile)) {
        const stats = await fs.promises.stat(this.clipboardFile);
        return stats.size;
      }
    } catch (error) {
      console.error('Failed to get storage size:', error);
      return null; // Return null on error, not 0
    }
    return null; // Return null when file doesn't exist
  }

  public async clear(): Promise<void> {
    this.inMemoryCache = {
      version: '2.0.0',
      entries: [],
      lastModified: Date.now(),
      metadata: {
        totalEntries: 0,
        categories: {},
        topTags: []
      }
    };
    await this.saveData();
  }

  public async export(): Promise<string> {
    if (!this.inMemoryCache) {
      await this.loadData();
    }
    return JSON.stringify(this.inMemoryCache, null, 2);
  }

  public async import(data: string): Promise<void> {
    try {
      const imported = JSON.parse(data);
      if (imported.version && imported.entries) {
        this.inMemoryCache = imported;
        await this.saveData();
      } else {
        throw new Error('Invalid clipboard data format');
      }
    } catch (error) {
      console.error('Failed to import clipboard data:', error);
      throw error;
    }
  }
}

// Singleton instance per project
const clipboardManagers = new Map<string, ClipboardManager>();

export function getClipboardManager(projectPath?: string): ClipboardManager {
  const key = projectPath || 'default';
  if (!clipboardManagers.has(key)) {
    clipboardManagers.set(key, new ClipboardManager(projectPath));
  }
  return clipboardManagers.get(key)!;
}