# Multi-LLM Provider Infrastructure Documentation

## Overview

The Multi-LLM Provider Infrastructure is a comprehensive system that enables the Blamewriter backend to support multiple Large Language Model (LLM) providers dynamically. Built on top of LangChain.js, it provides a unified interface for different AI providers while maintaining provider-specific optimizations and error handling.

## Architecture

### Core Components

1. **Abstract Provider Interface** (`llm-provider.ts`)
   - Defines common interface for all providers
   - Standardizes error handling and capabilities
   - Provides base functionality like diff truncation

2. **Provider Implementations**
   - **OpenAI Provider** (`providers/openai-provider.ts`) - Using LangChain ChatOpenAI
   - **Anthropic Provider** (`providers/anthropic-provider.ts`) - Using LangChain ChatAnthropic
   - **xAI Provider** (`providers/xai-provider.ts`) - Custom implementation (no LangChain support yet)
   - **Ollama Provider** (`providers/ollama-provider.ts`) - Using LangChain Ollama

3. **Provider Factory** (`providers/provider-factory.ts`)
   - Dynamic provider creation and management
   - Provider registry for multiple instances
   - Fallback and health check logic

4. **Enhanced API Route** (`routes/generate-v2-multi-llm.ts`)
   - New API endpoint with multi-provider support
   - Advanced request validation
   - Comprehensive error handling

## Supported Providers

### OpenAI
- **Models**: gpt-3.5-turbo, gpt-4, gpt-4o, gpt-4o-mini, etc.
- **Features**: High-quality responses, fast processing
- **Configuration**: Requires API key
- **Cost**: ~$0.0015/$0.002 per 1K tokens (input/output)

### Anthropic Claude
- **Models**: claude-3-haiku, claude-3-sonnet, claude-3-opus, claude-3-5-sonnet
- **Features**: Large context window (200K tokens), safety-focused
- **Configuration**: Requires API key
- **Cost**: ~$0.25/$1.25 per 1M tokens (varies by model)

### xAI Grok
- **Models**: grok-beta, grok-vision-beta
- **Features**: Large context window (131K tokens), real-time information
- **Configuration**: Requires API key
- **Cost**: Competitive pricing (exact rates TBD)

### Ollama (Local)
- **Models**: llama2, codellama, mistral, mixtral, etc.
- **Features**: Local inference, no API costs, privacy
- **Configuration**: Requires local Ollama server endpoint
- **Cost**: Free (local compute only)

## Installation and Setup

### 1. Install Dependencies

```bash
cd backend
npm install langchain @langchain/openai @langchain/anthropic @langchain/ollama
```

### 2. Environment Configuration

Create a `.env` file with your provider credentials:

```env
# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# xAI
XAI_API_KEY=xai-your-xai-key

# Ollama (local)
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=llama2
```

### 3. Provider Initialization

```typescript
import { initializeProviders } from './src/services/provider-config';

// Initialize providers at application startup
await initializeProviders();
```

## API Usage

### Enhanced API Endpoint

**POST** `/api/v2/generate`

#### Request Format

```json
{
  "prUrl": "https://bitbucket.org/workspace/repo/pull-requests/123",
  "bitbucketToken": "your-bitbucket-token",
  "llmConfig": {
    "providerId": "openai",
    "modelId": "gpt-3.5-turbo",
    "apiKey": "sk-your-api-key",
    "parameters": {
      "temperature": 0.7,
      "maxTokens": 1000
    }
  },
  "template": {
    "id": "default-pr-template",
    "content": "Generate a PR description for: {DIFF_CONTENT}"
  },
  "options": {
    "diffProcessing": {
      "maxChunkSize": 4000,
      "enableMapReduce": false
    }
  }
}
```

#### Response Format

```json
{
  "success": true,
  "data": {
    "description": "Generated PR description...",
    "metadata": {
      "version": "2.0.0",
      "timestamp": "2025-06-14T...",
      "requestId": "uuid-here",
      "processingTime": 1234
    },
    "diffStats": {
      "totalFiles": 5,
      "addedLines": 42,
      "deletedLines": 18,
      "fileTypes": {
        "ts": 3,
        "js": 2
      },
      "processingMethod": "direct"
    },
    "llmProvider": {
      "name": "openai",
      "model": "gpt-3.5-turbo",
      "tokensUsed": 567
    }
  }
}
```

## Code Examples

### Basic Provider Usage

```typescript
import { createProvider, LLMProviderType } from './src/services';

// Create OpenAI provider
const openaiProvider = createProvider(LLMProviderType.OPENAI, {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-3.5-turbo',
});

// Generate description
const result = await openaiProvider.generatePRDescription(diffContent, {
  temperature: 0.7,
  maxTokens: 1000,
});

console.log(result.description);
```

