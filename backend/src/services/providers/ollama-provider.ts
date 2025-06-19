/**
 * Ollama LLM Provider using LangChain
 */

import { Ollama } from '@langchain/ollama';
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
 * Ollama-specific configuration options
 */
export interface OllamaProviderConfig extends LLMProviderConfig {
  baseUrl: string; // Ollama endpoint URL (required)
  model: string;   // Model name (required)
}

/**
 * Default configuration for Ollama provider
 */
const DEFAULT_CONFIG = {
  timeout: 120000, // 2 minutes (local inference can be slower)
  maxRetries: 2,   // Fewer retries for local
  baseUrl: 'http://localhost:11434',
  model: 'llama2',
};

/**
 * Default options for PR description generation
 */
const DEFAULT_GENERATION_OPTIONS: Required<GenerateDescriptionOptions> = {
  model: 'llama2',
  maxTokens: 1000,
  temperature: 0.7,
  diffSizeLimit: 3000, // Conservative for local models
  template: '',
  templateData: {},
};

/**
 * Ollama provider implementation using LangChain
 */
export class OllamaProvider extends BaseLLMProvider {
  private client: Ollama;
  private readonly ollamaConfig: OllamaProviderConfig;

  constructor(config: OllamaProviderConfig) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    super(LLMProviderType.OLLAMA, mergedConfig);
    
    this.ollamaConfig = mergedConfig as OllamaProviderConfig;
    
    // Validate required config
    if (!config.baseUrl || config.baseUrl.trim() === '') {
      throw new LLMProviderError(
        LLMProviderType.OLLAMA,
        LLMProviderErrorCode.INVALID_REQUEST,
        'Ollama base URL is required and cannot be empty',
      );
    }

    if (!config.model || config.model.trim() === '') {
      throw new LLMProviderError(
        LLMProviderType.OLLAMA,
        LLMProviderErrorCode.INVALID_REQUEST,
        'Ollama model name is required and cannot be empty',
      );
    }

