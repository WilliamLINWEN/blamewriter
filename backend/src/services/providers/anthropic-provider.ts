/**
 * Anthropic Claude LLM Provider using LangChain
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage } from '@langchain/core/messages';
import {
  BaseLLMProvider,
  LLMProviderType,
  LLMProviderConfig,
  GenerateDescriptionOptions,
  GeneratedDescription,
  ProviderCapabilities,
  LLMProviderError,
  LLMProviderErrorCode,
} from '../llm-provider';

/**
 * Anthropic-specific configuration options
 */
export interface AnthropicProviderConfig extends LLMProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * Default configuration for Anthropic provider
 */
const DEFAULT_CONFIG = {
  timeout: 60000, // 60 seconds
  maxRetries: 3,
  model: 'claude-3-sonnet-20240229',
  baseUrl: 'https://api.anthropic.com',
};

/**
 * Default options for PR description generation
 */
const DEFAULT_GENERATION_OPTIONS: Required<GenerateDescriptionOptions> = {
  model: 'claude-3-sonnet-20240229',
  maxTokens: 1000,
  temperature: 0.7,
  diffSizeLimit: 8000, // Claude has larger context window
  template: '',
  templateData: {},
};

/**
 * Anthropic Claude provider implementation using LangChain
 */
export class AnthropicProvider extends BaseLLMProvider {
  private client: ChatAnthropic;
  private readonly anthropicConfig: AnthropicProviderConfig;

  constructor(config: AnthropicProviderConfig) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    super(LLMProviderType.ANTHROPIC, mergedConfig);
    
    this.anthropicConfig = mergedConfig as AnthropicProviderConfig;
    
