/**
 * Bitbucket utility functions for URL parsing and validation
 */

/**
 * Interface for parsed PR information
 */
export interface ParsedPRInfo {
  workspace: string;
  repo: string;
  prId: string;
  originalUrl: string;
}

/**
 * Error codes for Bitbucket URL parsing
 */
export enum BitbucketUrlErrorCode {
  INVALID_URL = 'INVALID_URL',
  NOT_BITBUCKET_DOMAIN = 'NOT_BITBUCKET_DOMAIN',
  INVALID_PR_PATH = 'INVALID_PR_PATH',
  MISSING_WORKSPACE = 'MISSING_WORKSPACE',
  MISSING_REPO = 'MISSING_REPO',
  MISSING_PR_ID = 'MISSING_PR_ID',
  INVALID_PR_ID = 'INVALID_PR_ID',
}

/**
 * Custom error class for Bitbucket URL parsing errors
 */
export class BitbucketUrlError extends Error {
  constructor(
    public code: BitbucketUrlErrorCode,
    message: string,
    public originalUrl?: string,
  ) {
    super(message);
    this.name = 'BitbucketUrlError';
  }
}

/**
 * Validates that a URL is a valid Bitbucket domain
 */
function validateBitbucketDomain(url: URL): void {
  if (!url.hostname.includes('bitbucket.org')) {
    throw new BitbucketUrlError(
      BitbucketUrlErrorCode.NOT_BITBUCKET_DOMAIN,
      `Invalid domain: ${url.hostname}. Expected bitbucket.org domain.`,
      url.toString(),
    );
  }
}

/**
 * Validates that the URL path matches Bitbucket PR format
 */
function validatePRPath(url: URL): void {
  // Expected format: /workspace/repo/pull-requests/123
  // Optional trailing parts: /activity, /diff, etc.
  const pathPattern = /^\/([^/]+)\/([^/]+)\/pull-requests\/(\d+)(?:\/.*)?$/;

  if (!pathPattern.test(url.pathname)) {
    throw new BitbucketUrlError(
      BitbucketUrlErrorCode.INVALID_PR_PATH,
      `Invalid PR URL path: ${url.pathname}. Expected format: /workspace/repo/pull-requests/id`,
      url.toString(),
    );
  }
}

/**
 * Extracts workspace, repo, and PR ID from a validated URL path
 */
function extractPRComponents(url: URL): { workspace: string; repo: string; prId: string } {
  const pathPattern = /^\/([^/]+)\/([^/]+)\/pull-requests\/(\d+)(?:\/.*)?$/;
  const match = url.pathname.match(pathPattern);

  if (!match) {
    throw new BitbucketUrlError(
      BitbucketUrlErrorCode.INVALID_PR_PATH,
      `Could not extract PR components from path: ${url.pathname}`,
      url.toString(),
    );
  }

  const [, workspace, repo, prId] = match;

  // Validate extracted components
  if (!workspace || workspace.trim() === '') {
    throw new BitbucketUrlError(
      BitbucketUrlErrorCode.MISSING_WORKSPACE,
      'Workspace cannot be empty',
      url.toString(),
    );
  }

  if (!repo || repo.trim() === '') {
    throw new BitbucketUrlError(
      BitbucketUrlErrorCode.MISSING_REPO,
      'Repository name cannot be empty',
      url.toString(),
    );
  }

  if (!prId || prId.trim() === '') {
    throw new BitbucketUrlError(
      BitbucketUrlErrorCode.MISSING_PR_ID,
      'PR ID cannot be empty',
      url.toString(),
    );
  }

  // Validate PR ID is numeric
  const prIdNum = parseInt(prId, 10);
  if (isNaN(prIdNum) || prIdNum <= 0) {
    throw new BitbucketUrlError(
      BitbucketUrlErrorCode.INVALID_PR_ID,
      `Invalid PR ID: ${prId}. PR ID must be a positive number.`,
      url.toString(),
    );
  }

  return {
    workspace: workspace.trim(),
    repo: repo.trim(),
    prId: prId.trim(),
  };
}

/**
 * Parses a Bitbucket PR URL and extracts workspace, repo, and PR ID
 *
 * @param prUrl - The Bitbucket PR URL to parse
 * @returns Parsed PR information including workspace, repo, and PR ID
 * @throws BitbucketUrlError if the URL is invalid or malformed
 *
 * @example
 * ```typescript
 * const info = parseBitbucketPRUrl('https://bitbucket.org/myworkspace/myrepo/pull-requests/123');
 * console.log(info);
 * // {
 * //   workspace: 'myworkspace',
 * //   repo: 'myrepo',
 * //   prId: '123',
 * //   originalUrl: 'https://bitbucket.org/myworkspace/myrepo/pull-requests/123'
 * // }
 * ```
 */
export function parseBitbucketPRUrl(prUrl: string): ParsedPRInfo {
  // Basic input validation
  if (!prUrl || typeof prUrl !== 'string') {
    throw new BitbucketUrlError(
      BitbucketUrlErrorCode.INVALID_URL,
      'PR URL must be a non-empty string',
    );
  }

  const trimmedUrl = prUrl.trim();
  if (trimmedUrl === '') {
    throw new BitbucketUrlError(BitbucketUrlErrorCode.INVALID_URL, 'PR URL cannot be empty');
  }

  let url: URL;
  try {
    url = new URL(trimmedUrl);
  } catch (error) {
    throw new BitbucketUrlError(
      BitbucketUrlErrorCode.INVALID_URL,
      `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`,
      trimmedUrl,
    );
  }

  // Validate Bitbucket domain
  validateBitbucketDomain(url);

  // Validate PR path format
  validatePRPath(url);

  // Extract components
  const { workspace, repo, prId } = extractPRComponents(url);

  return {
    workspace,
    repo,
    prId,
    originalUrl: trimmedUrl,
  };
}

/**
 * Validates if a string is a valid Bitbucket PR URL
 *
 * @param prUrl - The URL to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = isValidBitbucketPRUrl('https://bitbucket.org/workspace/repo/pull-requests/123');
 * console.log(isValid); // true
 * ```
 */
export function isValidBitbucketPRUrl(prUrl: string): boolean {
  try {
    parseBitbucketPRUrl(prUrl);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Gets a user-friendly error message from a BitbucketUrlError
 *
 * @param error - The error to format
 * @returns User-friendly error message
 */
export function formatBitbucketUrlError(error: BitbucketUrlError): string {
  switch (error.code) {
    case BitbucketUrlErrorCode.INVALID_URL:
      return 'The provided URL is not valid. Please check the URL format.';

    case BitbucketUrlErrorCode.NOT_BITBUCKET_DOMAIN:
      return 'The URL must be from bitbucket.org domain.';

    case BitbucketUrlErrorCode.INVALID_PR_PATH:
      return 'The URL must be a Bitbucket pull request URL. Expected format: https://bitbucket.org/workspace/repo/pull-requests/id';

    case BitbucketUrlErrorCode.MISSING_WORKSPACE:
      return 'The workspace name is missing from the URL.';

    case BitbucketUrlErrorCode.MISSING_REPO:
      return 'The repository name is missing from the URL.';

    case BitbucketUrlErrorCode.MISSING_PR_ID:
      return 'The pull request ID is missing from the URL.';

    case BitbucketUrlErrorCode.INVALID_PR_ID:
      return 'The pull request ID must be a positive number.';

    default:
      return error.message || 'An unknown error occurred while parsing the URL.';
  }
}