    // Initialize LangChain Ollama client
    this.client = new Ollama({
      baseUrl: config.baseUrl.trim(),
      model: config.model.trim(),
      temperature: 0.7,
      ...(mergedConfig.timeout && { 
        requestOptions: { 
          timeout: mergedConfig.timeout 
        } 
      }),
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

    console.log(`🤖 [Ollama Provider] Starting LLM generation`);
    console.log(`🔧 [Ollama Provider] Using model: ${opts.model}`);

    // Update client with new model if different
    if (opts.model !== this.client.model) {
      this.client = new Ollama({
        baseUrl: this.ollamaConfig.baseUrl || 'http://localhost:11434',
        model: opts.model,
        temperature: opts.temperature || 0.7,
        numCtx: opts.maxTokens || 1000,
      });
    }

    try {
      console.log(`📝 [Ollama Provider] Generated prompt:\n${prompt}`);
      console.log(`🌐 [Ollama Provider] Sending request to Ollama...`);

      const response = await this.client.invoke(prompt);
      
      const generatedText = response;

      if (!generatedText) {
        throw new LLMProviderError(
          LLMProviderType.OLLAMA,
          LLMProviderErrorCode.INVALID_REQUEST,
          'Ollama returned empty response',
        );
      }

      console.log(`✅ [Ollama Provider] Description generated successfully`);
      console.log(`📝 [Ollama Provider] Generated description length: ${generatedText.length} characters`);

      return {
        description: generatedText,
        model: opts.model,
        provider: LLMProviderType.OLLAMA,
        tokensUsed: generatedText.length, // Approximate token count
        metadata: {
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
          model: opts.model,
          promptLength: prompt.length,
        },
      };
    } catch (error) {
      console.error(`❌ [Ollama Provider] Error generating description:`, error);
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

    console.log(`🤖 [Ollama Provider] Starting PR description generation`);
    console.log(`🔧 [Ollama Provider] Using model: ${opts.model}`);
    console.log(`🌐 [Ollama Provider] Endpoint: ${this.ollamaConfig.baseUrl}`);
    console.log(`📏 [Ollama Provider] Original diff size: ${diffContent.length} characters`);

    // Update client with new model if different
    if (opts.model !== this.client.model) {
      this.client = new Ollama({
        baseUrl: this.ollamaConfig.baseUrl,
        model: opts.model,
        temperature: opts.temperature || 0.7,
        ...(this.ollamaConfig.timeout && { 
          requestOptions: { 
            timeout: this.ollamaConfig.timeout 
          } 
        }),
      });
    }

    // Truncate diff if necessary
    const { truncated: processedDiff, wasTruncated } = this.truncateDiff(
      diffContent,
      opts.diffSizeLimit,
    );

    if (wasTruncated) {
      console.log(`✂️  [Ollama Provider] Diff truncated to ${processedDiff.length} characters`);
    }

    // Prepare the prompt using proper template processing
    const template = opts.template || this.getDefaultPromptTemplate();
    
    // Use templateData if provided, otherwise fall back to legacy diff-only processing
    let prompt: string;
    if (opts.templateData) {
      console.log(`📝 [Ollama Provider] Using templateData for template processing`);
      // Update DIFF_CONTENT with the processed diff
      const finalTemplateData = { ...opts.templateData, DIFF_CONTENT: processedDiff };
      prompt = this.processTemplate(template, finalTemplateData);
    } else {
      console.log(`📝 [Ollama Provider] Using legacy diff-only template processing`);
      // Legacy approach: replace {DIFF_CONTENT} placeholder with diff content
      prompt = template.replace(/{DIFF_CONTENT}/g, processedDiff);
    }

    try {
      console.log(`🌐 [Ollama Provider] Sending request to Ollama...`);

      const response = await this.client.invoke(prompt);
      
      const generatedText = response as string;

      if (!generatedText) {
        throw new LLMProviderError(
          LLMProviderType.OLLAMA,
          LLMProviderErrorCode.INVALID_REQUEST,
          'Ollama returned empty response',
        );
      }

      // Ollama doesn't provide token usage info through LangChain
      const estimatedTokens = Math.ceil((prompt.length + generatedText.length) / 4);

      console.log(`✅ [Ollama Provider] Description generated successfully`);
      console.log(`📊 [Ollama Provider] Estimated tokens: ${estimatedTokens}`);
      console.log(`📝 [Ollama Provider] Generated description length: ${generatedText.length} characters`);

      return {
        description: generatedText,
        model: opts.model,
        provider: LLMProviderType.OLLAMA,
        tokensUsed: estimatedTokens,
        diffSizeTruncated: wasTruncated,
        originalDiffSize: diffContent.length,
        truncatedDiffSize: processedDiff.length,
        metadata: {
          endpoint: this.ollamaConfig.baseUrl,
          estimatedTokens: true,
        },
      };
    } catch (error: any) {
      console.error(`❌ [Ollama Provider] Generation failed:`, error);
      throw this.transformError(error);
    }
  }

  /**
   * Test connection to Ollama
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log(`🔍 [Ollama Provider] Testing connection...`);
      console.log(`🌐 [Ollama Provider] Endpoint: ${this.ollamaConfig.baseUrl}`);
      console.log(`🤖 [Ollama Provider] Model: ${this.ollamaConfig.model}`);

      const testClient = new Ollama({
        baseUrl: this.ollamaConfig.baseUrl,
        model: this.ollamaConfig.model,
        temperature: 0.1,
      });

      await testClient.invoke('Test connection. Respond with "OK".');

      console.log(`✅ [Ollama Provider] Connection test successful`);
      return true;
    } catch (error: any) {
      console.error(`❌ [Ollama Provider] Connection test failed:`, error);
      throw this.transformError(error);
    }
  }

  /**
   * Get Ollama provider capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return {
      maxTokens: 4096, // Varies by model, this is conservative
      supportedModels: [
        'llama2',
        'llama2:13b',
        'llama2:7b',
        'codellama',
        'codellama:13b',
        'codellama:7b',
        'mistral',
        'mistral:7b',
        'mixtral',
        'neural-chat',
        'starling-lm',
        'openchat',
        'dolphin-mistral',
        'phi',
        'orca-mini',
        'vicuna',
        'nous-hermes',
        'wizard-coder',
      ],
      supportsStreaming: true,
      costPerToken: {
        input: 0, // Local inference is free
        output: 0, // Local inference is free
      },
      rateLimit: {
        requestsPerMinute: 60, // Depends on hardware
        tokensPerMinute: 1000, // Depends on hardware
      },
    };
  }

  /**
   * Validate Ollama configuration
   */
  async validateConfig(): Promise<boolean> {
    return this.testConnection();
  }

  /**
   * Get available Ollama models by calling the API
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      // Try to fetch available models from Ollama API
      const response = await fetch(`${this.ollamaConfig.baseUrl}/api/tags`);
      
      if (response.ok) {
        const data = await response.json() as any;
        return data.models?.map((model: any) => model.name) || this.getCapabilities().supportedModels;
      }
      
      // Fallback to static list if API call fails
      return this.getCapabilities().supportedModels;
    } catch (error) {
      console.warn(`⚠️  [Ollama Provider] Could not fetch available models, using default list:`, error);
      return this.getCapabilities().supportedModels;
    }
  }

  /**
   * Transform errors into LLMProviderError instances
   */
  private transformError(error: any): LLMProviderError {
    console.error('❌ [Ollama Provider] Raw error:', error);

    // Handle connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new LLMProviderError(
        LLMProviderType.OLLAMA,
        LLMProviderErrorCode.NETWORK_ERROR,
        `Cannot connect to Ollama at ${this.ollamaConfig.baseUrl}. Please ensure Ollama is running.`,
        undefined,
        error,
      );
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return new LLMProviderError(
        LLMProviderType.OLLAMA,
        LLMProviderErrorCode.TIMEOUT,
        'Ollama request timed out. This may be normal for large requests on slower hardware.',
        undefined,
        error,
      );
    }

    // Handle HTTP errors
    if (error.response) {
      const statusCode = error.response.status;
      const errorMessage = error.response.data?.error || error.message || 'Unknown Ollama error';

      switch (statusCode) {
        case 404:
          return new LLMProviderError(
            LLMProviderType.OLLAMA,
            LLMProviderErrorCode.MODEL_NOT_FOUND,
            `Ollama model '${this.ollamaConfig.model}' not found. Please pull the model first: ollama pull ${this.ollamaConfig.model}`,
            statusCode,
            error,
          );

        case 400:
          return new LLMProviderError(
            LLMProviderType.OLLAMA,
            LLMProviderErrorCode.INVALID_REQUEST,
            `Invalid request to Ollama: ${errorMessage}`,
            statusCode,
            error,
          );

        case 500:
          return new LLMProviderError(
            LLMProviderType.OLLAMA,
            LLMProviderErrorCode.PROVIDER_UNAVAILABLE,
            'Ollama server error. Please check the Ollama logs.',
            statusCode,
            error,
          );

        default:
          return new LLMProviderError(
            LLMProviderType.OLLAMA,
            LLMProviderErrorCode.UNKNOWN_ERROR,
            `Ollama error: ${errorMessage}`,
            statusCode,
            error,
          );
      }
    }

    // Default error
    return new LLMProviderError(
      LLMProviderType.OLLAMA,
      LLMProviderErrorCode.UNKNOWN_ERROR,
      `Unexpected Ollama error: ${error.message || 'Unknown error occurred'}`,
      undefined,
      error,
    );
  }
}

/**
 * Factory function to create an Ollama provider
 */
export function createOllamaProvider(config: OllamaProviderConfig): OllamaProvider {
  return new OllamaProvider(config);
}
