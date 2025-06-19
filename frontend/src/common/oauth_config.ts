// frontend/src/common/oauth_config.ts

/**
 * OAuth 2.0 configuration constants for Bitbucket integration
 */

export const OAUTH_CONFIG = {
  CLIENT_ID: 'qb2UuSVYVgHrsfPkDb',
  CLIENT_SECRET: 'wCaPGqAaswYe6Z3QXfMsFJb632n67nQr',
  AUTH_URL: 'https://bitbucket.org/site/oauth2/authorize',
  TOKEN_URL: 'https://bitbucket.org/site/oauth2/access_token',
  REDIRECT_URL: `https://${chrome.runtime.id}.chromiumapp.org/callback`,
  SCOPES: ['pullrequest', 'repository', 'account'],
  TOKEN_STORAGE_KEY: 'bitbucket_auth'
};


/**
 * Bitbucket OAuth 2.0 endpoints and configuration
 */
export const BITBUCKET_OAUTH_CONFIG = {
  // Bitbucket OAuth endpoints
  AUTHORIZATION_ENDPOINT: 'https://bitbucket.org/site/oauth2/authorize',
  TOKEN_ENDPOINT: 'https://bitbucket.org/site/oauth2/access_token',
  
  // Required OAuth scopes for PR description generation
  REQUIRED_SCOPES: [
    'repositories', // Access to repositories
    'pullrequests'  // Access to pull requests
  ],
  
  // OAuth flow parameters
  RESPONSE_TYPE: 'code',
  GRANT_TYPE: 'authorization_code',
  
  // Token storage keys
  STORAGE_KEYS: {
    ACCESS_TOKEN: 'bitbucket_access_token',
    REFRESH_TOKEN: 'bitbucket_refresh_token',
    TOKEN_EXPIRY: 'bitbucket_token_expiry',
    USER_INFO: 'bitbucket_user_info'
  }
} as const;

/**
 * Backend API configuration for OAuth
 */
export const BACKEND_OAUTH_CONFIG = {
  // Development backend
  DEV_BASE_URL: 'http://localhost:3001',
  
  // Production backend (to be updated with actual production URL)
  PROD_BASE_URL: 'https://api.blamewriter.com',
  
  // OAuth endpoints on our backend
  ENDPOINTS: {
    OAUTH_INIT: '/api/auth/bitbucket',
    OAUTH_CALLBACK: '/api/auth/callback',
    OAUTH_REFRESH: '/api/auth/refresh',
    OAUTH_VALIDATE: '/api/auth/validate'
  }
} as const;

/**
 * Get the appropriate backend base URL based on environment
 */
export function getBackendBaseUrl(): string {
  // For now, always use development URL since we're in development
  // In the future, this can be configured per environment
  return BACKEND_OAUTH_CONFIG.DEV_BASE_URL;
  
  // TODO: Implement proper environment detection for production deployment
  // if (process.env.NODE_ENV === 'development') {
  //   return BACKEND_OAUTH_CONFIG.DEV_BASE_URL;
  // }
  // return BACKEND_OAUTH_CONFIG.PROD_BASE_URL;
}

/**
 * OAuth state parameter generation for CSRF protection
 */
export function generateOAuthState(): string {
  // Generate a random state parameter for CSRF protection
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Build OAuth authorization URL
 */
export function buildAuthorizationUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: BITBUCKET_OAUTH_CONFIG.RESPONSE_TYPE,
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: BITBUCKET_OAUTH_CONFIG.REQUIRED_SCOPES.join(' '),
    state: state
  });
  
  return `${BITBUCKET_OAUTH_CONFIG.AUTHORIZATION_ENDPOINT}?${params.toString()}`;
}

/**
 * OAuth token interface
 */
export interface OAuthToken {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

/**
 * OAuth user info interface
 */
export interface BitbucketUserInfo {
  uuid: string;
  username: string;
  display_name: string;
  account_id: string;
  avatar?: {
    href: string;
  };
}

/**
 * OAuth error types
 */
export enum OAuthErrorType {
  USER_DENIED = 'access_denied',
  INVALID_REQUEST = 'invalid_request',
  INVALID_CLIENT = 'invalid_client',
  INVALID_GRANT = 'invalid_grant',
  UNSUPPORTED_RESPONSE_TYPE = 'unsupported_response_type',
  INVALID_SCOPE = 'invalid_scope',
  NETWORK_ERROR = 'network_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * OAuth error interface
 */
export interface OAuthError {
  type: OAuthErrorType;
  message: string;
  description?: string;
}
