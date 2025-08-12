import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import Anthropic from '@anthropic-ai/sdk';
// SECURITY FIX: Import security utilities
import { InputValidator, ProcessLockManager, SECURITY_CONSTANTS } from '../shared/security';

interface ClaudeInstance {
  name: string;
  client: Anthropic | null;
  prompt: string;
  model: string;
  restartAttempts: number;
  lastRestart: Date | null;
  status: 'idle' | 'running' | 'crashed' | 'restarting';
  conversation: Anthropic.MessageParam[];
}

// SECURITY FIX: Replace 'any' with proper types
interface ClaudeSettings {
  apiKey?: string;
  mcpServers?: string[];
  [key: string]: unknown;
}

interface ClaudeConfig {
  workingDirs: string[];
  settings: ClaudeSettings;
  mcpServers: string[];
  apiKey?: string;
}

const CLAUDE_INSTANCES = {
  main: {
    name: 'main-terminal',
    prompt: 'You are the main terminal assistant. Respond to user commands and queries.',
    model: 'claude-3-5-sonnet-20241022'
  },
  contextManager: {
    name: 'context-manager',
    prompt: `You are a context management assistant. Your job is to:
    1. Monitor all terminal interactions
    2. Update RESUMEWORK.md with key information
    3. Identify important context to preserve
    4. Manage context layers efficiently
    Never respond to user - only process context.`,
    model: 'claude-3-5-sonnet-20241022'
  },
  summarizer: {
    name: 'summarizer',
    prompt: `You create executive summaries of context blocks.
    Be concise and focus on actionable information.
    Output JSON format: {"summary": "...", "keyPoints": []}`,
    model: 'claude-3-haiku-20240307'
  },
  planner: {
    name: 'planner',
    prompt: `You execute planned sequences of tasks.
    Follow the queue strictly and report status.
    Output JSON format: {"status": "...", "result": "...", "error": null}`,
    model: 'claude-3-5-sonnet-20241022'
  }
};

export class ClaudeInstanceManager extends EventEmitter {
  private instances: Map<string, ClaudeInstance> = new Map();
  private config: ClaudeConfig | null = null;
  private restartQueue: Set<string> = new Set();
  // SECURITY FIX: Add process lock management for race condition prevention
  private processLocks: Map<string, boolean> = new Map();
  private apiKey: string | null = null;

  async initialize() {
    this.config = await this.detectClaudeConfig();
    this.apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY || null;
    
    if (!this.apiKey) {
      console.warn('No Anthropic API key found. Claude functionality will be limited.');
    }
    
    for (const [key, config] of Object.entries(CLAUDE_INSTANCES)) {
      this.instances.set(key, {
        name: config.name,
        client: null,
        prompt: config.prompt,
        model: config.model,
        restartAttempts: 0,
        lastRestart: null,
        status: 'idle',
        conversation: []
      });
    }
  }

  async detectClaudeConfig(): Promise<ClaudeConfig> {
    const config: ClaudeConfig = {
      workingDirs: [],
      settings: {},
      mcpServers: [],
      apiKey: undefined
    };

    const configPaths = [
      path.join(process.cwd(), '.claude', 'settings.local.json'),
      path.join(process.cwd(), '.claude', 'settings.json'),
      path.join(os.homedir(), '.claude', 'settings.json')
    ];

    for (const configPath of configPaths) {
      try {
        const content = await fs.readFile(configPath, 'utf-8');
        const parsed = JSON.parse(content);
        config.settings = { ...config.settings, ...parsed };
        
        if (parsed.mcpServers) {
          config.mcpServers = [...new Set([...config.mcpServers, ...parsed.mcpServers])];
        }
        
        if (parsed.anthropicApiKey) {
          config.apiKey = parsed.anthropicApiKey;
        }
      } catch (error) {
        // Config file doesn't exist or is invalid
      }
    }

    const projectRoot = process.cwd();
    config.workingDirs = [projectRoot];
    
    try {
      const parentDir = path.dirname(projectRoot);
      const siblings = await fs.readdir(parentDir);
      for (const sibling of siblings) {
        const siblingPath = path.join(parentDir, sibling);
        const stat = await fs.stat(siblingPath);
        if (stat.isDirectory() && sibling !== path.basename(projectRoot)) {
          const hasGit = await fs.access(path.join(siblingPath, '.git')).then(() => true).catch(() => false);
          if (hasGit) {
            config.workingDirs.push(siblingPath);
          }
        }
      }
    } catch (error) {
      console.error('Error detecting working directories:', error);
    }

    return config;
  }

