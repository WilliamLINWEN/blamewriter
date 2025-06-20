/**
 * Test script for Multi-LLM Provider Infrastructure
 * Run with: node -r ts-node/register test-multi-llm.ts
 */

import dotenv from 'dotenv';
import { getProviderFactory, createProvider } from './src/services/providers/provider-factory';
import { LLMProviderType } from './src/services/llm-provider';

// Load environment variables
dotenv.config();

async function testProviders() {
  console.log('🧪 Testing Multi-LLM Provider Infrastructure\n');

  const factory = getProviderFactory();

  // Test sample diff content
  const sampleDiff = `diff --git a/src/example.ts b/src/example.ts
index 1234567..abcdefg 100644
--- a/src/example.ts
+++ b/src/example.ts
@@ -1,5 +1,10 @@
 export class Example {
+  private name: string;
+  
+  constructor(name: string) {
+    this.name = name;
+  }
+
   public greet(): string {
-    return 'Hello World';
+    return \`Hello \${this.name}\`;
   }
 }`;

  // Test OpenAI if available
  if (process.env.OPENAI_API_KEY) {
    try {
      console.log('🧪 Testing OpenAI Provider...');
      const openaiProvider = createProvider(LLMProviderType.OPENAI, {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-3.5-turbo',
      });

      console.log('✅ OpenAI Provider created successfully');
      console.log('📋 OpenAI Capabilities:', openaiProvider.getCapabilities());

      // Test connection
      await openaiProvider.testConnection();
      console.log('✅ OpenAI Connection test passed');

      // Test generation (optional - costs tokens)
      // const result = await openaiProvider.generatePRDescription(sampleDiff);
      // console.log('✅ OpenAI Generation test passed:', result.description.substring(0, 100) + '...');

      console.log('');
    } catch (error: any) {
      console.error('❌ OpenAI Provider test failed:', error.message);
    }
  } else {
    console.log('⏭️  Skipping OpenAI test (no API key provided)\n');
  }

  // Test Anthropic if available
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      console.log('🧪 Testing Anthropic Provider...');
      const anthropicProvider = createProvider(LLMProviderType.ANTHROPIC, {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-haiku-20240307',
      });

      console.log('✅ Anthropic Provider created successfully');
      console.log('📋 Anthropic Capabilities:', anthropicProvider.getCapabilities());

      // Test connection
      await anthropicProvider.testConnection();
      console.log('✅ Anthropic Connection test passed');

      console.log('');
    } catch (error: any) {
      console.error('❌ Anthropic Provider test failed:', error.message);
    }
  } else {
    console.log('⏭️  Skipping Anthropic test (no API key provided)\n');
  }

  // Test xAI if available
  if (process.env.XAI_API_KEY) {
    try {
      console.log('🧪 Testing xAI Provider...');
      const xaiProvider = createProvider(LLMProviderType.XAI, {
        apiKey: process.env.XAI_API_KEY,
        model: 'grok-beta',
      });

      console.log('✅ xAI Provider created successfully');
      console.log('📋 xAI Capabilities:', xaiProvider.getCapabilities());

      // Test connection
      await xaiProvider.testConnection();
      console.log('✅ xAI Connection test passed');

      console.log('');
    } catch (error: any) {
      console.error('❌ xAI Provider test failed:', error.message);
    }
  } else {
    console.log('⏭️  Skipping xAI test (no API key provided)\n');
  }

  // Test Ollama if available
  if (process.env.OLLAMA_ENDPOINT) {
    try {
      console.log('🧪 Testing Ollama Provider...');
      const ollamaProvider = createProvider(LLMProviderType.OLLAMA, {
        baseUrl: process.env.OLLAMA_ENDPOINT,
        model: process.env.OLLAMA_MODEL || 'llama2',
      });

      console.log('✅ Ollama Provider created successfully');
      console.log('📋 Ollama Capabilities:', ollamaProvider.getCapabilities());

      // Test connection
      await ollamaProvider.testConnection();
      console.log('✅ Ollama Connection test passed');

      console.log('');
    } catch (error: any) {
      console.error('❌ Ollama Provider test failed:', error.message);
    }
  } else {
    console.log('⏭️  Skipping Ollama test (no endpoint provided)\n');
  }

  // Test Factory Registry
  console.log('🧪 Testing Provider Factory Registry...');

  if (process.env.OPENAI_API_KEY) {
    factory.createAndRegister(
      'test-openai',
      LLMProviderType.OPENAI,
      {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-3.5-turbo',
      },
      true, // Set as default
    );
  }

  const registryKeys = factory.getRegistry().getKeys();
  console.log('📋 Registered providers:', registryKeys);

  if (registryKeys.length > 0) {
    const healthResults = await factory.healthCheck();
    console.log('🏥 Provider health check results:', healthResults);

    console.log('📊 Provider capabilities:', factory.discoverCapabilities());
  }

  console.log('\n🎉 Multi-LLM Provider testing completed!');
}

// Run tests
testProviders().catch(console.error);
