/**
 * OpenAI API service for generating PR descriptions
 */

import OpenAI from 'openai';

/**
 * Interface for OpenAI client configuration
 */
export interface OpenAIClientConfig {
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Interface for PR description generation options
 */
export interface GenerateDescriptionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  diffSizeLimit?: number;
}

/**
 * Interface for generated PR description response
 */
export interface GeneratedDescription {
  description: string;
  model: string;
  tokensUsed?: number;
  diffSizeTruncated: boolean;
  originalDiffSize: number;
  truncatedDiffSize: number;
}

/**
 * Error codes for OpenAI API operations
 */
export enum OpenAIErrorCode {
  INVALID_API_KEY = 'INVALID_API_KEY',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  RATE_LIMITED = 'RATE_LIMITED',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  CONTENT_FILTER = 'CONTENT_FILTER',
  TOKEN_LIMIT_EXCEEDED = 'TOKEN_LIMIT_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom error class for OpenAI API errors
 */
export class OpenAIServiceError extends Error {
  constructor(
    public code: OpenAIErrorCode,
    message: string,
    public statusCode?: number,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'OpenAIServiceError';
  }
}

/**
 * Default configuration for OpenAI client
 */
const DEFAULT_CONFIG: Required<Omit<OpenAIClientConfig, 'apiKey'>> = {
  timeout: 60000, // 60 seconds
  maxRetries: 3,
};

/**
 * Default options for PR description generation
 */
const DEFAULT_GENERATION_OPTIONS: Required<GenerateDescriptionOptions> = {
  model: 'gpt-3.5-turbo',
  maxTokens: 1000,
  temperature: 0.7,
  diffSizeLimit: 4000, // 4000 characters to prevent token limits
};

/**
 * Hardcoded Chinese prompt template for PR description generation
 */
const PR_DESCRIPTION_PROMPT_TEMPLATE = `請根據以下 diff 為這個 PR 撰寫描述。請用繁體中文回應，並包含以下內容：

1. **摘要**：簡述這個 PR 的主要目的和變更
2. **變更內容**：列出主要的程式碼變更
3. **影響範圍**：說明這些變更可能影響的功能或模組
4. **測試建議**：建議需要測試的項目

請保持描述簡潔明瞭，適合開發團隊快速理解。

以下是 diff 內容：

\`\`\`diff
{DIFF_CONTENT}
\`\`\``;

/**
 * OpenAI API client for generating PR descriptions
 */
export class OpenAIApiClient {
  private readonly client: OpenAI;
  private readonly config: Required<OpenAIClientConfig>;