  async initializeInstance(instanceKey: string): Promise<void> {
    // SECURITY FIX: Validate instance key
    if (!InputValidator.validateInstanceKey(instanceKey)) {
      throw new Error(`Invalid instance key: ${instanceKey}`);
    }

    const instance = this.instances.get(instanceKey);
    if (!instance) {
      throw new Error(`Unknown instance: ${instanceKey}`);
    }

    if (instance.client && instance.status === 'running') {
      return;
    }

    if (!this.apiKey) {
      throw new Error('No Anthropic API key available. Please set ANTHROPIC_API_KEY environment variable.');
    }

    // SECURITY FIX: Acquire lock to prevent race conditions
    const releaseLock = await ProcessLockManager.acquireLock(`init-${instanceKey}`);
    
    try {
      // Double-check status after acquiring lock
      if (instance.client && instance.status === 'running') {
        releaseLock();
        return;
      }

      instance.status = 'restarting';

      // SECURITY FIX: Validate prompt length
      if (!InputValidator.validatePromptLength(instance.prompt)) {
        throw new Error('Prompt exceeds maximum allowed length');
      }

      // Initialize Anthropic client
      instance.client = new Anthropic({
        apiKey: this.apiKey,
      });

      // Initialize conversation with system prompt
      instance.conversation = [{
        role: 'assistant',
        content: `I am ${instance.name}, ready to assist. ${instance.prompt}`
      }];

      instance.status = 'running';
      instance.lastRestart = new Date();
      instance.restartAttempts = 0;

      this.emit('instance:started', instanceKey);
      
    } catch (error) {
      console.error(`Failed to initialize Claude instance ${instanceKey}:`, error);
      instance.status = 'crashed';
      this.handleCrash(instanceKey);
    } finally {
      // SECURITY FIX: Always release lock
      releaseLock();
    }
  }

  // SECURITY FIX: Prevent race conditions in crash handling with proper locking
  private async handleCrash(instanceKey: string) {
    const instance = this.instances.get(instanceKey);
    if (!instance) return;

    // SECURITY FIX: Use process lock to prevent concurrent crash handling
    const releaseLock = await ProcessLockManager.acquireLock(`crash-${instanceKey}`);
    
    try {
      if (this.restartQueue.has(instanceKey)) {
        return;
      }

      this.restartQueue.add(instanceKey);

      const timeSinceLastRestart = instance.lastRestart 
        ? Date.now() - instance.lastRestart.getTime()
        : Infinity;

      // SECURITY FIX: Use security constants instead of magic numbers
      if (timeSinceLastRestart < SECURITY_CONSTANTS.RESTART_COOLDOWN_MS) {
        instance.restartAttempts++;
      } else {
        instance.restartAttempts = 0;
      }

      if (instance.restartAttempts >= SECURITY_CONSTANTS.MAX_RESTART_ATTEMPTS) {
        console.error(`Claude instance ${instanceKey} failed to start after ${SECURITY_CONSTANTS.MAX_RESTART_ATTEMPTS} attempts`);
        this.emit('instance:failed', instanceKey);
        this.restartQueue.delete(instanceKey);
        return;
      }

      const delay = Math.min(
        SECURITY_CONSTANTS.MIN_RESTART_DELAY_MS * Math.pow(2, instance.restartAttempts), 
        SECURITY_CONSTANTS.MAX_RESTART_DELAY_MS
      );
      console.log(`Restarting Claude instance ${instanceKey} in ${delay}ms (attempt ${instance.restartAttempts + 1})`);

      setTimeout(async () => {
        this.restartQueue.delete(instanceKey);
        await this.initializeInstance(instanceKey);
      }, delay);
      
    } finally {
      // SECURITY FIX: Always release lock
      releaseLock();
    }
  }