    // Validate API key
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new LLMProviderError(
        LLMProviderType.ANTHROPIC,
        LLMProviderErrorCode.INVALID_API_KEY,
        'Anthropic API key is required and cannot be empty',
      );
    }

    // Initialize LangChain ChatAnthropic client
    this.client = new ChatAnthropic({
      anthropicApiKey: config.apiKey.trim(),
      model: mergedConfig.model || 'claude-3-sonnet-20240229',
      temperature: 0.7,
      maxRetries: mergedConfig.maxRetries || 3,
      ...(mergedConfig.baseUrl && { baseURL: mergedConfig.baseUrl }),
    });
  }

  /**
   * Implement the abstract executeLLMGeneration method
   */
  protected async executeLLMGeneration(
    prompt: string,
    options?: GenerateDescriptionOptions,
  ): Promise<Omit<GeneratedDescription, 'diffSizeTruncated' | 'originalDiffSize' | 'truncatedDiffSize'>> {
    const opts = { ...DEFAULT_GENERATION_OPTIONS, ...options };

    console.log(`🤖 [Anthropic Provider] Starting LLM generation`);
    console.log(`🔧 [Anthropic Provider] Using model: ${opts.model}`);

    // Update client with new model if different
    if (opts.model !== this.client.model) {
      this.client = new ChatAnthropic({
        apiKey: this.anthropicConfig.apiKey,
        model: opts.model,
        temperature: opts.temperature || 0.7,
        maxTokens: opts.maxTokens,
        maxRetries: this.anthropicConfig.maxRetries || 3,
        ...(this.anthropicConfig.baseUrl && { baseURL: this.anthropicConfig.baseUrl }),
      });
    }

    try {
      console.log(`📝 [Anthropic Provider] Generated prompt:\n${prompt}`);
      console.log(`🌐 [Anthropic Provider] Sending request to Anthropic...`);

      const response = await this.client.invoke([new HumanMessage(prompt)]);
      
      const generatedText = response.content as string;

      if (!generatedText) {
        throw new LLMProviderError(
          LLMProviderType.ANTHROPIC,
          LLMProviderErrorCode.INVALID_REQUEST,
          'Anthropic API returned empty response',
        );
      }

      // Extract token usage from response metadata if available
      const tokensUsed = response.response_metadata?.usage?.total_tokens || 0;

      console.log(`✅ [Anthropic Provider] Description generated successfully`);
      console.log(`📊 [Anthropic Provider] Tokens used: ${tokensUsed}`);
      console.log(`📝 [Anthropic Provider] Generated description length: ${generatedText.length} characters`);

      return {
        description: generatedText,
        model: opts.model,
        provider: LLMProviderType.ANTHROPIC,
        tokensUsed,
        metadata: {
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
          model: opts.model,
          promptLength: prompt.length,
        },
      };
    } catch (error) {
      console.error(`❌ [Anthropic Provider] Error generating description:`, error);
      throw this.transformError(error);
    }
  }

  /**
   * Legacy generatePRDescription method for backward compatibility
   * @deprecated Use the base class generatePRDescription method instead
   */
  async generatePRDescriptionLegacy(
    diffContent: string,
    options: GenerateDescriptionOptions = {},
  ): Promise<GeneratedDescription> {
    const opts = { ...DEFAULT_GENERATION_OPTIONS, ...options };

    console.log(`🤖 [Anthropic Provider] Starting PR description generation`);
    console.log(`🔧 [Anthropic Provider] Using model: ${opts.model}`);
    console.log(`📏 [Anthropic Provider] Original diff size: ${diffContent.length} characters`);

    // Update client with new model if different
    if (opts.model !== this.client.modelName) {
      this.client = new ChatAnthropic({
        anthropicApiKey: this.anthropicConfig.apiKey,
        model: opts.model,
        temperature: opts.temperature || 0.7,
        maxRetries: this.anthropicConfig.maxRetries || 3,
        ...(this.anthropicConfig.baseUrl && { baseURL: this.anthropicConfig.baseUrl }),
      });
    }

    // Truncate diff if necessary
    const { truncated: processedDiff, wasTruncated } = this.truncateDiff(
      diffContent,
      opts.diffSizeLimit,
    );

    if (wasTruncated) {
      console.log(`✂️  [Anthropic Provider] Diff truncated to ${processedDiff.length} characters`);
    }

    // Prepare the prompt using proper template processing
    const template = opts.template || this.getDefaultPromptTemplate();
    
    // Use templateData if provided, otherwise fall back to legacy diff-only processing
    let prompt: string;
    if (opts.templateData) {
      console.log(`📝 [Anthropic Provider] Using templateData for template processing`);
      // Update DIFF_CONTENT with the processed diff
      const finalTemplateData = { ...opts.templateData, DIFF_CONTENT: processedDiff };
      prompt = this.processTemplate(template, finalTemplateData);
    } else {
      console.log(`📝 [Anthropic Provider] Using legacy diff-only template processing`);
      // Legacy approach: replace {DIFF_CONTENT} placeholder with diff content
      prompt = template.replace(/{DIFF_CONTENT}/g, processedDiff);
    }

    try {
      console.log(`🌐 [Anthropic Provider] Sending request to Anthropic...`);

      const response = await this.client.invoke([new HumanMessage(prompt)]);
      
      const generatedText = response.content as string;

      if (!generatedText) {
        throw new LLMProviderError(
          LLMProviderType.ANTHROPIC,
          LLMProviderErrorCode.INVALID_REQUEST,
          'Anthropic API returned empty response',
        );
      }

      // Extract token usage from response metadata
      const tokensUsed = response.response_metadata?.usage?.total_tokens || 0;

      console.log(`✅ [Anthropic Provider] Description generated successfully`);
      console.log(`📊 [Anthropic Provider] Tokens used: ${tokensUsed}`);
      console.log(`📝 [Anthropic Provider] Generated description length: ${generatedText.length} characters`);

      return {
        description: generatedText,
        model: opts.model,
        provider: LLMProviderType.ANTHROPIC,
        tokensUsed,
        diffSizeTruncated: wasTruncated,
        originalDiffSize: diffContent.length,
        truncatedDiffSize: processedDiff.length,
        metadata: {
          responseMetadata: response.response_metadata,
        },
      };
    } catch (error: any) {
      console.error(`❌ [Anthropic Provider] Generation failed:`, error);
      throw this.transformError(error);
    }
  }

  /**
   * Test connection to Anthropic API
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log(`🔍 [Anthropic Provider] Testing connection...`);

      const testClient = new ChatAnthropic({
        anthropicApiKey: this.anthropicConfig.apiKey,
        model: 'claude-3-haiku-20240307', // Use cheaper model for testing
        maxTokens: 5,
      });

      await testClient.invoke([new HumanMessage('Test connection')]);

      console.log(`✅ [Anthropic Provider] Connection test successful`);
      return true;
    } catch (error: any) {
      console.error(`❌ [Anthropic Provider] Connection test failed:`, error);
      throw this.transformError(error);
    }
  }

  /**
   * Get Anthropic provider capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return {
      maxTokens: 200000, // Claude 3 has large context window
      supportedModels: [
        'claude-3-haiku-20240307',
        'claude-3-sonnet-20240229',
        'claude-3-opus-20240229',
        'claude-3-5-sonnet-20241022',
      ],
      supportsStreaming: true,
      costPerToken: {
        input: 0.00025 / 1000, // $0.25 per 1M tokens for Claude 3 Haiku input
        output: 0.00125 / 1000, // $1.25 per 1M tokens for Claude 3 Haiku output
      },
      rateLimit: {
        requestsPerMinute: 1000,
        tokensPerMinute: 40000,
      },
    };
  }

  /**
   * Validate Anthropic configuration
   */
  async validateConfig(): Promise<boolean> {
    return this.testConnection();
  }

  /**
   * Get available Anthropic models
   */
  async getAvailableModels(): Promise<string[]> {
    // Return static list for now - could be enhanced to fetch from API
    return this.getCapabilities().supportedModels;
  }

  /**
   * Transform errors into LLMProviderError instances
   */
  private transformError(error: any): LLMProviderError {
    console.error('❌ [Anthropic Provider] Raw error:', error);

    // Handle Anthropic specific errors
    if (error?.error?.type || error?.type) {
      const errorType = error.error?.type || error.type;
      const errorMessage = error.error?.message || error.message || 'Unknown Anthropic error';
      const statusCode = error.status || error.statusCode;

      switch (errorType) {
        case 'authentication_error':
        case 'invalid_request_error':
          if (errorMessage.includes('api_key')) {
            return new LLMProviderError(
              LLMProviderType.ANTHROPIC,
              LLMProviderErrorCode.INVALID_API_KEY,
              'Invalid Anthropic API key. Please check your API key configuration.',
              statusCode,
              error,
            );
          }
          return new LLMProviderError(
            LLMProviderType.ANTHROPIC,
            LLMProviderErrorCode.INVALID_REQUEST,
            `Invalid request to Anthropic API: ${errorMessage}`,
            statusCode,
            error,
          );

        case 'rate_limit_error':
          return new LLMProviderError(
            LLMProviderType.ANTHROPIC,
            LLMProviderErrorCode.RATE_LIMITED,
            'Anthropic rate limit exceeded. Please wait a moment before trying again.',
            statusCode,
            error,
          );

        case 'overloaded_error':
          return new LLMProviderError(
            LLMProviderType.ANTHROPIC,
            LLMProviderErrorCode.PROVIDER_UNAVAILABLE,
            'Anthropic API is currently overloaded. Please try again later.',
            statusCode,
            error,
          );

        default:
          return new LLMProviderError(
            LLMProviderType.ANTHROPIC,
            LLMProviderErrorCode.UNKNOWN_ERROR,
            `Anthropic API error: ${errorMessage}`,
            statusCode,
            error,
          );
      }
    }

    // Handle network/timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return new LLMProviderError(
        LLMProviderType.ANTHROPIC,
        LLMProviderErrorCode.TIMEOUT,
        'Request to Anthropic API timed out. Please try again.',
        undefined,
        error,
      );
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new LLMProviderError(
        LLMProviderType.ANTHROPIC,
        LLMProviderErrorCode.NETWORK_ERROR,
        'Network error connecting to Anthropic API. Please check your internet connection.',
        undefined,
        error,
      );
    }

    // Default error
    return new LLMProviderError(
      LLMProviderType.ANTHROPIC,
      LLMProviderErrorCode.UNKNOWN_ERROR,
      `Unexpected Anthropic error: ${error.message || 'Unknown error occurred'}`,
      undefined,
      error,
    );
  }
}

/**
 * Factory function to create an Anthropic provider
 */
export function createAnthropicProvider(config: AnthropicProviderConfig): AnthropicProvider {
  return new AnthropicProvider(config);
}
