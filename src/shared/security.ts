// SECURITY: Security constants and validation utilities
// This file contains all security-related constants and validation functions

export const SECURITY_CONSTANTS = {
  // Process management constants
  MAX_RESTART_ATTEMPTS: 3,
  MIN_RESTART_DELAY_MS: 1000,
  MAX_RESTART_DELAY_MS: 10000,
  RESTART_COOLDOWN_MS: 10000,
  PROCESS_TIMEOUT_MS: 300000,
  
  // Command validation
  ALLOWED_COMMANDS: ['claude'] as const,
  ALLOWED_ARGS: [
    '--no-interactive',
    '--model',
    '--add-dir'
  ] as const,
  
  // Claude model whitelist
  ALLOWED_MODELS: [
    'claude-3-5-sonnet-20241022',
    'claude-3-haiku-20240307',
    'claude-3-opus-20240229'
  ] as const,
  
  // Database field whitelist for dynamic queries
  ALLOWED_CONTEXT_LAYER_FIELDS: [
    'project_path',
    'layer_type', 
    'content',
    'tokens',
    'actual_tokens',
    'is_starred',
    'is_immutable',
    'source',
    'updated_at',
    'last_accessed',
    'access_count'
  ] as const,
  
  // Input validation patterns  
  PATH_VALIDATION_REGEX: /^(?!.*\.\.)(?!.*\0)[a-zA-Z0-9\/_\-\.\\:]+$/,
  MODEL_NAME_REGEX: /^claude-[0-9]+-[a-z]+-[0-9]{8}$/,
  INSTANCE_KEY_REGEX: /^[a-zA-Z][a-zA-Z0-9_]*$/,
  
  // Size limits
  MAX_PROMPT_LENGTH: 50000,
  MAX_MESSAGE_LENGTH: 100000,
  MAX_PATH_LENGTH: 1000,
  MAX_FIELD_NAME_LENGTH: 50
} as const;

export type AllowedCommand = typeof SECURITY_CONSTANTS.ALLOWED_COMMANDS[number];
export type AllowedModel = typeof SECURITY_CONSTANTS.ALLOWED_MODELS[number];
export type AllowedField = typeof SECURITY_CONSTANTS.ALLOWED_CONTEXT_LAYER_FIELDS[number];

// SECURITY FIX: Input sanitization functions
export class InputValidator {
  /**
   * Validates and sanitizes command arguments for spawn operations
   * Prevents command injection by only allowing whitelisted commands and arguments
   */
  static validateSpawnArgs(command: string, args: string[]): { isValid: boolean; error?: string } {
    // Validate command
    if (!SECURITY_CONSTANTS.ALLOWED_COMMANDS.includes(command as AllowedCommand)) {
      return { isValid: false, error: `Command not allowed: ${command}` };
    }
    
    // Validate each argument
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.length > SECURITY_CONSTANTS.MAX_PATH_LENGTH) {
        return { isValid: false, error: `Argument too long: ${arg.substring(0, 50)}...` };
      }
      
      // Special validation for known argument patterns
      if (arg === '--model' && i + 1 < args.length) {
        const modelName = args[i + 1];
        if (!this.validateModelName(modelName)) {
          return { isValid: false, error: `Invalid model name: ${modelName}` };
        }
        i++; // Skip the model name in next iteration
        continue;
      }
      
      // Check if this is a known safe argument
      if (SECURITY_CONSTANTS.ALLOWED_ARGS.includes(arg as any)) {
        continue;
      }
      
      // For paths (like after --add-dir), validate path format
      if (i > 0 && args[i-1] === '--add-dir') {
        if (!this.validatePath(arg)) {
          return { isValid: false, error: `Invalid path: ${arg}` };
        }
        continue;
      }
      
