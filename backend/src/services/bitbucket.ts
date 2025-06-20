/**
 * Bitbucket API service for fetching PR diffs and related data
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { ParsedPRInfo } from '@/utils/bitbucket';

/**
 * Interface for Bitbucket API error response
 */
export interface BitbucketApiError {
  type: string;
  error: {
    message: string;
    detail?: string;
  };
}

/**
 * Interface for PR diff response from Bitbucket API
 */
export interface BitbucketPRDiff {
  diff: string;
  size: number;
  truncated: boolean;
}

/**
 * Interface for PR basic information from Bitbucket API
 */
export interface BitbucketPRInfo {
  id: number;
  title: string;
  description: string;
  state: 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED';
  author: {
    display_name: string;
    uuid: string;
  };
  source: {
    branch: {
      name: string;
    };
  };
  destination: {
    branch: {
      name: string;
    };
  };
  created_on: string;
  updated_on: string;
}

/**
 * Error codes for Bitbucket API operations
 */
export enum BitbucketApiErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom error class for Bitbucket API errors
 */
export class BitbucketServiceError extends Error {
  constructor(
    public code: BitbucketApiErrorCode,
    message: string,
    public statusCode?: number,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'BitbucketServiceError';
  }
}

/**
 * Configuration options for Bitbucket API client
 */
export interface BitbucketClientConfig {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Default configuration for Bitbucket API client
 */
const DEFAULT_CONFIG: Required<BitbucketClientConfig> = {
  baseUrl: 'https://api.bitbucket.org/2.0',
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
};

/**
 * Bitbucket API client for interacting with Bitbucket REST API
 */
export class BitbucketApiClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly config: Required<BitbucketClientConfig>;

  constructor(
    private readonly accessToken: string,
    clientConfig: BitbucketClientConfig = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...clientConfig };

    // Validate access token
    if (!accessToken || typeof accessToken !== 'string' || accessToken.trim() === '') {
      throw new BitbucketServiceError(
        BitbucketApiErrorCode.UNAUTHORIZED,
        'Bitbucket access token is required and cannot be empty',
      );
    }

    // Optionally, you can use Basic Auth instead of Bearer token
    // Uncomment the following lines if you want to use Basic Auth instead of Bearer token
    // const authHeader = `Basic ${Buffer.from(`BITBUCKET_USERNAME:BITBUCKET_APP_PASSWORD`).toString('base64')}`;

