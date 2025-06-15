// Test script for URL validation
// Run this in the browser console on any page to test URL validation

const testUrls = [
  // Valid URLs (should pass)
  'https://bitbucket.org/workspace/repo/pull-requests/123',
  'https://bitbucket.org/myteam/myproject/pull-requests/456',
  
  // Invalid URLs (should fail)
  'https://github.com/workspace/repo/pull-requests/123',
  'https://bitbucket.org/workspace/pull-requests/123',
  'https://bitbucket.org/workspace/repo/123',
  'https://bitbucket.org/workspace/repo/pull-requests/',
  'https://bitbucket.org/workspace/repo/pull-requests/abc',
  'http://bitbucket.org/workspace/repo/pull-requests/123',
  'https://bitbucket.org/workspace/repo/pullrequests/123',
];

function extractPRInfoFromUrl(url) {
  const prUrlPattern = /^https:\/\/bitbucket\.org\/([^\/]+)\/([^\/]+)\/pull-requests\/(\d+)/;
  const match = url.match(prUrlPattern);
  
  if (!match) {
    return null;
  }
  
  return {
    workspace: match[1],
    repo: match[2], 
    prId: match[3],
    fullUrl: url,
  };
}

// Test all URLs
testUrls.forEach(url => {
  const result = extractPRInfoFromUrl(url);
  const status = result ? 'VALID' : 'INVALID';
  console.log(`${status}: ${url}`, result);
});