      // Check for dangerous patterns
      if (this.containsDangerousPatterns(arg)) {
        return { isValid: false, error: `Dangerous pattern detected in argument: ${arg}` };
      }
    }
    
    return { isValid: true };
  }
  
  /**
   * Validates model names against whitelist
   */
  static validateModelName(model: string): boolean {
    // First check the whitelist
    if (SECURITY_CONSTANTS.ALLOWED_MODELS.includes(model as AllowedModel)) {
      return true;
    }
    
    // Check dangerous patterns first
    if (this.containsDangerousPatterns(model)) {
      return false;
    }
    
    // Check if it matches valid Claude model format (but be restrictive about version numbers)
    if (SECURITY_CONSTANTS.MODEL_NAME_REGEX.test(model)) {
      // Only allow version numbers up to 10 for security
      const versionMatch = model.match(/^claude-([0-9]+)-/);
      if (versionMatch && parseInt(versionMatch[1]) <= 10) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Validates database field names for dynamic queries
   */
  static validateFieldName(fieldName: string): boolean {
    return SECURITY_CONSTANTS.ALLOWED_CONTEXT_LAYER_FIELDS.includes(fieldName as AllowedField) &&
           fieldName.length <= SECURITY_CONSTANTS.MAX_FIELD_NAME_LENGTH;
  }
  
  /**
   * Validates file paths
   */
  static validatePath(path: string): boolean {
    // Handle null/undefined paths
    if (!path || typeof path !== 'string') {
      return false;
    }
    
    if (path.length > SECURITY_CONSTANTS.MAX_PATH_LENGTH) {
      return false;
    }
    
    // Check for dangerous patterns first
    if (this.containsDangerousPatterns(path)) {
      return false;
    }
    
    return SECURITY_CONSTANTS.PATH_VALIDATION_REGEX.test(path);
  }
  
  /**
   * Validates instance keys
   */
  static validateInstanceKey(key: string): boolean {
    return SECURITY_CONSTANTS.INSTANCE_KEY_REGEX.test(key) && key.length <= 50;
  }
  
  /**
   * Validates message content length
   */
  static validateMessageLength(message: string): boolean {
    return message.length <= SECURITY_CONSTANTS.MAX_MESSAGE_LENGTH;
  }
  
  /**
   * Validates prompt length
   */
  static validatePromptLength(prompt: string): boolean {
    return prompt.length <= SECURITY_CONSTANTS.MAX_PROMPT_LENGTH;
  }
  
  /**
   * Checks for dangerous command injection patterns
   */
  private static containsDangerousPatterns(input: string): boolean {
    const dangerousPatterns = [
      /[;&|`$(){}[\]]/,  // Shell metacharacters
      /\.\./,            // Directory traversal (simplified)
      /[<>]/,            // Redirection operators
      /^\s*-/,           // Leading dash (potential flag confusion)
      /\0/,              // Null bytes
      /[\r\n]/,          // Line breaks
      /\s/               // Spaces (for path validation)
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(input));
  }
}

// SECURITY FIX: Process lock management for race condition prevention
export class ProcessLockManager {
  private static locks: Map<string, boolean> = new Map();
  private static lockPromises: Map<string, Promise<void>> = new Map();
  
  /**
   * Acquires a lock for the given key, preventing concurrent operations
   */
  static async acquireLock(key: string): Promise<() => void> {
    // Wait for existing lock to be released
    while (this.locks.get(key)) {
      const existingPromise = this.lockPromises.get(key);
      if (existingPromise) {
        await existingPromise;
      }
      // Small delay to prevent tight polling
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Acquire the lock
    this.locks.set(key, true);
    
    let resolvePromise: () => void;
    const lockPromise = new Promise<void>(resolve => {
      resolvePromise = resolve;
    });
    this.lockPromises.set(key, lockPromise);
    
    // Return release function
    return () => {
      this.locks.set(key, false);
      this.lockPromises.delete(key);
      resolvePromise();
    };
  }
  
  /**
   * Checks if a lock is currently held
   */
  static isLocked(key: string): boolean {
    return this.locks.get(key) === true;
  }
  
  /**
   * Forces release of all locks (for cleanup)
   */
  static releaseAllLocks(): void {
    this.locks.clear();
    this.lockPromises.clear();
  }
}