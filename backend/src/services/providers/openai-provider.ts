/**
 * OpenAI LLM Provider using LangChain
 */

import { ChatOpenAI } from '@langchain/openai';
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
 * OpenAI-specific configuration options
 */
export interface OpenAIProviderConfig extends LLMProviderConfig {
  apiKey: string;
  organizationId?: string;
}

/**
 * Default configuration for OpenAI provider
 */
const DEFAULT_CONFIG = {
  timeout: 60000, // 60 seconds
  maxRetries: 3,
  model: 'gpt-3.5-turbo',
};

/**
 * Default options for PR description generation
 */
const DEFAULT_GENERATION_OPTIONS: Required<GenerateDescriptionOptions> = {
  model: 'gpt-3.5-turbo',
  maxTokens: 1000,
  temperature: 0.7,
  diffSizeLimit: 4000,
  template: '',
  templateData: {},
};

/**
 * OpenAI provider implementation using LangChain
 */
export class OpenAIProvider extends BaseLLMProvider {
  private client: ChatOpenAI;
  private readonly openaiConfig: OpenAIProviderConfig;

  constructor(config: OpenAIProviderConfig) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    super(LLMProviderType.OPENAI, mergedConfig);

    this.openaiConfig = mergedConfig as OpenAIProviderConfig;