### Provider Factory Usage

```typescript
import { getProviderFactory } from './src/services';

const factory = getProviderFactory();

// Register multiple providers
factory.createAndRegister('openai-main', LLMProviderType.OPENAI, {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
}, true); // Set as default

factory.createAndRegister('anthropic-backup', LLMProviderType.ANTHROPIC, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-sonnet-20240229',
});

// Get provider with fallback
const provider = factory.getProviderWithFallback(
  'openai-main',           // Preferred
  LLMProviderType.ANTHROPIC // Fallback type
);
```

### Health Monitoring

```typescript
import { checkProviderHealth } from './src/services';

// Check all provider health
await checkProviderHealth();

// Or check specific factory
const factory = getProviderFactory();
const healthStatus = await factory.healthCheck();

console.log('Provider Health:', healthStatus);
/*
{
  "openai-main": { "healthy": true },
  "anthropic-backup": { "healthy": false, "error": "Invalid API key" }
}
*/
```

## Error Handling

The system provides comprehensive error handling with standardized error codes:

```typescript
import { LLMProviderError, LLMProviderErrorCode } from './src/services';

try {
  const result = await provider.generatePRDescription(diffContent);
} catch (error) {
  if (error instanceof LLMProviderError) {
    switch (error.code) {
      case LLMProviderErrorCode.INVALID_API_KEY:
        // Handle authentication error
        break;
      case LLMProviderErrorCode.RATE_LIMITED:
        // Handle rate limiting
        break;
      case LLMProviderErrorCode.TOKEN_LIMIT_EXCEEDED:
        // Handle token limit
        break;
      // ... other error codes
    }
  }
}
```

## Testing

### Run Provider Tests

```bash
# Test multi-LLM infrastructure
cd backend
npx ts-node test-multi-llm.ts
```

### Example Test Output

```
🧪 Testing Multi-LLM Provider Infrastructure

🧪 Testing OpenAI Provider...
✅ OpenAI Provider created successfully
📋 OpenAI Capabilities: { maxTokens: 4096, supportedModels: [...] }
✅ OpenAI Connection test passed

🧪 Testing Anthropic Provider...
✅ Anthropic Provider created successfully
✅ Anthropic Connection test passed

🧪 Testing Provider Factory Registry...
📋 Registered providers: ["test-openai"]
🏥 Provider health check results: { "test-openai": { "healthy": true } }

🎉 Multi-LLM Provider testing completed!
```

## Configuration Best Practices

### 1. Security
- Never commit API keys to version control
- Use environment variables for all credentials
- Implement API key rotation procedures
- Monitor usage and costs

### 2. Performance
- Choose appropriate models for your use case
- Implement request caching for repeated operations
- Use streaming for long responses when possible
- Monitor token usage and optimize prompts

### 3. Reliability
- Configure multiple providers for redundancy
- Implement proper retry logic with exponential backoff
- Set appropriate timeouts for different providers
- Monitor provider health and availability

### 4. Cost Management
- Track token usage per provider
- Implement usage limits and alerts
- Choose cost-effective models for different scenarios
- Consider local inference (Ollama) for development

## Troubleshooting

### Common Issues

1. **Provider Connection Failures**
   - Check API keys and network connectivity
   - Verify provider service status
   - Review timeout settings

2. **Model Not Found Errors**
   - Verify model names match provider documentation
   - Check account access to specific models
   - For Ollama, ensure models are pulled locally

3. **Token Limit Exceeded**
   - Implement diff chunking for large PRs
   - Use models with larger context windows
   - Optimize prompt templates

4. **Rate Limiting**
   - Implement exponential backoff
   - Consider using multiple API keys
   - Monitor usage patterns

### Debug Logging

Enable detailed logging by setting log levels:

```typescript
// Enable debug logging for providers
console.log = (...args) => {
  if (args[0]?.includes('[Provider]')) {
    // Log provider-specific messages
  }
};
```

## Future Enhancements

1. **Map-Reduce Processing** for very large diffs
2. **Provider Load Balancing** based on capacity and cost
3. **Response Caching** to reduce API calls
4. **Custom Model Fine-tuning** support
5. **Streaming Responses** for real-time feedback
6. **Provider Analytics** and usage insights
7. **A/B Testing** framework for model comparison

## Contributing

When adding new providers:

1. Implement the `BaseLLMProvider` interface
2. Add provider-specific error handling
3. Include comprehensive tests
4. Update documentation and examples
5. Add environment configuration options

For questions or issues, please refer to the main project documentation or create an issue in the repository.
