/**
 * LLM Provider Factory for dynamic provider selection and management
 */

import {
  BaseLLMProvider,
  LLMProviderType,
  LLMProviderError,
  LLMProviderErrorCode,
} from '../llm-provider';

import { OpenAIProviderConfig, createOpenAIProvider } from './openai-provider';
import { AnthropicProviderConfig, createAnthropicProvider } from './anthropic-provider';
import { XAIProviderConfig, createXAIProvider } from './xai-provider';
import { OllamaProviderConfig, createOllamaProvider } from './ollama-provider';

/**
 * Union type for all provider-specific configurations
 */
export type AnyProviderConfig =
  | OpenAIProviderConfig
  | AnthropicProviderConfig
  | XAIProviderConfig
  | OllamaProviderConfig;

/**
 * Configuration for provider factory
 */
export interface ProviderFactoryConfig {
  provider: LLMProviderType;
  config: AnyProviderConfig;
}

/**
 * Provider registry for managing multiple providers
 */
export class ProviderRegistry {
  private providers: Map<string, BaseLLMProvider> = new Map();
  private defaultProvider: BaseLLMProvider | undefined;

  /**
   * Register a provider instance
   */
  register(key: string, provider: BaseLLMProvider, isDefault = false): void {
    this.providers.set(key, provider);

    if (isDefault) {
      this.defaultProvider = provider;
    }

    console.log(
      `✅ [Provider Registry] Registered ${provider.getProviderType()} provider as '${key}'${isDefault ? ' (default)' : ''}`,
    );
  }

  /**
   * Get a provider by key
   */
  get(key: string): BaseLLMProvider | undefined {
    return this.providers.get(key);
  }

  /**
   * Get the default provider
   */
  getDefault(): BaseLLMProvider | undefined {
    return this.defaultProvider;
  }

  /**
   * Get all registered provider keys
   */
  getKeys(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider by type (returns first match)
   */
  getByType(type: LLMProviderType): BaseLLMProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.getProviderType() === type) {
        return provider;
      }
    }
    return undefined;
  }

  /**
   * Remove a provider
   */
  unregister(key: string): boolean {
    const provider = this.providers.get(key);
    if (provider && provider === this.defaultProvider) {
      this.defaultProvider = undefined;
    }

    const removed = this.providers.delete(key);
    if (removed) {
      console.log(`🗑️  [Provider Registry] Unregistered provider '${key}'`);
    }

    return removed;
  }

  /**
   * Clear all providers
   */
  clear(): void {
    this.providers.clear();
    this.defaultProvider = undefined;
    console.log('🧹 [Provider Registry] Cleared all providers');
  }

  /**
   * Test all registered providers
   */
  async testAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [key, provider] of this.providers.entries()) {
      try {
        results[key] = await provider.testConnection();
      } catch (error) {
        console.error(`❌ [Provider Registry] Test failed for '${key}':`, error);
        results[key] = false;
      }
    }

    return results;
  }
}

/**
 * LLM Provider Factory for creating and managing providers
 */
export class LLMProviderFactory {
  private static instance: LLMProviderFactory;
  private registry: ProviderRegistry;

  private constructor() {
    this.registry = new ProviderRegistry();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): LLMProviderFactory {
    if (!LLMProviderFactory.instance) {
      LLMProviderFactory.instance = new LLMProviderFactory();
    }
    return LLMProviderFactory.instance;
  }

  /**
   * Create a provider instance based on type and configuration
   */
  createProvider(type: LLMProviderType, config: AnyProviderConfig): BaseLLMProvider {
    console.log(`🏭 [Provider Factory] Creating ${type} provider...`);

    switch (type) {
      case LLMProviderType.OPENAI:
        return createOpenAIProvider(config as OpenAIProviderConfig);

      case LLMProviderType.ANTHROPIC:
        return createAnthropicProvider(config as AnthropicProviderConfig);

      case LLMProviderType.XAI:
        return createXAIProvider(config as XAIProviderConfig);

      case LLMProviderType.OLLAMA:
        return createOllamaProvider(config as OllamaProviderConfig);

      default:
        throw new LLMProviderError(
          type,
          LLMProviderErrorCode.PROVIDER_UNAVAILABLE,
          `Unsupported provider type: ${type}`,
        );
    }
  }