    // Validate API key
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new LLMProviderError(
        LLMProviderType.OPENAI,
        LLMProviderErrorCode.INVALID_API_KEY,
        'OpenAI API key is required and cannot be empty',
      );
    }

    // Initialize LangChain ChatOpenAI client
    this.client = new ChatOpenAI({
      openAIApiKey: config.apiKey.trim(),
      model: mergedConfig.model || 'gpt-3.5-turbo',
      temperature: 0.7,
      maxRetries: mergedConfig.maxRetries || 3,
      ...(mergedConfig.timeout && { timeout: mergedConfig.timeout }),
      ...(config.organizationId && { organization: config.organizationId }),
    });
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

    console.log('🤖 [OpenAI Provider] Starting PR description generation');
    console.log(`🔧 [OpenAI Provider] Using model: ${opts.model}`);
    console.log(`📏 [OpenAI Provider] Original diff size: ${diffContent.length} characters`);

    // Update client with new model if different
    if (opts.model !== this.client.model) {
      this.client = new ChatOpenAI({
        openAIApiKey: this.openaiConfig.apiKey,
        model: opts.model,
        temperature: opts.temperature || 0.7,
        maxRetries: this.openaiConfig.maxRetries || 3,
        ...(this.openaiConfig.timeout && { timeout: this.openaiConfig.timeout }),
        ...(this.openaiConfig.organizationId && { organization: this.openaiConfig.organizationId }),
      });
    }

    // Truncate diff if necessary
    const { truncated: processedDiff, wasTruncated } = this.truncateDiff(
      diffContent,
      opts.diffSizeLimit,
    );

    if (wasTruncated) {
      console.log(`✂️  [OpenAI Provider] Diff truncated to ${processedDiff.length} characters`);
    }

    // Prepare the prompt using proper template processing
    const template = opts.template || this.getDefaultPromptTemplate();

    // Use templateData if provided, otherwise fall back to legacy diff-only processing
    let prompt: string;
    if (opts.templateData) {
      console.log('📝 [OpenAI Provider] Using templateData for template processing');
      // Update DIFF_CONTENT with the processed diff
      const finalTemplateData = { ...opts.templateData, DIFF_CONTENT: processedDiff };
      prompt = this.processTemplate(template, finalTemplateData);
    } else {
      console.log('📝 [OpenAI Provider] Using legacy diff-only template processing');
      // Legacy approach: replace {DIFF_CONTENT} placeholder with diff content
      prompt = template.replace(/{DIFF_CONTENT}/g, processedDiff);
    }

    try {
      // Log the prompt for debugging
      console.log(`📝 [OpenAI Provider] Generated prompt:\n${prompt}`);
      console.log('🌐 [OpenAI Provider] Sending request to OpenAI...');

      const response = await this.client.invoke([new HumanMessage(prompt)]);

      const generatedText = response.content as string;

      if (!generatedText) {
        throw new LLMProviderError(
          LLMProviderType.OPENAI,
          LLMProviderErrorCode.INVALID_REQUEST,
          'OpenAI API returned empty response',
        );
      }

      // Extract token usage from response metadata
      const tokensUsed = response.response_metadata?.tokenUsage?.totalTokens || 0;

      console.log('✅ [OpenAI Provider] Description generated successfully');
      console.log(`📊 [OpenAI Provider] Tokens used: ${tokensUsed}`);
      console.log(
        `📝 [OpenAI Provider] Generated description length: ${generatedText.length} characters`,
      );

      return {
        description: generatedText,
        model: opts.model,
        provider: LLMProviderType.OPENAI,
        tokensUsed,
        diffSizeTruncated: wasTruncated,
        originalDiffSize: diffContent.length,
        truncatedDiffSize: processedDiff.length,
        metadata: {
          responseMetadata: response.response_metadata,
        },
      };
    } catch (error: any) {
      console.error('❌ [OpenAI Provider] Generation failed:', error);
      throw this.transformError(error);
    }
  }

  /**
   * Implement the abstract executeLLMGeneration method
   */
  protected async executeLLMGeneration(
    prompt: string,
    options?: GenerateDescriptionOptions,
  ): Promise<
    Omit<GeneratedDescription, 'diffSizeTruncated' | 'originalDiffSize' | 'truncatedDiffSize'>
  > {
    const opts = { ...DEFAULT_GENERATION_OPTIONS, ...options };

    console.log('🤖 [OpenAI Provider] Starting LLM generation');
    console.log(`🔧 [OpenAI Provider] Using model: ${opts.model}`);

    // Update client with new model if different
    if (opts.model !== this.client.model) {
      this.client = new ChatOpenAI({
        openAIApiKey: this.openaiConfig.apiKey,
        model: opts.model,
        temperature: opts.temperature || 0.7,
        maxRetries: this.openaiConfig.maxRetries || 3,
        ...(this.openaiConfig.timeout && { timeout: this.openaiConfig.timeout }),
        ...(this.openaiConfig.organizationId && { organization: this.openaiConfig.organizationId }),
      });
    }

    try {
      // Log the prompt for debugging
      console.log(`📝 [OpenAI Provider] Generated prompt:\n${prompt}`);
      console.log('🌐 [OpenAI Provider] Sending request to OpenAI...');

      const response = await this.client.invoke([new HumanMessage(prompt)]);

      const generatedText = response.content as string;

      if (!generatedText) {
        throw new LLMProviderError(
          LLMProviderType.OPENAI,
          LLMProviderErrorCode.INVALID_REQUEST,
          'OpenAI API returned empty response',
        );
      }

      // Extract token usage from response metadata
      const tokensUsed = response.response_metadata?.tokenUsage?.totalTokens || 0;

      console.log('✅ [OpenAI Provider] Description generated successfully');
      console.log(`📊 [OpenAI Provider] Tokens used: ${tokensUsed}`);
      console.log(
        `📝 [OpenAI Provider] Generated description length: ${generatedText.length} characters`,
      );

      return {
        description: generatedText,
        model: opts.model,
        provider: LLMProviderType.OPENAI,
        tokensUsed,
        metadata: {
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
          model: opts.model,
          promptLength: prompt.length,
        },
      };
    } catch (error) {
      console.error('❌ [OpenAI Provider] Error generating description:', error);
      throw this.transformError(error);
    }
  }

  /**
   * Test connection to OpenAI API
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔍 [OpenAI Provider] Testing connection...');

      const testClient = new ChatOpenAI({
        openAIApiKey: this.openaiConfig.apiKey,
        model: 'gpt-3.5-turbo',
        maxTokens: 5,
      });

      await testClient.invoke([new HumanMessage('Test connection')]);

      console.log('✅ [OpenAI Provider] Connection test successful');
      return true;
    } catch (error: any) {
      console.error('❌ [OpenAI Provider] Connection test failed:', error);
      throw this.transformError(error);
    }
  }

  /**
   * Get OpenAI provider capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return {
      maxTokens: 4096, // Default for gpt-3.5-turbo
      supportedModels: [
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
        'gpt-4',
        'gpt-4-turbo-preview',
        'gpt-4o',
        'gpt-4o-mini',
      ],
      supportsStreaming: true,
      costPerToken: {
        input: 0.0015 / 1000, // $0.0015 per 1K tokens for gpt-3.5-turbo input
        output: 0.002 / 1000, // $0.002 per 1K tokens for gpt-3.5-turbo output
      },
      rateLimit: {
        requestsPerMinute: 3500,
        tokensPerMinute: 90000,
      },
    };
  }

  /**
   * Validate OpenAI configuration
   */
  async validateConfig(): Promise<boolean> {
    return this.testConnection();
  }

  /**
   * Get available OpenAI models
   */
  async getAvailableModels(): Promise<string[]> {
    // Return static list for now - could be enhanced to fetch from API
    return this.getCapabilities().supportedModels;
  }

  /**
   * Transform errors into LLMProviderError instances
   */
  private transformError(error: any): LLMProviderError {
    console.error('❌ [OpenAI Provider] Raw error:', error);

    // Handle LangChain/OpenAI specific errors
    if (error?.error?.type || error?.type) {
      const errorType = error.error?.type || error.type;
      const errorMessage = error.error?.message || error.message || 'Unknown OpenAI error';
      const statusCode = error.status || error.statusCode;

      switch (errorType) {
        case 'invalid_api_key':
        case 'authentication_error':
          return new LLMProviderError(
            LLMProviderType.OPENAI,
            LLMProviderErrorCode.INVALID_API_KEY,
            'Invalid OpenAI API key. Please check your API key configuration.',
            statusCode,
            error,
          );

        case 'quota_exceeded':
        case 'insufficient_quota':
          return new LLMProviderError(
            LLMProviderType.OPENAI,
            LLMProviderErrorCode.QUOTA_EXCEEDED,
            'OpenAI quota exceeded. Please check your account usage and billing.',
            statusCode,
            error,
          );

        case 'rate_limit_exceeded':
          return new LLMProviderError(
            LLMProviderType.OPENAI,
            LLMProviderErrorCode.RATE_LIMITED,
            'OpenAI rate limit exceeded. Please wait a moment before trying again.',
            statusCode,
            error,
          );

        case 'model_not_found':
          return new LLMProviderError(
            LLMProviderType.OPENAI,
            LLMProviderErrorCode.MODEL_NOT_FOUND,
            'The specified OpenAI model was not found or is not available.',
            statusCode,
            error,
          );

        case 'content_filter':
          return new LLMProviderError(
            LLMProviderType.OPENAI,
            LLMProviderErrorCode.CONTENT_FILTER,
            'Content was filtered by OpenAI safety systems.',
            statusCode,
            error,
          );

        case 'context_length_exceeded':
        case 'token_limit_exceeded':
          return new LLMProviderError(
            LLMProviderType.OPENAI,
            LLMProviderErrorCode.TOKEN_LIMIT_EXCEEDED,
            'The request exceeded the model token limit. Try reducing the diff size.',
            statusCode,
            error,
          );

        case 'invalid_request_error':
          return new LLMProviderError(
            LLMProviderType.OPENAI,
            LLMProviderErrorCode.INVALID_REQUEST,
            `Invalid request to OpenAI API: ${errorMessage}`,
            statusCode,
            error,
          );

        default:
          return new LLMProviderError(
            LLMProviderType.OPENAI,
            LLMProviderErrorCode.UNKNOWN_ERROR,
            `OpenAI API error: ${errorMessage}`,
            statusCode,
            error,
          );
      }
    }

    // Handle network/timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return new LLMProviderError(
        LLMProviderType.OPENAI,
        LLMProviderErrorCode.TIMEOUT,
        'Request to OpenAI API timed out. Please try again.',
        undefined,
        error,
      );
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new LLMProviderError(
        LLMProviderType.OPENAI,
        LLMProviderErrorCode.NETWORK_ERROR,
        'Network error connecting to OpenAI API. Please check your internet connection.',
        undefined,
        error,
      );
    }

    // Default error
    return new LLMProviderError(
      LLMProviderType.OPENAI,
      LLMProviderErrorCode.UNKNOWN_ERROR,
      `Unexpected OpenAI error: ${error.message || 'Unknown error occurred'}`,
      undefined,
      error,
    );
  }
}

/**
 * Factory function to create an OpenAI provider
 */
export function createOpenAIProvider(config: OpenAIProviderConfig): OpenAIProvider {
  return new OpenAIProvider(config);
}