    // Create axios instance with default configuration
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        Accept: 'application/json',
        'User-Agent': 'Bitbucket-PR-Helper/1.0.0',
      },
    });

    // Add request/response interceptors for logging and error handling
    this.setupInterceptors();
  }

  /**
   * Sets up axios interceptors for logging and error handling
   */
  private setupInterceptors(): void {
    // Request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      config => {
        console.log(`🌐 [Bitbucket API] ${config.method?.toUpperCase()} ${config.url}`);
        console.log(
          `🔑 [Bitbucket API] Using Bearer token: ${this.accessToken.substring(0, 8)}...`,
        );
        return config;
      },
      error => {
        console.error('❌ [Bitbucket API] Request setup failed:', error);
        return Promise.reject(error);
      },
    );

    // Response interceptor for logging and error handling
    this.axiosInstance.interceptors.response.use(
      response => {
        console.log(`✅ [Bitbucket API] ${response.status} ${response.config.url}`);
        console.log(
          `📊 [Bitbucket API] Response size: ${JSON.stringify(response.data).length} bytes`,
        );
        return response;
      },
      error => {
        this.logResponseError(error);
        return Promise.reject(this.transformAxiosError(error));
      },
    );
  }

  /**
   * Logs response errors with detailed information
   */
  private logResponseError(error: AxiosError): void {
    if (error.response) {
      console.error(`❌ [Bitbucket API] ${error.response.status} ${error.config?.url}`);
      console.error('❌ [Bitbucket API] Error response:', error.response.data);
    } else if (error.request) {
      console.error(`❌ [Bitbucket API] Network error for ${error.config?.url}:`, error.message);
    } else {
      console.error('❌ [Bitbucket API] Request setup error:', error.message);
    }
  }

  /**
   * Transforms axios errors into BitbucketServiceError instances
   */
  private transformAxiosError(error: AxiosError): BitbucketServiceError {
    if (error.response) {
      const statusCode = error.response.status;
      const errorData = error.response.data as BitbucketApiError;

      switch (statusCode) {
        case 401:
          return new BitbucketServiceError(
            BitbucketApiErrorCode.UNAUTHORIZED,
            'Invalid or expired Bitbucket access token. Please check your token and try again.',
            statusCode,
            error,
          );

        case 403:
          return new BitbucketServiceError(
            BitbucketApiErrorCode.FORBIDDEN,
            'Access denied. You may not have permission to access this repository or pull request.',
            statusCode,
            error,
          );

        case 404:
          return new BitbucketServiceError(
            BitbucketApiErrorCode.NOT_FOUND,
            'Repository or pull request not found. Please check the URL and ensure it exists.',
            statusCode,
            error,
          );

        case 429:
          return new BitbucketServiceError(
            BitbucketApiErrorCode.RATE_LIMITED,
            'Rate limit exceeded. Please wait a moment before trying again.',
            statusCode,
            error,
          );

        default: {
          const message = errorData?.error?.message || `HTTP ${statusCode} error occurred`;
          return new BitbucketServiceError(
            BitbucketApiErrorCode.UNKNOWN_ERROR,
            message,
            statusCode,
            error,
          );
        }
      }
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return new BitbucketServiceError(
        BitbucketApiErrorCode.TIMEOUT,
        'Request timed out. The Bitbucket API may be slow or unavailable.',
        undefined,
        error,
      );
    } else if (error.request) {
      return new BitbucketServiceError(
        BitbucketApiErrorCode.NETWORK_ERROR,
        'Network error occurred. Please check your internet connection.',
        undefined,
        error,
      );
    } else {
      return new BitbucketServiceError(
        BitbucketApiErrorCode.UNKNOWN_ERROR,
        `Unexpected error: ${error.message}`,
        undefined,
        error,
      );
    }
  }

  /**
   * Fetches the diff for a specific pull request
   *
   * @param prInfo - Parsed PR information containing workspace, repo, and PR ID
   * @returns Promise that resolves to the PR diff data
   * @throws BitbucketServiceError for API failures
   *
   * @example
   * ```typescript
   * const client = new BitbucketApiClient('your-access-token');
   * const prInfo = { workspace: 'myworkspace', repo: 'myrepo', prId: '123' };
   * const diff = await client.fetchPRDiff(prInfo);
   * console.log(diff.diff);
   * ```
   */
  async fetchPRDiff(prInfo: ParsedPRInfo): Promise<BitbucketPRDiff> {
    const { workspace, repo, prId } = prInfo;
    const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${prId}/diff`;

    try {
      console.log(`🔍 [Bitbucket API] Fetching PR diff for ${workspace}/${repo}#${prId}`);

      const response: AxiosResponse<string> = await this.axiosInstance.get(endpoint, {
        headers: {
          Accept: 'text/plain', // Request diff as plain text
        },
      });

      const diffContent = response.data;
      const size = Buffer.byteLength(diffContent, 'utf8');

      console.log(`📄 [Bitbucket API] Diff fetched successfully, size: ${size} bytes`);

      return {
        diff: diffContent,
        size,
        truncated: false, // Bitbucket API doesn't indicate truncation in this endpoint
      };
    } catch (error) {
      if (error instanceof BitbucketServiceError) {
        throw error;
      }

      // This shouldn't happen due to interceptors, but handle just in case
      console.error('❌ [Bitbucket API] Unexpected error fetching diff:', error);
      throw new BitbucketServiceError(
        BitbucketApiErrorCode.UNKNOWN_ERROR,
        `Failed to fetch PR diff: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Fetches basic information about a pull request
   *
   * @param prInfo - Parsed PR information containing workspace, repo, and PR ID
   * @returns Promise that resolves to the PR information
   * @throws BitbucketServiceError for API failures
   *
   * @example
   * ```typescript
   * const client = new BitbucketApiClient('your-access-token');
   * const prInfo = { workspace: 'myworkspace', repo: 'myrepo', prId: '123' };
   * const info = await client.fetchPRInfo(prInfo);
   * console.log(info.title);
   * ```
   */
  async fetchPRInfo(prInfo: ParsedPRInfo): Promise<BitbucketPRInfo> {
    const { workspace, repo, prId } = prInfo;
    const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${prId}`;

    try {
      console.log(`🔍 [Bitbucket API] Fetching PR info for ${workspace}/${repo}#${prId}`);

      const response: AxiosResponse<BitbucketPRInfo> = await this.axiosInstance.get(endpoint);

      console.log(`📄 [Bitbucket API] PR info fetched successfully: "${response.data.title}"`);

      return response.data;
    } catch (error) {
      if (error instanceof BitbucketServiceError) {
        throw error;
      }

      console.error('❌ [Bitbucket API] Unexpected error fetching PR info:', error);
      throw new BitbucketServiceError(
        BitbucketApiErrorCode.UNKNOWN_ERROR,
        `Failed to fetch PR info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Tests the connection to Bitbucket API with the current token
   *
   * @returns Promise that resolves to true if connection is successful
   * @throws BitbucketServiceError for API failures
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔍 [Bitbucket API] Testing connection with current token');

      // Use the user endpoint to test authentication
      const response = await this.axiosInstance.get('/user');

      console.log(
        `✅ [Bitbucket API] Connection test successful for user: ${response.data.display_name}`,
      );
      return true;
    } catch (error) {
      console.error('❌ [Bitbucket API] Connection test failed:', error);

      if (error instanceof BitbucketServiceError) {
        throw error;
      }

      throw new BitbucketServiceError(
        BitbucketApiErrorCode.UNKNOWN_ERROR,
        `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}

/**
 * Gets a user-friendly error message from a BitbucketServiceError
 *
 * @param error - The error to format
 * @returns User-friendly error message
 */
export function formatBitbucketServiceError(error: BitbucketServiceError): string {
  switch (error.code) {
    case BitbucketApiErrorCode.UNAUTHORIZED:
      return 'Authentication failed. Please check your Bitbucket access token.';

    case BitbucketApiErrorCode.FORBIDDEN:
      return 'Access denied. You may not have permission to access this repository.';

    case BitbucketApiErrorCode.NOT_FOUND:
      return 'Repository or pull request not found. Please check the URL.';

    case BitbucketApiErrorCode.RATE_LIMITED:
      return 'Too many requests. Please wait a moment before trying again.';

    case BitbucketApiErrorCode.NETWORK_ERROR:
      return 'Network error. Please check your internet connection.';

    case BitbucketApiErrorCode.TIMEOUT:
      return 'Request timed out. Please try again.';

    case BitbucketApiErrorCode.INVALID_RESPONSE:
      return 'Invalid response from Bitbucket API. Please try again.';

    default:
      return error.message || 'An unexpected error occurred while communicating with Bitbucket.';
  }
}

/**
 * Factory function to create a Bitbucket API client
 *
 * @param accessToken - Bitbucket access token
 * @param config - Optional client configuration
 * @returns Configured BitbucketApiClient instance
 *
 * @example
 * ```typescript
 * const client = createBitbucketClient('your-access-token', {
 *   timeout: 45000,
 *   maxRetries: 5
 * });
 * ```
 */
export function createBitbucketClient(
  accessToken: string,
  config?: BitbucketClientConfig,
): BitbucketApiClient {
  return new BitbucketApiClient(accessToken, config);
}
