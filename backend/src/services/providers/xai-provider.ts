/**
 * xAI Grok LLM Provider (Custom Implementation)
 * Since xAI doesn't have official LangChain support yet, this uses direct API calls
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
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
 * xAI-specific configuration options
 */
export interface XAIProviderConfig extends LLMProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * xAI API request interface
 */
interface XAICompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

/**
 * xAI API response interface
 */
interface XAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Default configuration for xAI provider
 */
const DEFAULT_CONFIG = {
  timeout: 60000, // 60 seconds
  maxRetries: 3,
  model: 'grok-beta',
  baseUrl: 'https://api.x.ai/v1',
};

/**
 * Default options for PR description generation
 */
const DEFAULT_GENERATION_OPTIONS: Required<GenerateDescriptionOptions> = {
  model: 'grok-beta',
  maxTokens: 1000,
  temperature: 0.7,
  diffSizeLimit: 6000, // Conservative limit for Grok
  template: '',
};

/**
 * xAI Grok provider implementation
 */
export class XAIProvider extends BaseLLMProvider {
  private client: AxiosInstance;
  private readonly xaiConfig: XAIProviderConfig;

  constructor(config: XAIProviderConfig) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    super(LLMProviderType.XAI, mergedConfig);
    
    this.xaiConfig = mergedConfig as XAIProviderConfig;
    
