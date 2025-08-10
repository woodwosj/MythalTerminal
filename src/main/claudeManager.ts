import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
// SECURITY FIX: Import security utilities
import { InputValidator, ProcessLockManager, SECURITY_CONSTANTS, AllowedModel } from '../shared/security';

interface ClaudeInstance {
  name: string;
  process: ChildProcess | null;
  prompt: string;
  restartAttempts: number;
  lastRestart: Date | null;
  status: 'idle' | 'running' | 'crashed' | 'restarting';
}

// SECURITY FIX: Replace 'any' with proper types
interface ClaudeSettings {
  mcpServers?: string[];
  [key: string]: unknown;
}

interface ClaudeConfig {
  workingDirs: string[];
  settings: ClaudeSettings;
  mcpServers: string[];
}

const CLAUDE_INSTANCES = {
  main: {
    name: 'main-terminal',
    prompt: 'You are the main terminal assistant. Respond to user commands and queries.'
  },
  contextManager: {
    name: 'context-manager',
    prompt: `You are a context management assistant. Your job is to:
    1. Monitor all terminal interactions
    2. Update RESUMEWORK.md with key information
    3. Identify important context to preserve
    4. Manage context layers efficiently
    Never respond to user - only process context.`
  },
  summarizer: {
    name: 'summarizer',
    prompt: `You create executive summaries of context blocks.
    Be concise and focus on actionable information.
    Output JSON format: {"summary": "...", "keyPoints": []}`
  },
  planner: {
    name: 'planner',
    prompt: `You execute planned sequences of tasks.
    Follow the queue strictly and report status.
    Output JSON format: {"status": "...", "result": "...", "error": null}`
  }
};

export class ClaudeInstanceManager extends EventEmitter {
  private instances: Map<string, ClaudeInstance> = new Map();
  private config: ClaudeConfig | null = null;
  private restartQueue: Set<string> = new Set();
  // SECURITY FIX: Add process lock management for race condition prevention
  private processLocks: Map<string, boolean> = new Map();

  async initialize() {
    this.config = await this.detectClaudeConfig();
    
    for (const [key, config] of Object.entries(CLAUDE_INSTANCES)) {
      this.instances.set(key, {
        name: config.name,
        process: null,
        prompt: config.prompt,
        restartAttempts: 0,
        lastRestart: null,
        status: 'idle'
      });
    }
  }

