// frontend/src/common/oauth_storage.ts

import { 
  OAuthToken, 
  BitbucketUserInfo, 
  BITBUCKET_OAUTH_CONFIG 
} from './oauth_config';

/**
 * OAuth token storage interface for chrome.storage.local
 * Note: OAuth tokens are stored in local storage (not sync) for security
 */
export interface OAuthTokenStorage {
  access_token?: string;
  refresh_token?: string;
  token_expiry?: number; // Unix timestamp
  user_info?: BitbucketUserInfo;
  state?: string; // For CSRF protection during OAuth flow
}

/**
 * Save OAuth tokens to chrome.storage.local
 * @param token OAuth token response from Bitbucket
 * @param userInfo User information from Bitbucket API
 */
export async function saveOAuthTokens(
  token: OAuthToken, 
  userInfo?: BitbucketUserInfo
): Promise<void> {
  const tokenData: OAuthTokenStorage = {
    access_token: token.access_token,
    ...(token.refresh_token && { refresh_token: token.refresh_token }),
    ...(token.expires_in && { token_expiry: Date.now() + (token.expires_in * 1000) }),
    ...(userInfo && { user_info: userInfo })
  };

  return new Promise((resolve, reject) => {
    try {
      // @ts-ignore
      chrome.storage.local.set(tokenData, () => {
        // @ts-ignore
        if (chrome.runtime.lastError) {
          // @ts-ignore
          console.error('Error saving OAuth tokens:', chrome.runtime.lastError.message);
          // @ts-ignore
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        console.log('OAuth tokens saved successfully');
        resolve();
      });
    } catch (e) {
      console.error('Exception while saving OAuth tokens:', e);
      reject(e);
    }
  });
}

/**
 * Get OAuth tokens from chrome.storage.local
 * @returns Promise resolving to stored OAuth tokens or null if not found
 */
export async function getOAuthTokens(): Promise<OAuthTokenStorage | null> {
  return new Promise((resolve, reject) => {
    try {
      const keys = [
        BITBUCKET_OAUTH_CONFIG.STORAGE_KEYS.ACCESS_TOKEN,
        BITBUCKET_OAUTH_CONFIG.STORAGE_KEYS.REFRESH_TOKEN,
        BITBUCKET_OAUTH_CONFIG.STORAGE_KEYS.TOKEN_EXPIRY,
        BITBUCKET_OAUTH_CONFIG.STORAGE_KEYS.USER_INFO
      ];

      // @ts-ignore
      chrome.storage.local.get(keys, (result) => {
        // @ts-ignore
        if (chrome.runtime.lastError) {
          // @ts-ignore
          console.error('Error getting OAuth tokens:', chrome.runtime.lastError.message);
          // @ts-ignore
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!result.bitbucket_access_token) {
          resolve(null);
          return;
        }

        const tokenData: OAuthTokenStorage = {
          access_token: result.bitbucket_access_token,
          refresh_token: result.bitbucket_refresh_token,
          token_expiry: result.bitbucket_token_expiry,
          user_info: result.bitbucket_user_info
        };

        resolve(tokenData);
      });
    } catch (e) {
      console.error('Exception while getting OAuth tokens:', e);
      reject(e);
    }
  });
}

/**
 * Check if stored OAuth tokens are valid and not expired
 * @returns Promise resolving to true if tokens are valid
 */
export async function isOAuthTokenValid(): Promise<boolean> {
  try {
    const tokens = await getOAuthTokens();
    
    if (!tokens || !tokens.access_token) {
      return false;
    }

    // Check if token is expired (with 5 minute buffer)
    if (tokens.token_expiry) {
      const now = Date.now();
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
      if (now >= (tokens.token_expiry - bufferTime)) {
        console.log('OAuth token is expired or expires soon');
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking OAuth token validity:', error);
    return false;
  }
}

/**
 * Get valid access token, refreshing if necessary
 * Note: Refresh logic is handled by the background script
 * @returns Promise resolving to access token or null if unavailable
 */
export async function getValidAccessToken(): Promise<string | null> {
  try {
    const tokens = await getOAuthTokens();
    
    if (!tokens) {
      return null;
    }

    // If token is still valid, return it
    if (await isOAuthTokenValid()) {
      return tokens.access_token || null;
    }

    // Token is expired or invalid - background script should handle refresh
    console.log('Access token expired or invalid - refresh needed');
    return null;
  } catch (error) {
    console.error('Error getting valid access token:', error);
    return null;
  }
}

/**
 * Clear all OAuth tokens from storage
 */
export async function clearOAuthTokens(): Promise<void> {
  const keys = [
    BITBUCKET_OAUTH_CONFIG.STORAGE_KEYS.ACCESS_TOKEN,
    BITBUCKET_OAUTH_CONFIG.STORAGE_KEYS.REFRESH_TOKEN,
    BITBUCKET_OAUTH_CONFIG.STORAGE_KEYS.TOKEN_EXPIRY,
    BITBUCKET_OAUTH_CONFIG.STORAGE_KEYS.USER_INFO
  ];

  return new Promise((resolve, reject) => {
    try {
      // @ts-ignore
      chrome.storage.local.remove(keys, () => {
        // @ts-ignore
        if (chrome.runtime.lastError) {
          // @ts-ignore
          console.error('Error clearing OAuth tokens:', chrome.runtime.lastError.message);
          // @ts-ignore
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        console.log('OAuth tokens cleared successfully');
        resolve();
      });
    } catch (e) {
      console.error('Exception while clearing OAuth tokens:', e);
      reject(e);
    }
  });
}

/**
 * Save OAuth state parameter for CSRF protection
 * @param state Random state parameter
 */
export async function saveOAuthState(state: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // @ts-ignore
      chrome.storage.local.set({ oauth_state: state }, () => {
        // @ts-ignore
        if (chrome.runtime.lastError) {
          // @ts-ignore
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Get and clear OAuth state parameter
 * @returns Promise resolving to stored state or null
 */
export async function getAndClearOAuthState(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    try {
      // @ts-ignore
      chrome.storage.local.get(['oauth_state'], (result) => {
        // @ts-ignore
        if (chrome.runtime.lastError) {
          // @ts-ignore
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        const state = result.oauth_state || null;

        // Clear the state after reading
        // @ts-ignore
        chrome.storage.local.remove(['oauth_state'], () => {
          resolve(state);
        });
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Get stored user information
 * @returns Promise resolving to user info or null
 */
export async function getOAuthUserInfo(): Promise<BitbucketUserInfo | null> {
  try {
    const tokens = await getOAuthTokens();
    return tokens?.user_info || null;
  } catch (error) {
    console.error('Error getting OAuth user info:', error);
    return null;
  }
}
