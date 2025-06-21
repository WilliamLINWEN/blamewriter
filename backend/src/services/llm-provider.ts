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
 * Standard template placeholders:
 * - `{BRANCH_NAME}`: The name of the branch for the pull request.
 * - `{COMMIT_MESSAGES}`: A summary of commit messages in the pull request.
 * - `{DIFF_SUMMARY}`: A summary of the changes in the diff.
 * - `{PULL_REQUEST_TITLE}`: The title of the pull request.
 * - `{PULL_REQUEST_BODY}`: The body/description of the pull request.
 * - `{DIFF_CONTENT}`: The full diff content.
 */

/**
 * Options for generating PR descriptions
 */
export interface GenerateDescriptionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  diffSizeLimit?: number;
  template?: string;
  templateData?: Record<string, string>; // For PR-specific data like branch name, commit messages, etc.
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

// Added for streaming
export interface StreamChunk {
  type: 'metadata' | 'content' | 'complete' | 'error';
  data: any;
  timestamp?: string;
}

export abstract class BaseLLMProvider {
  protected config: LLMProviderConfig;
  protected providerType: LLMProviderType;

  constructor(providerType: LLMProviderType, config: LLMProviderConfig) {
    this.providerType = providerType;
    this.config = config;
  }

  /**
   * Generate a PR description using a template and provided data.
   * This method orchestrates template selection, validation, processing, and then calls a specific LLM provider.
   */
  public async generatePRDescription(
    options?: GenerateDescriptionOptions,
  ): Promise<GeneratedDescription> {
    const templateData = options?.templateData || {};
    let diffContent = templateData.DIFF_CONTENT || ''; // Get diff content from templateData

    // Truncate diff content if necessary
    let diffSizeTruncated = false;
    const originalDiffSize = diffContent.length;
    let truncatedDiffSize = originalDiffSize;

    if (options?.diffSizeLimit && diffContent.length > options.diffSizeLimit) {
      const truncatedResult = this.truncateDiff(diffContent, options.diffSizeLimit);
      diffContent = truncatedResult.truncated;
      diffSizeTruncated = truncatedResult.wasTruncated;
      truncatedDiffSize = diffContent.length;
    }

    // Update DIFF_CONTENT in templateData after potential truncation
    const finalTemplateData = { ...templateData, DIFF_CONTENT: diffContent };

    const template = options?.template || this.getDefaultPromptTemplate();

    const validationResult = this.validateTemplate(template);
    if (!validationResult.isValid) {
      throw new LLMProviderError(
        this.providerType,
        LLMProviderErrorCode.INVALID_REQUEST,
        `Invalid template: ${validationResult.errors.join(', ')}`,
      );
    }

    const processedPrompt = this.processTemplate(template, finalTemplateData);

    // Call the abstract method to be implemented by concrete providers
    const llmResponse = await this.executeLLMGeneration(processedPrompt, options);

    // Enrich the response with additional information
    return {
      ...llmResponse,
      diffSizeTruncated,
      originalDiffSize,
      truncatedDiffSize,
    };
  }

  /**
   * Abstract method for concrete LLM providers to implement the actual generation logic.
   * @param prompt The fully processed prompt string.
   * @param options Original options, which might contain model, maxTokens, etc.
   * @returns A partial GeneratedDescription, usually { description, model, provider, tokensUsed, metadata }
   */
  protected abstract executeLLMGeneration(
    prompt: string,
    options?: GenerateDescriptionOptions,
  ): Promise<
    Omit<GeneratedDescription, 'diffSizeTruncated' | 'originalDiffSize' | 'truncatedDiffSize'>
  >;

  /**
   * Stream-enabled PR description generation
   */
  async *generatePRDescriptionStream(
    diffContent: string, // Diff content is passed directly for streaming
    options: GenerateDescriptionOptions = {},
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const opts = { ...this.getDefaultGenerationOptions(), ...options }; // Assuming getDefaultGenerationOptions exists or will be added

    // Truncate diff if necessary
    const { truncated: processedDiff, wasTruncated } = this.truncateDiff(
      diffContent,
      opts.diffSizeLimit || 100000, // Default limit if not provided
    );

    if (wasTruncated) {
      yield {
        type: 'metadata',
        data: {
          diffTruncated: true,
          originalSize: diffContent.length,
          truncatedSize: processedDiff.length,
        },
      };
    }

    // Process template
    const template = opts.template || this.getDefaultPromptTemplate();

    // For streaming, templateData might be simpler or constructed differently.
    // Assuming DIFF_CONTENT is the primary dynamic part for the prompt in streaming.
    const finalTemplateData = { ...(opts.templateData || {}), DIFF_CONTENT: processedDiff };
    const prompt: string = this.processTemplate(template, finalTemplateData);

    yield {
      type: 'metadata',
      data: {
        promptGenerated: true,
        promptLength: prompt.length,
        model: opts.model || this.config.model || 'default', // Fallback model
      },
    };

    // Stream the actual LLM generation
    yield* this.executeStreamingLLMGeneration(prompt, options);
  }

