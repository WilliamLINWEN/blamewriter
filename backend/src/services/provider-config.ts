/**
 * Example configuration for Multi-LLM Provider Initialization
 * This demonstrates how to set up multiple providers at application startup
 */

import { 
  getProviderFactory, 
  ProviderFactoryConfig 
} from '../services/providers/provider-factory';
import { LLMProviderType } from '../services/llm-provider';

/**
 * Initialize multiple LLM providers based on environment configuration
 * This is an example of how to set up providers at application startup
 */
export async function initializeProviders(): Promise<void> {
  const factory = getProviderFactory();

  // Example provider configurations
  const providerConfigs: Array<ProviderFactoryConfig & { key: string; isDefault?: boolean }> = [];

  // OpenAI (if API key is available)
  if (process.env.OPENAI_API_KEY) {
    providerConfigs.push({
      key: 'openai-default',
      provider: LLMProviderType.OPENAI,
      config: {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-3.5-turbo',
        timeout: 60000,
        maxRetries: 3,
      },
      isDefault: true, // Set as default provider
    });
  }

  // Anthropic (if API key is available)
  if (process.env.ANTHROPIC_API_KEY) {
    providerConfigs.push({
      key: 'anthropic-default',
      provider: LLMProviderType.ANTHROPIC,
      config: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-sonnet-20240229',
        timeout: 60000,
        maxRetries: 3,
      },
    });
  }

  // xAI (if API key is available)
  if (process.env.XAI_API_KEY) {
    providerConfigs.push({
      key: 'xai-default',
      provider: LLMProviderType.XAI,
      config: {
        apiKey: process.env.XAI_API_KEY,
        model: 'grok-beta',
        timeout: 60000,
        maxRetries: 3,
      },
    });
  }

  // Ollama (if endpoint is configured)
  if (process.env.OLLAMA_ENDPOINT) {
    providerConfigs.push({
      key: 'ollama-default',
      provider: LLMProviderType.OLLAMA,
      config: {
        baseUrl: process.env.OLLAMA_ENDPOINT,
        model: process.env.OLLAMA_MODEL || 'llama2',
        timeout: 120000, // Longer timeout for local inference
        maxRetries: 2,
      },
    });
  }

  if (providerConfigs.length === 0) {
    console.warn('⚠️  [Provider Factory] No providers configured. Set environment variables to enable providers.');
    return;
  }

  try {
    await factory.initializeProviders(providerConfigs);
    console.log(`🎉 [Provider Factory] Successfully initialized ${providerConfigs.length} providers`);
    
    // Log provider capabilities
    const capabilities = factory.discoverCapabilities();
    console.log('📋 [Provider Factory] Available provider capabilities:', JSON.stringify(capabilities, null, 2));
  } catch (error) {
    console.error('❌ [Provider Factory] Failed to initialize providers:', error);
    throw error;
  }
}

/**
 * Perform health check on all providers
 */
export async function checkProviderHealth(): Promise<void> {
  try {
    const factory = getProviderFactory();
    const healthStatus = await factory.healthCheck();
    
    console.log('🏥 [Provider Health] Health check results:');
    for (const [key, status] of Object.entries(healthStatus)) {
      if (status.healthy) {
        console.log(`✅ [Provider Health] ${key}: Healthy`);
      } else {
        console.log(`❌ [Provider Health] ${key}: Unhealthy - ${status.error}`);
      }
    }
  } catch (error) {
    console.error('❌ [Provider Health] Health check failed:', error);
  }
}

/**
 * Example of how to use provider factory at runtime
 */
export function getProviderExample() {
  const factory = getProviderFactory();
  
  // Get provider with fallback logic
  try {
    // Try to get preferred provider, fall back to OpenAI, then to default
    const provider = factory.getProviderWithFallback(
      'openai-default',      // Preferred provider key
      LLMProviderType.OPENAI // Fallback provider type
    );
    
    console.log(`🤖 [Provider Example] Using provider: ${provider.getProviderType()}`);
    return provider;
  } catch (error) {
    console.error('❌ [Provider Example] No providers available:', error);
    throw error;
  }
}
