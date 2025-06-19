/**
 * Test script to verify Bitbucket API integration
 */

const axios = require('axios');

async function testBitbucketIntegration() {
  console.log('🧪 Testing Bitbucket API integration...\n');

  // Test data - this should be replaced with actual Bitbucket PR URL and token for real testing
  const testData = {
    prUrl: 'https://bitbucket.org/test-workspace/test-repo/pull-requests/123',
    bitbucketToken: 'test-token-12345678',
  };

  try {
    console.log('📡 Sending request to generate endpoint...');
    console.log('Request data:', {
      prUrl: testData.prUrl,
      bitbucketToken: testData.bitbucketToken.substring(0, 8) + '...',
    });

    const response = await axios.post('http://localhost:3001/api/v1/generate-mvp', testData, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    console.log('\n✅ Response received:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('\n❌ Request failed:');

    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('Network error:', error.message);
      console.log('Is the backend server running on http://localhost:3001?');
    } else {
      console.log('Request setup error:', error.message);
    }
  }
}

// Test URL parsing functionality
function testUrlParsing() {
  console.log('\n🔍 Testing URL parsing functionality...\n');

  const testUrls = [
    'https://bitbucket.org/workspace/repo/pull-requests/123',
    'https://bitbucket.org/my-workspace/my-repo/pull-requests/456/activity',
    'https://bitbucket.org/workspace/repo/pull-requests/abc', // Invalid - non-numeric ID
    'https://github.com/workspace/repo/pull/123', // Invalid - wrong domain
    'not-a-url', // Invalid - not a URL
    '', // Invalid - empty
  ];

  testUrls.forEach((url, index) => {
    console.log(`Test ${index + 1}: ${url || '(empty string)'}`);
    // Note: Actual parsing logic would be tested here if we import the utilities
    console.log('  → Would be tested with parseBitbucketPRUrl() function\n');
  });
}

async function main() {
  console.log('🚀 Bitbucket API Integration Test Suite\n');
  console.log('==========================================\n');

  // Test URL parsing
  testUrlParsing();

  // Test API integration
  await testBitbucketIntegration();

  console.log('\n✨ Test suite completed!');
  console.log(
    '\nNote: For real testing, replace test-token-12345678 with a valid Bitbucket OAuth token',
  );
  console.log('and use a real PR URL from a repository you have access to.');
}

main().catch(console.error);