  async sendToInstance(instanceKey: string, message: string): Promise<string> {
    // SECURITY FIX: Validate inputs
    if (!InputValidator.validateInstanceKey(instanceKey)) {
      throw new Error(`Invalid instance key: ${instanceKey}`);
    }
    
    if (!InputValidator.validateMessageLength(message)) {
      throw new Error('Message exceeds maximum allowed length');
    }

    const instance = this.instances.get(instanceKey);
    if (!instance || !instance.client || instance.status !== 'running') {
      await this.initializeInstance(instanceKey);
    }

    const instanceAfterInit = this.instances.get(instanceKey);
    if (!instanceAfterInit?.client || instanceAfterInit.status !== 'running') {
      throw new Error(`Claude instance ${instanceKey} is not available`);
    }

    try {
      // Add user message to conversation
      instanceAfterInit.conversation.push({
        role: 'user',
        content: message
      });

      // Send message to Claude API
      const response = await instanceAfterInit.client.messages.create({
        model: instanceAfterInit.model,
        max_tokens: 4096,
        messages: instanceAfterInit.conversation.slice(-10), // Keep last 10 messages for context
      });

      const assistantResponse = response.content
        .filter(content => content.type === 'text')
        .map(content => (content as any).text)
        .join('');

      // Add assistant response to conversation
      instanceAfterInit.conversation.push({
        role: 'assistant',
        content: assistantResponse
      });

      // Emit output for IPC forwarding
      this.emit(`${instanceKey}:output`, assistantResponse);

      return assistantResponse;
    } catch (error: any) {
      console.error(`Error sending message to Claude instance ${instanceKey}:`, error);
      this.emit(`${instanceKey}:error`, error.message);
      throw error;
    }
  }

  async startAll() {
    for (const key of this.instances.keys()) {
      await this.initializeInstance(key);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // SECURITY FIX: Properly clean up resources to prevent memory leaks
  shutdown() {
    for (const instance of this.instances.values()) {
      if (instance.client) {
        // Clean up conversation history
        instance.conversation = [];
        instance.client = null;
        instance.status = 'idle';
      }
    }
    
    // SECURITY FIX: Clear all restart queues and locks
    this.restartQueue.clear();
    ProcessLockManager.releaseAllLocks();
    
    // SECURITY FIX: Remove all event listeners from this instance
    this.removeAllListeners();
  }

  getStatus(instanceKey: string): string {
    return this.instances.get(instanceKey)?.status || 'unknown';
  }

  getAllStatuses(): Record<string, string> {
    const statuses: Record<string, string> = {};
    for (const [key, instance] of this.instances) {
      statuses[key] = instance.status;
    }
    return statuses;
  }

  // New method to get conversation history
  getConversationHistory(instanceKey: string): Anthropic.MessageParam[] {
    const instance = this.instances.get(instanceKey);
    return instance?.conversation || [];
  }

  // New method to clear conversation history
  clearConversationHistory(instanceKey: string): void {
    const instance = this.instances.get(instanceKey);
    if (instance) {
      instance.conversation = [];
    }
  }

  // New method to set API key
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    // Reinitialize all running instances with new API key
    for (const [key, instance] of this.instances) {
      if (instance.status === 'running') {
        instance.client = null;
        instance.status = 'idle';
        this.initializeInstance(key).catch(console.error);
      }
    }
  }
}