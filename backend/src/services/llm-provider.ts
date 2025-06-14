/**
 * Abstract LLM Provider Interface for Multi-LLM Support
 * This module defines the common interface and types for all LLM providers
 */

/**
 * Supported LLM provider types
 */
export enum LLMProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  XAI = 'xai',
  OLLAMA = 'ollama',
}

/**
 * Configuration interface for LLM providers
 */
export interface LLMProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  model?: string;
}

/**
 * Options for generating PR descriptions
 */
export interface GenerateDescriptionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  diffSizeLimit?: number;
  template?: string;
}

/**
 * Response from PR description generation
 */
export interface GeneratedDescription {
  description: string;
  model: string;
  provider: LLMProviderType;
  tokensUsed?: number;
  diffSizeTruncated: boolean;
  originalDiffSize: number;
  truncatedDiffSize: number;
  metadata?: Record<string, any>;
}

/**
 * Provider capability information
 */
export interface ProviderCapabilities {
  maxTokens: number;
  supportedModels: string[];
  supportsStreaming: boolean;
  costPerToken?: {
    input: number;
    output: number;
  };
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

/**
 * Error codes for LLM provider operations
 */
export enum LLMProviderErrorCode {
  INVALID_API_KEY = 'INVALID_API_KEY',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  RATE_LIMITED = 'RATE_LIMITED',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  CONTENT_FILTER = 'CONTENT_FILTER',
  TOKEN_LIMIT_EXCEEDED = 'TOKEN_LIMIT_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_REQUEST = 'INVALID_REQUEST',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom error class for LLM provider errors
 */
export class LLMProviderError extends Error {
  constructor(
    public provider: LLMProviderType,
    public code: LLMProviderErrorCode,
    message: string,
    public statusCode?: number,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}

/**
 * Abstract base class for all LLM providers
 */
export abstract class BaseLLMProvider {
  protected config: LLMProviderConfig;
  protected providerType: LLMProviderType;

  constructor(providerType: LLMProviderType, config: LLMProviderConfig) {
    this.providerType = providerType;
    this.config = config;
  }

  /**
   * Generate a PR description based on diff content
   */
  abstract generatePRDescription(
    diffContent: string,
    options?: GenerateDescriptionOptions,
  ): Promise<GeneratedDescription>;

  /**
   * Test the connection to the LLM provider
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Get provider capabilities
   */
  abstract getCapabilities(): ProviderCapabilities;

  /**
   * Validate the provider configuration
   */
  abstract validateConfig(): Promise<boolean>;

  /**
   * Get available models for this provider
   */
  abstract getAvailableModels(): Promise<string[]>;

  /**
   * Get the provider type
   */
  getProviderType(): LLMProviderType {
    return this.providerType;
  }

  /**
   * Get the current configuration
   */
  getConfig(): LLMProviderConfig {
    return { ...this.config };
  }

  /**
   * Update provider configuration
   */
  updateConfig(newConfig: Partial<LLMProviderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Truncate diff content to prevent token limit issues
   */
  protected truncateDiff(diff: string, limit: number): { truncated: string; wasTruncated: boolean } {
    if (diff.length <= limit) {
      return { truncated: diff, wasTruncated: false };
    }

    // Truncate at the limit but try to end at a line break for better readability
    let truncated = diff.substring(0, limit);
    const lastNewlineIndex = truncated.lastIndexOf('\n');

    if (lastNewlineIndex > limit * 0.8) {
      // Only use newline if it's not too far back
      truncated = truncated.substring(0, lastNewlineIndex);
    }

    // Add truncation indicator
    truncated += '\n\n[... diff truncated due to size limit ...]';

    return { truncated, wasTruncated: true };
  }

  /**
   * Get default prompt template for PR description generation
   */
  protected getDefaultPromptTemplate(): string {
    return `Please generate a PR description based on the following diff. Please respond in Traditional Chinese and include the following sections:

1. **摘要**：簡述這個 PR 的主要目的和變更
2. **變更內容**：列出主要的程式碼變更
3. **影響範圍**：說明這些變更可能影響的功能或模組
4. **測試建議**：建議需要測試的項目

Please keep the description concise and clear, suitable for development teams to quickly understand.

Here is the diff content:

\`\`\`diff
{DIFF_CONTENT}
\`\`\``;
  }

  /**
   * Replace placeholders in template with actual values
   */
  protected processTemplate(template: string, diffContent: string): string {
    return template.replace('{DIFF_CONTENT}', diffContent);
  }
}

/**
 * Gets a user-friendly error message from an LLMProviderError
 */
export function formatLLMProviderError(error: LLMProviderError): string {
  const providerName = error.provider.toUpperCase();
  
  switch (error.code) {
    case LLMProviderErrorCode.INVALID_API_KEY:
      return `Invalid ${providerName} API key. Please check your configuration.`;

    case LLMProviderErrorCode.QUOTA_EXCEEDED:
      return `${providerName} quota exceeded. Please check your account usage and billing.`;

    case LLMProviderErrorCode.RATE_LIMITED:
      return `Too many requests to ${providerName}. Please wait a moment before trying again.`;

    case LLMProviderErrorCode.MODEL_NOT_FOUND:
      return `The specified ${providerName} model is not available. Please try again later.`;

    case LLMProviderErrorCode.CONTENT_FILTER:
      return `Content was filtered by ${providerName} safety systems. Please try with different content.`;

    case LLMProviderErrorCode.TOKEN_LIMIT_EXCEEDED:
      return `The diff content is too large for ${providerName} processing. Please try with a smaller PR.`;

    case LLMProviderErrorCode.NETWORK_ERROR:
      return `Network error connecting to ${providerName}. Please check your internet connection.`;

    case LLMProviderErrorCode.TIMEOUT:
      return `${providerName} request timed out. Please try again.`;

    case LLMProviderErrorCode.INVALID_REQUEST:
      return `Invalid request format for ${providerName}. Please try again.`;

    case LLMProviderErrorCode.PROVIDER_UNAVAILABLE:
      return `${providerName} is currently unavailable. Please try again later.`;

    default:
      return error.message || `An unexpected error occurred with ${providerName}.`;
  }
}