  /**
   * Create and register a provider
   */
  createAndRegister(
    key: string,
    type: LLMProviderType,
    config: AnyProviderConfig,
    isDefault = false,
  ): BaseLLMProvider {
    const provider = this.createProvider(type, config);
    this.registry.register(key, provider, isDefault);
    return provider;
  }

  /**
   * Get the provider registry
   */
  getRegistry(): ProviderRegistry {
    return this.registry;
  }

  /**
   * Initialize providers from configuration array
   */
  async initializeProviders(
    configs: Array<ProviderFactoryConfig & { key: string; isDefault?: boolean }>,
  ): Promise<void> {
    console.log(`🚀 [Provider Factory] Initializing ${configs.length} providers...`);

    const initPromises = configs.map(async ({ key, provider, config, isDefault }) => {
      try {
        const providerInstance = this.createAndRegister(key, provider, config, isDefault);

        // Optionally test the provider during initialization
        await providerInstance.validateConfig();

        console.log(`✅ [Provider Factory] Successfully initialized ${provider} provider '${key}'`);
      } catch (error) {
        console.error(
          `❌ [Provider Factory] Failed to initialize ${provider} provider '${key}':`,
          error,
        );
        throw error;
      }
    });

    await Promise.all(initPromises);
    console.log('🎉 [Provider Factory] All providers initialized successfully');
  }

  /**
   * Get a provider with fallback logic
   */
  getProviderWithFallback(preferredKey?: string, fallbackType?: LLMProviderType): BaseLLMProvider {
    // Try preferred provider first
    if (preferredKey) {
      const preferred = this.registry.get(preferredKey);
      if (preferred) {
        return preferred;
      }
      console.warn(
        `⚠️  [Provider Factory] Preferred provider '${preferredKey}' not found, trying fallbacks...`,
      );
    }

    // Try fallback by type
    if (fallbackType) {
      const fallback = this.registry.getByType(fallbackType);
      if (fallback) {
        return fallback;
      }
      console.warn(
        `⚠️  [Provider Factory] Fallback provider type '${fallbackType}' not found, trying default...`,
      );
    }

    // Try default provider
    const defaultProvider = this.registry.getDefault();
    if (defaultProvider) {
      return defaultProvider;
    }

    // No providers available
    throw new LLMProviderError(
      LLMProviderType.OPENAI, // arbitrary
      LLMProviderErrorCode.PROVIDER_UNAVAILABLE,
      'No LLM providers are available. Please configure at least one provider.',
    );
  }

  /**
   * Discover provider capabilities
   */
  discoverCapabilities(): Record<string, any> {
    const capabilities: Record<string, any> = {};

    for (const [key, provider] of this.registry['providers'].entries()) {
      capabilities[key] = {
        type: provider.getProviderType(),
        capabilities: provider.getCapabilities(),
      };
    }

    return capabilities;
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<Record<string, { healthy: boolean; error?: string }>> {
    const results: Record<string, { healthy: boolean; error?: string }> = {};

    for (const [key, provider] of this.registry['providers'].entries()) {
      try {
        await provider.testConnection();
        results[key] = { healthy: true };
      } catch (error: any) {
        results[key] = {
          healthy: false,
          error: error.message || 'Unknown error',
        };
      }
    }

    return results;
  }
}

/**
 * Convenience function to get the provider factory instance
 */
export function getProviderFactory(): LLMProviderFactory {
  return LLMProviderFactory.getInstance();
}

/**
 * Convenience function to create a provider
 */
export function createProvider(type: LLMProviderType, config: AnyProviderConfig): BaseLLMProvider {
  return getProviderFactory().createProvider(type, config);
}
