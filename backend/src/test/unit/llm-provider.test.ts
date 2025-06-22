import { LLMProviderFactory } from '../../services/providers/provider-factory';
import { LLMProviderType } from '../../services/llm-provider';
import { OpenAIProvider } from '../../services/providers/openai-provider';
import { AnthropicProvider } from '../../services/providers/anthropic-provider';
import { OllamaProvider } from '../../services/providers/ollama-provider';

describe('LLM Provider Factory', () => {
  let factory: LLMProviderFactory;

  beforeEach(() => {
    factory = LLMProviderFactory.getInstance();
  });

  describe('createProvider', () => {
    it('should create OpenAI provider', () => {
      const config = {
        apiKey: 'test-key',
      };

      const provider = factory.createProvider(LLMProviderType.OPENAI, config);
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should create Anthropic provider', () => {
      const config = {
        apiKey: 'test-key',
      };

      const provider = factory.createProvider(LLMProviderType.ANTHROPIC, config);
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it('should create Ollama provider', () => {
      const config = {
        baseUrl: 'http://localhost:11434',
        model: 'llama2',
      };

      const provider = factory.createProvider(LLMProviderType.OLLAMA, config);
      expect(provider).toBeInstanceOf(OllamaProvider);
    });
  });
});
