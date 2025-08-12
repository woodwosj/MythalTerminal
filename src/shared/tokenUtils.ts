import { encode } from 'gpt-tokenizer';

/**
 * Token counting utilities for context management
 */

export interface TokenUsage {
  estimated: number;
  actual?: number;
  percentage: number;
  warningLevel: 'safe' | 'warning' | 'critical';
}

export interface TokenLimits {
  maxTokens: number;
  safeThreshold: number; // 70%
  warningThreshold: number; // 85%
  criticalThreshold: number; // 95%
}

export const DEFAULT_TOKEN_LIMITS: TokenLimits = {
  maxTokens: 200000, // Claude 3.5 Sonnet context window
  safeThreshold: 0.7,
  warningThreshold: 0.85,
  criticalThreshold: 0.95,
};

/**
 * Count tokens in text using GPT tokenizer (close approximation for Claude)
 */
export function countTokens(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  
  try {
    return encode(text).length;
  } catch (error) {
    console.warn('Token counting failed, using fallback estimation:', error);
    // Fallback: rough estimation (4 characters per token)
    return Math.ceil(text.length / 4);
  }
}

/**
 * Calculate token usage statistics
 */
export function calculateTokenUsage(
  currentTokens: number, 
  limits: TokenLimits = DEFAULT_TOKEN_LIMITS
): TokenUsage {
  const percentage = currentTokens / limits.maxTokens;
  
  let warningLevel: 'safe' | 'warning' | 'critical' = 'safe';
  if (percentage >= limits.criticalThreshold) {
    warningLevel = 'critical';
  } else if (percentage >= limits.warningThreshold) {
    warningLevel = 'warning';
  }
  
  return {
    estimated: currentTokens,
    percentage,
    warningLevel,
  };
}

/**
 * Get token usage color for UI display
 */
export function getTokenUsageColor(warningLevel: 'safe' | 'warning' | 'critical'): string {
  switch (warningLevel) {
    case 'safe': return 'text-green-400';
    case 'warning': return 'text-yellow-400';
    case 'critical': return 'text-red-400';
    default: return 'text-gray-400';
  }
}

/**
 * Get token usage background color for UI display
 */
export function getTokenUsageBackground(warningLevel: 'safe' | 'warning' | 'critical'): string {
  switch (warningLevel) {
    case 'safe': return 'bg-green-500';
    case 'warning': return 'bg-yellow-500';
    case 'critical': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

/**
 * Format token count for display (e.g., 1234 -> "1.2k")
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

/**
 * Calculate tokens that should be pruned to reach target percentage
 */
export function calculatePruningTarget(
  currentTokens: number,
  targetPercentage: number = 0.7,
  limits: TokenLimits = DEFAULT_TOKEN_LIMITS
): number {
  const targetTokens = limits.maxTokens * targetPercentage;
  return Math.max(0, currentTokens - targetTokens);
}

/**
 * Estimate tokens for a context layer including metadata overhead
 */
export function estimateContextLayerTokens(content: string, metadata: any = {}): number {
  const contentTokens = countTokens(content);
  const metadataTokens = countTokens(JSON.stringify(metadata));
  // Add small overhead for system prompts and formatting
  const overhead = Math.ceil(contentTokens * 0.02); // 2% overhead
  
  return contentTokens + metadataTokens + overhead;
}

/**
 * Batch count tokens for multiple text items
 */
export function batchCountTokens(texts: string[]): number[] {
  return texts.map(text => countTokens(text));
}

/**
 * Calculate conversation thread tokens (messages + system prompts)
 */
export function calculateConversationTokens(
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string
): number {
  let total = 0;
  
  // Count system prompt
  if (systemPrompt) {
    total += countTokens(systemPrompt);
  }
  
  // Count all messages with role overhead
  for (const message of messages) {
    total += countTokens(message.content);
    total += countTokens(message.role); // Role tokens
    total += 3; // Formatting overhead per message
  }
  
  return total;
}