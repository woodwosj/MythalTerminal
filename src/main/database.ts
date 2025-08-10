import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs/promises';
// SECURITY FIX: Import security utilities
import { InputValidator, SECURITY_CONSTANTS } from '../shared/security';

let db: Database.Database | null = null;

export async function setupDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'mythalterminal.db');

  await fs.mkdir(userDataPath, { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS context_layers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_path TEXT NOT NULL,
      layer_type TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens INTEGER NOT NULL,
      actual_tokens INTEGER,
      is_starred BOOLEAN DEFAULT 0,
      is_immutable BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
      access_count INTEGER DEFAULT 0,
      source TEXT CHECK(source IN ('user', 'ai', 'system'))
    );

    CREATE TABLE IF NOT EXISTS chat_archives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_path TEXT NOT NULL,
      conversation TEXT NOT NULL,
      tokens INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS clipboard_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      category TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used DATETIME,
      use_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS planner_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      step_order INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      dependencies TEXT,
      skip_permissions BOOLEAN DEFAULT 0,
      timeout INTEGER DEFAULT 300000,
      status TEXT DEFAULT 'pending',
      result TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS resumework_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_path TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      estimated_tokens INTEGER NOT NULL,
      actual_tokens INTEGER,
      context_percentage REAL,
      warning_level TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_context_layers_project ON context_layers(project_path);
    CREATE INDEX IF NOT EXISTS idx_context_layers_starred ON context_layers(is_starred);
    CREATE INDEX IF NOT EXISTS idx_chat_archives_project ON chat_archives(project_path);
    CREATE INDEX IF NOT EXISTS idx_clipboard_category ON clipboard_items(category);
  `);
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export interface ContextLayer {
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

export async function saveContextLayer(layer: ContextLayer): Promise<number> {
  // SECURITY FIX: Validate input data
  if (!InputValidator.validatePath(layer.project_path)) {
    throw new Error('Invalid project path');
  }
  
  if (typeof layer.tokens !== 'number' || layer.tokens < 0) {
    throw new Error('Invalid token count');
  }
  
  if (!['core', 'active', 'reference', 'archive'].includes(layer.layer_type)) {
    throw new Error('Invalid layer type');
  }
  
  if (!['user', 'ai', 'system'].includes(layer.source)) {
    throw new Error('Invalid source type');
  }

  const stmt = getDatabase().prepare(`
    INSERT INTO context_layers (
      project_path, layer_type, content, tokens, actual_tokens,
      is_starred, is_immutable, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    layer.project_path,
    layer.layer_type,
    layer.content,
    layer.tokens,
    layer.actual_tokens || null,
    layer.is_starred ? 1 : 0,
    layer.is_immutable ? 1 : 0,
    layer.source
  );

  return result.lastInsertRowid as number;
}

export async function getContextLayers(projectPath: string): Promise<ContextLayer[]> {
  // SECURITY FIX: Validate project path
  if (!InputValidator.validatePath(projectPath)) {
    throw new Error('Invalid project path');
  }
  
  const stmt = getDatabase().prepare(`
    SELECT * FROM context_layers 
    WHERE project_path = ? 
    ORDER BY is_starred DESC, created_at DESC
  `);

  return stmt.all(projectPath) as ContextLayer[];
}

// SECURITY FIX: Prevent SQL injection by validating field names
export async function updateContextLayer(id: number, updates: Partial<ContextLayer>): Promise<void> {
  // SECURITY FIX: Validate all field names against whitelist
  const validFields = Object.keys(updates)
    .filter(key => key !== 'id')
    .filter(key => InputValidator.validateFieldName(key));
  
  if (validFields.length === 0) return;
  
  // SECURITY FIX: Only use validated field names in query construction
  const fields = validFields.map(key => `${key} = ?`);
  
  // SECURITY FIX: Extract values in same order as validated fields
  const values = validFields.map(key => {
    const value = updates[key as keyof ContextLayer];
    return value;
  });

  const stmt = getDatabase().prepare(`
    UPDATE context_layers 
    SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  stmt.run(...values, id);
}

export async function deleteContextLayer(id: number): Promise<void> {
  // SECURITY FIX: Validate ID is a positive integer
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid layer ID');
  }
  
  const stmt = getDatabase().prepare('DELETE FROM context_layers WHERE id = ?');
  stmt.run(id);
}

// SECURITY FIX: Replace 'any' with proper types
interface ChatMetadata {
  [key: string]: unknown;
}

export async function archiveChat(projectPath: string, conversation: string, tokens: number, metadata?: ChatMetadata): Promise<void> {
  const stmt = getDatabase().prepare(`
    INSERT INTO chat_archives (project_path, conversation, tokens, metadata)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(projectPath, conversation, tokens, JSON.stringify(metadata || {}));
}

export async function saveClipboardItem(content: string, category?: string, tags?: string[]): Promise<void> {
  const stmt = getDatabase().prepare(`
    INSERT INTO clipboard_items (content, category, tags)
    VALUES (?, ?, ?)
  `);

  stmt.run(content, category || null, tags ? JSON.stringify(tags) : null);
}

// SECURITY FIX: Replace 'any' with proper types
interface ClipboardItem {
  id: number;
  content: string;
  category?: string;
  tags?: string;
  created_at: Date;
  last_used?: Date;
  use_count: number;
}

export async function getClipboardItems(category?: string): Promise<ClipboardItem[]> {
  let stmt;
  if (category) {
    stmt = getDatabase().prepare('SELECT * FROM clipboard_items WHERE category = ? ORDER BY created_at DESC');
    return stmt.all(category) as ClipboardItem[];
  } else {
    stmt = getDatabase().prepare('SELECT * FROM clipboard_items ORDER BY created_at DESC');
    return stmt.all() as ClipboardItem[];
  }
}

export async function saveResumeWorkSnapshot(projectPath: string, content: string, tokens: number): Promise<void> {
  // SECURITY FIX: Validate inputs
  if (!InputValidator.validatePath(projectPath)) {
    throw new Error('Invalid project path');
  }
  
  if (typeof tokens !== 'number' || tokens < 0) {
    throw new Error('Invalid token count');
  }
  
  const stmt = getDatabase().prepare(`
    INSERT INTO resumework_snapshots (project_path, content, tokens)
    VALUES (?, ?, ?)
  `);

  stmt.run(projectPath, content, tokens);
}

// SECURITY FIX: Replace 'any' with proper types
interface ResumeWorkSnapshot {
  id: number;
  project_path: string;
  content: string;
  tokens: number;
  created_at: Date;
}

export async function getLatestResumeWork(projectPath: string): Promise<ResumeWorkSnapshot | undefined> {
  // SECURITY FIX: Validate project path
  if (!InputValidator.validatePath(projectPath)) {
    throw new Error('Invalid project path');
  }
  
  const stmt = getDatabase().prepare(`
    SELECT * FROM resumework_snapshots 
    WHERE project_path = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `);

  return stmt.get(projectPath) as ResumeWorkSnapshot | undefined;
}

export async function recordTokenUsage(estimated: number, actual?: number, percentage?: number, warningLevel?: string): Promise<void> {
  const stmt = getDatabase().prepare(`
    INSERT INTO token_usage (estimated_tokens, actual_tokens, context_percentage, warning_level)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(estimated, actual || null, percentage || null, warningLevel || null);
}