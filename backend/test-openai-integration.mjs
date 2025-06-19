/**
 * Test script to verify OpenAI API integration
 */

import { createOpenAIClient, OpenAIServiceError } from './dist/services/openai.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testOpenAIIntegration() {
  console.log('🧪 Testing OpenAI API integration...\n');

  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    console.log('❌ OPENAI_API_KEY not found in environment variables');
    console.log('Please set OPENAI_API_KEY in your .env file to test OpenAI integration');
    return;
  }

  console.log(`🔑 Using OpenAI API key: ${openaiApiKey.substring(0, 8)}...`);

  try {
    // Create OpenAI client
    console.log('🤖 Creating OpenAI client...');
    const openaiClient = createOpenAIClient(openaiApiKey);
    
    // Test connection
    console.log('🔍 Testing connection to OpenAI API...');
    await openaiClient.testConnection();
    console.log('✅ Connection test successful!');
    
    // Test PR description generation with sample diff
    const sampleDiff = `diff --git a/src/components/Button.tsx b/src/components/Button.tsx
index 1234567..abcdefg 100644
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1,8 +1,12 @@
 import React from 'react';
+import { ButtonHTMLAttributes } from 'react';
 
-interface ButtonProps {
+interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
   label: string;
+  variant?: 'primary' | 'secondary';
+  size?: 'small' | 'medium' | 'large';
 }
 
-export const Button: React.FC<ButtonProps> = ({ label }) => {
-  return <button>{label}</button>;
+export const Button: React.FC<ButtonProps> = ({ label, variant = 'primary', size = 'medium', ...props }) => {
+  const className = \`btn btn-\${variant} btn-\${size}\`;
+  return <button className={className} {...props}>{label}</button>;
 };`;

    console.log('\n📝 Testing PR description generation...');
    console.log(`📏 Sample diff size: ${sampleDiff.length} characters`);
    
    const result = await openaiClient.generatePRDescription(sampleDiff, {
      model: 'gpt-3.5-turbo',
      maxTokens: 500,
      temperature: 0.7,
      diffSizeLimit: 4000
    });
    
    console.log('\n✅ PR description generated successfully!');
    console.log(`📊 Generation stats:`);
    console.log(`   Model: ${result.model}`);
    console.log(`   Tokens used: ${result.tokensUsed}`);
    console.log(`   Diff truncated: ${result.diffSizeTruncated}`);
    console.log(`   Original size: ${result.originalDiffSize} chars`);
    console.log(`   Processed size: ${result.truncatedDiffSize} chars`);
    
    console.log('\n📖 Generated description:');
    console.log('=' .repeat(50));
    console.log(result.description);
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.log('\n❌ OpenAI integration test failed:');
    
    if (error instanceof OpenAIServiceError) {
      console.log(`   Error code: ${error.code}`);
      console.log(`   Message: ${error.message}`);
      if (error.statusCode) {
        console.log(`   Status code: ${error.statusCode}`);
      }
    } else {
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

async function main() {
  console.log('🚀 OpenAI API Integration Test Suite\n');
  console.log('=' .repeat(50));
  
  await testOpenAIIntegration();
  
  console.log('\n✨ Test suite completed!');
  console.log('\nNote: This test uses your actual OpenAI API key and will consume tokens.');
  console.log('Make sure you have sufficient quota before running this test.');
}

main().catch(console.error);