    // Validate API key
    if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim() === '') {
      throw new LLMProviderError(
        LLMProviderType.XAI,
        LLMProviderErrorCode.INVALID_API_KEY,
        'xAI API key is required and cannot be empty',
      );
    }

    // Initialize HTTP client
    this.client = axios.create({
      baseURL: mergedConfig.baseUrl,
      timeout: mergedConfig.timeout,
      headers: {
        'Authorization': `Bearer ${config.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
    });

    // Add request/response interceptors for logging and error handling
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🌐 [xAI Provider] Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error(`❌ [xAI Provider] Request error:`, error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ [xAI Provider] Response: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        console.error(`❌ [xAI Provider] Response error:`, error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generate PR description using xAI Grok
   */
  async generatePRDescription(
    diffContent: string,
    options: GenerateDescriptionOptions = {},
  ): Promise<GeneratedDescription> {
    const opts = { ...DEFAULT_GENERATION_OPTIONS, ...options };

    console.log(`🤖 [xAI Provider] Starting PR description generation`);
    console.log(`🔧 [xAI Provider] Using model: ${opts.model}`);
    console.log(`📏 [xAI Provider] Original diff size: ${diffContent.length} characters`);

    // Truncate diff if necessary
    const { truncated: processedDiff, wasTruncated } = this.truncateDiff(
      diffContent,
      opts.diffSizeLimit,
    );

    if (wasTruncated) {
      console.log(`✂️  [xAI Provider] Diff truncated to ${processedDiff.length} characters`);
    }

    // Prepare the prompt
    const template = opts.template || this.getDefaultPromptTemplate();
    const prompt = this.processTemplate(template, processedDiff);

    const requestPayload: XAICompletionRequest = {
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
    };

    try {
      console.log(`🌐 [xAI Provider] Sending request to xAI...`);

      const response = await this.client.post<XAICompletionResponse>('/chat/completions', requestPayload);
      
      const generatedText = response.data.choices[0]?.message?.content;

      if (!generatedText) {
        throw new LLMProviderError(
          LLMProviderType.XAI,
          LLMProviderErrorCode.INVALID_REQUEST,
          'xAI API returned empty response',
        );
      }

      const tokensUsed = response.data.usage?.total_tokens || 0;

      console.log(`✅ [xAI Provider] Description generated successfully`);
      console.log(`📊 [xAI Provider] Tokens used: ${tokensUsed}`);
      console.log(`📝 [xAI Provider] Generated description length: ${generatedText.length} characters`);

      return {
        description: generatedText,
        model: opts.model,
        provider: LLMProviderType.XAI,
        tokensUsed,
        diffSizeTruncated: wasTruncated,
        originalDiffSize: diffContent.length,
        truncatedDiffSize: processedDiff.length,
        metadata: {
          xaiResponse: response.data,
        },
      };
    } catch (error: any) {
      console.error(`❌ [xAI Provider] Generation failed:`, error);
      throw this.transformError(error);
    }
  }

  /**
   * Test connection to xAI API
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log(`🔍 [xAI Provider] Testing connection...`);

      const testPayload: XAICompletionRequest = {
        model: 'grok-beta',
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 5,
      };

      await this.client.post<XAICompletionResponse>('/chat/completions', testPayload);

      console.log(`✅ [xAI Provider] Connection test successful`);
      return true;
    } catch (error: any) {
      console.error(`❌ [xAI Provider] Connection test failed:`, error);
      throw this.transformError(error);
    }
  }

  /**
   * Get xAI provider capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return {
      maxTokens: 131072, // Grok's context window
      supportedModels: [
        'grok-beta',
        'grok-vision-beta',
      ],
      supportsStreaming: true,
      costPerToken: {
        input: 0.000005, // Estimated, actual pricing may vary
        output: 0.000015, // Estimated, actual pricing may vary
      },
      rateLimit: {
        requestsPerMinute: 100, // Estimated
        tokensPerMinute: 10000, // Estimated
      },
    };
  }

  /**
   * Validate xAI configuration
   */
  async validateConfig(): Promise<boolean> {
    return this.testConnection();
  }

  /**
   * Get available xAI models
   */
  async getAvailableModels(): Promise<string[]> {
    // Return static list for now - could be enhanced to fetch from API
    return this.getCapabilities().supportedModels;
  }

  /**
   * Transform errors into LLMProviderError instances
   */
  private transformError(error: any): LLMProviderError {
    console.error('❌ [xAI Provider] Raw error:', error);

    // Handle Axios errors
    if (error.isAxiosError || error instanceof AxiosError) {
      const axiosError = error as AxiosError;
      const statusCode = axiosError.response?.status;
      const errorData = axiosError.response?.data as any;
      const errorMessage = errorData?.error?.message || axiosError.message || 'Unknown xAI error';

      switch (statusCode) {
        case 401:
          return new LLMProviderError(
            LLMProviderType.XAI,
            LLMProviderErrorCode.INVALID_API_KEY,
            'Invalid xAI API key. Please check your API key configuration.',
            statusCode,
            error,
          );

        case 429:
          return new LLMProviderError(
            LLMProviderType.XAI,
            LLMProviderErrorCode.RATE_LIMITED,
            'xAI rate limit exceeded. Please wait a moment before trying again.',
            statusCode,
            error,
          );

        case 402:
          return new LLMProviderError(
            LLMProviderType.XAI,
            LLMProviderErrorCode.QUOTA_EXCEEDED,
            'xAI quota exceeded. Please check your account usage and billing.',
            statusCode,
            error,
          );

        case 404:
          return new LLMProviderError(
            LLMProviderType.XAI,
            LLMProviderErrorCode.MODEL_NOT_FOUND,
            'The specified xAI model was not found or is not available.',
            statusCode,
            error,
          );

        case 400:
          return new LLMProviderError(
            LLMProviderType.XAI,
            LLMProviderErrorCode.INVALID_REQUEST,
            `Invalid request to xAI API: ${errorMessage}`,
            statusCode,
            error,
          );

        case 500:
        case 502:
        case 503:
        case 504:
          return new LLMProviderError(
            LLMProviderType.XAI,
            LLMProviderErrorCode.PROVIDER_UNAVAILABLE,
            'xAI API is currently unavailable. Please try again later.',
            statusCode,
            error,
          );

        default:
          return new LLMProviderError(
            LLMProviderType.XAI,
            LLMProviderErrorCode.UNKNOWN_ERROR,
            `xAI API error: ${errorMessage}`,
            statusCode,
            error,
          );
      }
    }

    // Handle network/timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return new LLMProviderError(
        LLMProviderType.XAI,
        LLMProviderErrorCode.TIMEOUT,
        'Request to xAI API timed out. Please try again.',
        undefined,
        error,
      );
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new LLMProviderError(
        LLMProviderType.XAI,
        LLMProviderErrorCode.NETWORK_ERROR,
        'Network error connecting to xAI API. Please check your internet connection.',
        undefined,
        error,
      );
    }

    // Default error
    return new LLMProviderError(
      LLMProviderType.XAI,
      LLMProviderErrorCode.UNKNOWN_ERROR,
      `Unexpected xAI error: ${error.message || 'Unknown error occurred'}`,
      undefined,
      error,
    );
  }
}

/**
 * Factory function to create an xAI provider
 */
export function createXAIProvider(config: XAIProviderConfig): XAIProvider {
  return new XAIProvider(config);
}
