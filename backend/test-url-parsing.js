/**
 * Simple test to verify URL parsing functionality
 */

// Import the utility function
const {
  parseBitbucketPRUrl,
  isValidBitbucketPRUrl,
  BitbucketUrlError,
} = require('./dist/utils/bitbucket');

console.log('🧪 Testing Bitbucket URL parsing...\n');

// Test cases
const testCases = [
  {
    name: 'Valid PR URL',
    url: 'https://bitbucket.org/myworkspace/myrepo/pull-requests/123',
    shouldPass: true,
  },
  {
    name: 'Valid PR URL with activity path',
    url: 'https://bitbucket.org/workspace/repo/pull-requests/456/activity',
    shouldPass: true,
  },
  {
    name: 'Valid PR URL with diff path',
    url: 'https://bitbucket.org/workspace/repo/pull-requests/789/diff',
    shouldPass: true,
  },
  {
    name: 'Invalid - non-numeric PR ID',
    url: 'https://bitbucket.org/workspace/repo/pull-requests/abc',
    shouldPass: false,
  },
  {
    name: 'Invalid - wrong domain',
    url: 'https://github.com/workspace/repo/pull/123',
    shouldPass: false,
  },
  {
    name: 'Invalid - not a URL',
    url: 'not-a-url',
    shouldPass: false,
  },
  {
    name: 'Invalid - empty string',
    url: '',
    shouldPass: false,
  },
  {
    name: 'Invalid - missing PR ID',
    url: 'https://bitbucket.org/workspace/repo/pull-requests/',
    shouldPass: false,
  },
];

let passedTests = 0;
const totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`URL: ${testCase.url || '(empty)'}`);

  try {
    const result = parseBitbucketPRUrl(testCase.url);

    if (testCase.shouldPass) {
      console.log('✅ PASS - Parsed successfully:');
      console.log(`   Workspace: ${result.workspace}`);
      console.log(`   Repo: ${result.repo}`);
      console.log(`   PR ID: ${result.prId}`);
      passedTests++;
    } else {
      console.log('❌ FAIL - Expected to fail but passed');
      console.log(`   Result: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    if (!testCase.shouldPass) {
      console.log('✅ PASS - Failed as expected:');
      console.log(`   Error: ${error.message}`);
      passedTests++;
    } else {
      console.log('❌ FAIL - Expected to pass but failed:');
      console.log(`   Error: ${error.message}`);
    }
  }

  console.log('');
});

console.log(`📊 Results: ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log('🎉 All tests passed!');
} else {
  console.log('⚠️  Some tests failed. Please review the implementation.');
}
