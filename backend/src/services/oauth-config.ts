/**
 * OAuth Configuration Management
 *
 * This module manages OAuth 2.0 configuration for Bitbucket authentication,
 * including client credentials, scopes, and redirect URLs.
 */

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  scopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
  apiBaseUrl: string;
  redirectUri: string;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface BitbucketUserInfo {
  uuid: string;
  username: string;
  display_name: string;
  account_id: string;
  nickname: string;
  links: {
    avatar: {
      href: string;
    };
  };
}

/**
 * Bitbucket OAuth 2.0 scopes required for the extension
 */
export const BITBUCKET_SCOPES = [
  'repository', // Access to public and private repositories
  'pullrequest', // Access to pull requests
  'account', // Access to user account information
];

/**
 * Bitbucket OAuth 2.0 URLs
 */
export const BITBUCKET_OAUTH_URLS = {
  AUTHORIZATION: 'https://bitbucket.org/site/oauth2/authorize',
  TOKEN: 'https://bitbucket.org/site/oauth2/access_token',
  API_BASE: 'https://api.bitbucket.org/2.0',
} as const;

/**
 * Get OAuth configuration from environment variables
 */
export function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.BITBUCKET_OAUTH_CLIENT_ID;
  const clientSecret = process.env.BITBUCKET_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.BITBUCKET_OAUTH_REDIRECT_URI;

  if (!clientId) {
    throw new Error('BITBUCKET_OAUTH_CLIENT_ID environment variable is required');
  }

  if (!clientSecret) {
    throw new Error('BITBUCKET_OAUTH_CLIENT_SECRET environment variable is required');
  }

  if (!redirectUri) {
    throw new Error('BITBUCKET_OAUTH_REDIRECT_URI environment variable is required');
  }

  return {
    clientId,
    clientSecret,
    scopes: BITBUCKET_SCOPES,
    authorizationUrl: BITBUCKET_OAUTH_URLS.AUTHORIZATION,
    tokenUrl: BITBUCKET_OAUTH_URLS.TOKEN,
    apiBaseUrl: BITBUCKET_OAUTH_URLS.API_BASE,
    redirectUri,
  };
}

/**
 * Build authorization URL for OAuth flow
 */
export function buildAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: BITBUCKET_SCOPES.join(' '),
    state: state,
  });

  return `${BITBUCKET_OAUTH_URLS.AUTHORIZATION}?${params.toString()}`;
}

/**
 * Validate OAuth configuration at startup
 */
export function validateOAuthConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const config = getOAuthConfig();

    // Validate redirect URI format
    try {
      const url = new URL(config.redirectUri);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('BITBUCKET_OAUTH_REDIRECT_URI must be HTTP or HTTPS');
      }
    } catch {
      errors.push('BITBUCKET_OAUTH_REDIRECT_URI must be a valid URL');
    }

    // Validate client ID format (Bitbucket uses UUIDs or similar)
    if (config.clientId.length < 10) {
      errors.push('BITBUCKET_OAUTH_CLIENT_ID appears to be invalid');
    }

    // Validate client secret length
    if (config.clientSecret.length < 20) {
      errors.push('BITBUCKET_OAUTH_CLIENT_SECRET appears to be invalid');
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown OAuth configuration error');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
