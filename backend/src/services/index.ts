/**
 * Multi-LLM Provider Infrastructure Export
 * Provides a unified interface to all LLM providers and utilities
 */

// Core interfaces and types
export {
  BaseLLMProvider,
  LLMProviderType,
  LLMProviderError,
  LLMProviderErrorCode,
  formatLLMProviderError,
} from './llm-provider';

export type {
  LLMProviderConfig,
  GenerateDescriptionOptions,
  GeneratedDescription,
  ProviderCapabilities,
} from './llm-provider';

// Individual provider implementations
export { OpenAIProvider, createOpenAIProvider } from './providers/openai-provider';

export type { OpenAIProviderConfig } from './providers/openai-provider';

export { AnthropicProvider, createAnthropicProvider } from './providers/anthropic-provider';

export type { AnthropicProviderConfig } from './providers/anthropic-provider';

export { XAIProvider, createXAIProvider } from './providers/xai-provider';

export type { XAIProviderConfig } from './providers/xai-provider';

export { OllamaProvider, createOllamaProvider } from './providers/ollama-provider';

export type { OllamaProviderConfig } from './providers/ollama-provider';

// Provider factory and registry
export {
  LLMProviderFactory,
  ProviderRegistry,
  getProviderFactory,
  createProvider,
} from './providers/provider-factory';

export type { ProviderFactoryConfig, AnyProviderConfig } from './providers/provider-factory';

// Configuration utilities
export { initializeProviders, checkProviderHealth, getProviderExample } from './provider-config';