  constructor(clientConfig: OpenAIClientConfig) {
    this.config = { ...DEFAULT_CONFIG, ...clientConfig };

    // Validate API key
    if (
      !clientConfig.apiKey ||
      typeof clientConfig.apiKey !== 'string' ||
      clientConfig.apiKey.trim() === ''
    ) {
      throw new OpenAIServiceError(
        OpenAIErrorCode.INVALID_API_KEY,
        'OpenAI API key is required and cannot be empty',
      );
    }

    // Create OpenAI client instance
    this.client = new OpenAI({
      apiKey: clientConfig.apiKey.trim(),
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * Truncates diff content to prevent token limit issues
   */
  private truncateDiff(diff: string, limit: number): { truncated: string; wasTruncated: boolean } {
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
   * Transforms OpenAI API errors into OpenAIServiceError instances
   */
  private transformOpenAIError(error: any): OpenAIServiceError {
    console.error('❌ [OpenAI API] Raw error:', error);

    // Handle OpenAI SDK errors
    if (error?.error?.type || error?.type) {
      const errorType = error.error?.type || error.type;
      const errorMessage = error.error?.message || error.message || 'Unknown OpenAI error';
      const statusCode = error.status || error.statusCode;

      switch (errorType) {
        case 'invalid_api_key':
        case 'authentication_error':
          return new OpenAIServiceError(
            OpenAIErrorCode.INVALID_API_KEY,
            'Invalid OpenAI API key. Please check your API key configuration.',
            statusCode,
            error,
          );

        case 'quota_exceeded':
        case 'insufficient_quota':
          return new OpenAIServiceError(
            OpenAIErrorCode.QUOTA_EXCEEDED,
            'OpenAI quota exceeded. Please check your account usage and billing.',
            statusCode,
            error,
          );

        case 'rate_limit_exceeded':
          return new OpenAIServiceError(
            OpenAIErrorCode.RATE_LIMITED,
            'OpenAI rate limit exceeded. Please wait a moment before trying again.',
            statusCode,
            error,
          );

        case 'model_not_found':
          return new OpenAIServiceError(
            OpenAIErrorCode.MODEL_NOT_FOUND,
            'The specified OpenAI model was not found or is not available.',
            statusCode,
            error,
          );

        case 'content_filter':
          return new OpenAIServiceError(
            OpenAIErrorCode.CONTENT_FILTER,
            'Content was filtered by OpenAI safety systems.',
            statusCode,
            error,
          );

        case 'context_length_exceeded':
        case 'token_limit_exceeded':
          return new OpenAIServiceError(
            OpenAIErrorCode.TOKEN_LIMIT_EXCEEDED,
            'The request exceeded the model token limit. Try reducing the diff size.',
            statusCode,
            error,
          );

        case 'invalid_request_error':
          return new OpenAIServiceError(
            OpenAIErrorCode.INVALID_REQUEST,
            `Invalid request to OpenAI API: ${errorMessage}`,
            statusCode,
            error,
          );

        default:
          return new OpenAIServiceError(
            OpenAIErrorCode.UNKNOWN_ERROR,
            `OpenAI API error: ${errorMessage}`,
            statusCode,
            error,
          );
      }
    }

    // Handle network/timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return new OpenAIServiceError(
        OpenAIErrorCode.TIMEOUT,
        'Request to OpenAI API timed out. Please try again.',
        undefined,
        error,
      );
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new OpenAIServiceError(
        OpenAIErrorCode.NETWORK_ERROR,
        'Network error connecting to OpenAI API. Please check your internet connection.',
        undefined,
        error,
      );
    }

    // Default error
    return new OpenAIServiceError(
      OpenAIErrorCode.UNKNOWN_ERROR,
      `Unexpected error: ${error.message || 'Unknown error occurred'}`,
      undefined,
      error,
    );
  }

  /**
   * Generates a PR description based on the provided diff content
   *
   * @param diffContent - The diff content from the pull request
   * @param options - Optional generation options
   * @returns Promise that resolves to the generated description
   * @throws OpenAIServiceError for API failures
   *
   * @example
   * ```typescript
   * const client = new OpenAIApiClient({ apiKey: 'your-api-key' });
   * const description = await client.generatePRDescription(diffContent);
   * console.log(description.description);
   * ```
   */
  async generatePRDescription(
    diffContent: string,
    options: GenerateDescriptionOptions = {},
  ): Promise<GeneratedDescription> {
    const opts = { ...DEFAULT_GENERATION_OPTIONS, ...options };

    console.log('🤖 [OpenAI API] Starting PR description generation');
    console.log(`🔧 [OpenAI API] Using model: ${opts.model}`);
    console.log(`📏 [OpenAI API] Original diff size: ${diffContent.length} characters`);

    // Truncate diff if necessary
    const { truncated: processedDiff, wasTruncated } = this.truncateDiff(
      diffContent,
      opts.diffSizeLimit,
    );

    if (wasTruncated) {
      console.log(`✂️  [OpenAI API] Diff truncated to ${processedDiff.length} characters`);
    }

    // Prepare the prompt with the diff content
    const prompt = PR_DESCRIPTION_PROMPT_TEMPLATE.replace('{DIFF_CONTENT}', processedDiff);

    try {
      console.log('🌐 [OpenAI API] Sending request to OpenAI...');

      const response = await this.client.chat.completions.create({
        model: opts.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        stream: false,
      });

      const generatedText = response.choices[0]?.message?.content;

      if (!generatedText) {
        throw new OpenAIServiceError(
          OpenAIErrorCode.INVALID_REQUEST,
          'OpenAI API returned empty response',
        );
      }

      const tokensUsed = response.usage?.total_tokens;

      console.log('✅ [OpenAI API] Description generated successfully');
      console.log(`📊 [OpenAI API] Tokens used: ${tokensUsed || 'unknown'}`);
      console.log(
        `📝 [OpenAI API] Generated description length: ${generatedText.length} characters`,
      );

      return {
        description: generatedText,
        model: opts.model,
        tokensUsed: tokensUsed || 0,
        diffSizeTruncated: wasTruncated,
        originalDiffSize: diffContent.length,
        truncatedDiffSize: processedDiff.length,
      };
    } catch (error) {
      console.error('❌ [OpenAI API] Generation failed:', error);
      throw this.transformOpenAIError(error);
    }
  }

  /**
   * Tests the connection to OpenAI API with the current configuration
   *
   * @returns Promise that resolves to true if connection is successful
   * @throws OpenAIServiceError for API failures
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔍 [OpenAI API] Testing connection...');

      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 5,
      });
      console.log('🔗 [OpenAI API] Connection test response:', response);
      console.log('✅ [OpenAI API] Connection test successful');
      return true;
    } catch (error) {
      console.error('❌ [OpenAI API] Connection test failed:', error);
      throw this.transformOpenAIError(error);
    }
  }
}

/**
 * Gets a user-friendly error message from an OpenAIServiceError
 *
 * @param error - The error to format
 * @returns User-friendly error message
 */
export function formatOpenAIServiceError(error: OpenAIServiceError): string {
  switch (error.code) {
    case OpenAIErrorCode.INVALID_API_KEY:
      return 'Invalid OpenAI API key. Please check your configuration.';

    case OpenAIErrorCode.QUOTA_EXCEEDED:
      return 'OpenAI quota exceeded. Please check your account usage and billing.';

    case OpenAIErrorCode.RATE_LIMITED:
      return 'Too many requests to OpenAI. Please wait a moment before trying again.';

    case OpenAIErrorCode.MODEL_NOT_FOUND:
      return 'The specified AI model is not available. Please try again later.';

    case OpenAIErrorCode.CONTENT_FILTER:
      return 'Content was filtered for safety reasons. Please try with different content.';

    case OpenAIErrorCode.TOKEN_LIMIT_EXCEEDED:
      return 'The diff content is too large for processing. Please try with a smaller PR.';

    case OpenAIErrorCode.NETWORK_ERROR:
      return 'Network error connecting to OpenAI. Please check your internet connection.';

    case OpenAIErrorCode.TIMEOUT:
      return 'OpenAI request timed out. Please try again.';

    case OpenAIErrorCode.INVALID_REQUEST:
      return 'Invalid request format. Please try again.';

    default:
      return error.message || 'An unexpected error occurred while generating the description.';
  }
}

/**
 * Factory function to create an OpenAI API client
 *
 * @param apiKey - OpenAI API key
 * @param config - Optional client configuration
 * @returns Configured OpenAIApiClient instance
 *
 * @example
 * ```typescript
 * const client = createOpenAIClient('your-api-key', {
 *   timeout: 30000,
 *   maxRetries: 5
 * });
 * ```
 */
export function createOpenAIClient(
  apiKey: string,
  config: Omit<OpenAIClientConfig, 'apiKey'> = {},
): OpenAIApiClient {
  return new OpenAIApiClient({ apiKey, ...config });
}