  async detectClaudeConfig(): Promise<ClaudeConfig> {
    const config: ClaudeConfig = {
      workingDirs: [],
      settings: {},
      mcpServers: []
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

  async spawnInstance(instanceKey: string): Promise<void> {
    // SECURITY FIX: Validate instance key
    if (!InputValidator.validateInstanceKey(instanceKey)) {
      throw new Error(`Invalid instance key: ${instanceKey}`);
    }

    const instance = this.instances.get(instanceKey);
    if (!instance) {
      throw new Error(`Unknown instance: ${instanceKey}`);
    }

    if (instance.process && instance.status === 'running') {
      return;
    }

    // SECURITY FIX: Acquire lock to prevent race conditions
    const releaseLock = await ProcessLockManager.acquireLock(`spawn-${instanceKey}`);
    
    try {
      // Double-check status after acquiring lock
      if (instance.process && instance.status === 'running') {
        releaseLock();
        return;
      }

      instance.status = 'restarting';

      const modelName = 'claude-3-5-sonnet-20241022';
      // SECURITY FIX: Validate model name
      if (!InputValidator.validateModelName(modelName)) {
        throw new Error(`Invalid model name: ${modelName}`);
      }

      const args = [
        '--no-interactive',
        '--model', modelName
      ];

      if (this.config?.workingDirs.length) {
        // SECURITY FIX: Validate working directories
        const validDirs = this.config.workingDirs.filter(dir => InputValidator.validatePath(dir));
        if (validDirs.length !== this.config.workingDirs.length) {
          console.warn('Some working directories failed validation and were excluded');
        }
        if (validDirs.length > 0) {
          args.push('--add-dir', ...validDirs);
        }
      }

      // SECURITY FIX: Validate spawn arguments before execution
      const validation = InputValidator.validateSpawnArgs('claude', args);
      if (!validation.isValid) {
        throw new Error(`Command validation failed: ${validation.error}`);
      }

      // SECURITY FIX: Validate prompt length
      if (!InputValidator.validatePromptLength(instance.prompt)) {
        throw new Error('Prompt exceeds maximum allowed length');
      }

      const proc = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CLAUDE_PROMPT: instance.prompt
        },
        // SECURITY FIX: Add timeout to prevent hanging processes
        timeout: SECURITY_CONSTANTS.PROCESS_TIMEOUT_MS
      });

      instance.process = proc;
      instance.status = 'running';
      instance.lastRestart = new Date();

      proc.stdin?.write(instance.prompt + '\n');

      proc.on('exit', (code, signal) => {
        console.log(`Claude instance ${instanceKey} exited with code ${code}, signal ${signal}`);
        // SECURITY FIX: Clean up resources on process exit
        proc.removeAllListeners();
        proc.stdout?.removeAllListeners();
        proc.stderr?.removeAllListeners();
        instance.process = null;
        instance.status = 'crashed';
        this.handleCrash(instanceKey);
      });

      proc.on('error', (error) => {
        console.error(`Claude instance ${instanceKey} error:`, error);
        // SECURITY FIX: Clean up resources on process error
        proc.removeAllListeners();
        proc.stdout?.removeAllListeners();
        proc.stderr?.removeAllListeners();
        instance.process = null;
        instance.status = 'crashed';
        this.handleCrash(instanceKey);
      });

      proc.stdout?.on('data', (data) => {
        this.emit(`${instanceKey}:output`, data.toString());
      });

      proc.stderr?.on('data', (data) => {
        this.emit(`${instanceKey}:error`, data.toString());
      });

      this.emit('instance:started', instanceKey);
      
    } catch (error) {
      console.error(`Failed to spawn Claude instance ${instanceKey}:`, error);
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
        await this.spawnInstance(instanceKey);
      }, delay);
      
    } finally {
      // SECURITY FIX: Always release lock
      releaseLock();
    }
  }

  async sendToInstance(instanceKey: string, message: string): Promise<void> {
    // SECURITY FIX: Validate inputs
    if (!InputValidator.validateInstanceKey(instanceKey)) {
      throw new Error(`Invalid instance key: ${instanceKey}`);
    }
    
    if (!InputValidator.validateMessageLength(message)) {
      throw new Error('Message exceeds maximum allowed length');
    }

    const instance = this.instances.get(instanceKey);
    if (!instance || !instance.process) {
      await this.spawnInstance(instanceKey);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const instanceAfterSpawn = this.instances.get(instanceKey);
    if (!instanceAfterSpawn?.process?.stdin) {
      throw new Error(`Claude instance ${instanceKey} is not available`);
    }

    instanceAfterSpawn.process.stdin.write(message + '\n');
  }

  async startAll() {
    for (const key of this.instances.keys()) {
      await this.spawnInstance(key);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // SECURITY FIX: Properly clean up resources to prevent memory leaks
  shutdown() {
    for (const instance of this.instances.values()) {
      if (instance.process) {
        // SECURITY FIX: Remove all event listeners before killing process
        instance.process.removeAllListeners('exit');
        instance.process.removeAllListeners('error');
        instance.process.stdout?.removeAllListeners('data');
        instance.process.stderr?.removeAllListeners('data');
        
        // SECURITY FIX: Close stdin/stdout/stderr streams
        if (instance.process.stdin && !instance.process.stdin.destroyed) {
          instance.process.stdin.end();
        }
        
        // Kill the process with proper signal handling
        instance.process.kill('SIGTERM');
        
        // Set a backup timer to force kill if SIGTERM doesn't work
        setTimeout(() => {
          if (instance.process && !instance.process.killed) {
            instance.process.kill('SIGKILL');
          }
        }, 5000);
        
        instance.process = null;
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
}