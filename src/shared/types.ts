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

export interface PlanStep {
  id: string;
  prompt: string;
  dependencies: string[];
  skipPermissions: boolean;
  timeout: number;
  retryPolicy: {
    maxAttempts: number;
    backoff: 'exponential' | 'linear';
  };
  hooks?: {
    onStart?: string;
    onSuccess?: string;
    onFailure?: string;
  };
  status?: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface ClipboardItem {
  id?: number;
  content: string;
  category?: string;
  tags?: string[];
  created_at?: Date;
  last_used?: Date;
  use_count?: number;
}

export interface ChatArchive {
  id?: number;
  project_path: string;
  conversation: string;
  tokens: number;
  created_at?: Date;
  metadata?: any;
}

export interface TokenUsage {
  estimated: number;
  actual?: number;
  percentage: number;
  warningLevel: 'safe' | 'warning' | 'critical';
}