  /**
   * Abstract method for streaming LLM generation
   * Each provider must implement this
   */
  protected abstract executeStreamingLLMGeneration(
    prompt: string,
    options?: GenerateDescriptionOptions,
  ): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * Gets default generation options.
   * Providers can override this to set their own defaults.
   */
  protected getDefaultGenerationOptions(): Partial<GenerateDescriptionOptions> {
    return {
      maxTokens: 2048, // Default max tokens
      temperature: 0.7, // Default temperature
      diffSizeLimit: 100000, // Default diff size limit
    };
  }

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
   * Truncate diff content to prevent token limit issues
   */
  // This method will likely be refactored or used differently now that diffContent comes from templateData
  // For now, let's assume the raw diffContent is available in options.templateData.DIFF_CONTENT if needed for truncation.
  protected truncateDiff(
    diffContent: string,
    limit: number,
  ): { truncated: string; wasTruncated: boolean } {
    if (diffContent.length <= limit) {
      return { truncated: diffContent, wasTruncated: false };
    }

    let truncated = diffContent.substring(0, limit);
    const lastNewlineIndex = truncated.lastIndexOf('\n');

    if (lastNewlineIndex > limit * 0.8) {
      truncated = truncated.substring(0, lastNewlineIndex);
    }
    truncated += '\n\n[... diff truncated due to size limit ...]';
    return { truncated, wasTruncated: true };
  }

  protected getDefaultPromptTemplate(): string {
    // Default template expects DIFF_CONTENT to be present in templateData
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

  protected processTemplate(template: string, templateVars?: Record<string, string>): string {
    let processedTemplate = template;
    if (templateVars) {
      for (const key in templateVars) {
        // Ensure the key exists in templateVars to avoid replacing with "undefined"
        if (
          Object.prototype.hasOwnProperty.call(templateVars, key) &&
          templateVars[key] !== undefined
        ) {
          processedTemplate = processedTemplate.replace(
            new RegExp(`{${key}}`, 'g'),
            templateVars[key],
          );
        }
      }
    }
    return processedTemplate;
  }

  /**
   * Validates and sanitizes a template string.
   */
  public validateTemplate(template: string): { isValid: boolean; errors: string[] } {
    const knownPlaceholders = [
      'BRANCH_NAME',
      'COMMIT_MESSAGES',
      'DIFF_SUMMARY',
      'PULL_REQUEST_TITLE',
      'PULL_REQUEST_BODY',
      'DIFF_CONTENT',
      'REPO_NAME',
      'AUTHOR',
      'FILES_CHANGED',
    ];
    const errors: string[] = [];
    let isValid = true;

    // Basic sanitization: check for script tags
    if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(template)) {
      errors.push('Template contains script tags, which are not allowed.');
      isValid = false;
    }

    // Placeholder syntax and known placeholder validation
    const allContentBetweenBracesRegex = /{([^{}]+)}/g; // Finds all content between {}
    let match;

    const openBracesCount = (template.match(/{/g) || []).length;
    const closeBracesCount = (template.match(/}/g) || []).length;

    if (openBracesCount !== closeBracesCount) {
      errors.push('Mismatched curly braces in template.');
      isValid = false;
      // No point in further placeholder validation if braces are mismatched
      return { isValid, errors };
    }

    // Check for improperly formatted placeholders (e.g. {WORD TOKEN} or {{NESTED}})
    // and if all correctly formatted placeholders are known.
    // We iterate through all content found between braces first.
    const foundPlaceholders = new Set<string>();
    while ((match = allContentBetweenBracesRegex.exec(template)) !== null) {
      const contentBetweenBraces = match[1]; // e.g., "WORD", "WORD TOKEN", "NESTED" from {{NESTED}}

      // Check if the content is a single valid word (as per our placeholder definition)
      if (typeof contentBetweenBraces === 'string' && /^\w+$/.test(contentBetweenBraces)) {
        foundPlaceholders.add(contentBetweenBraces); // Store it for the "known placeholders" check
      } else {
        // If it's not a single word, it's an invalid format.
        errors.push(
          `Invalid placeholder format: ${match[0]}. Placeholders should be e.g. {PLACEHOLDER_NAME} (no spaces, no nesting).`,
        );
        isValid = false;
      }
    }

    // Now check if all syntactically valid placeholders are known
    for (const placeholderName of foundPlaceholders) {
      if (!knownPlaceholders.includes(placeholderName)) {
        errors.push(`Unknown placeholder: {${placeholderName}}.`);
        isValid = false;
      }
    }

    return { isValid, errors };
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
