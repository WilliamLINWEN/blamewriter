import { BITBUCKET_OAUTH_CONFIG, OAUTH_CONFIG } from '../common/oauth_config';
import { generateRandomString, generateCodeChallenge } from '../utils/auth_utils';

export class BitbucketAuthManager {
  async initiateOAuthFlow(): Promise<string | null> {
    try {
      const state = generateRandomString(32);
      const codeVerifier = generateRandomString(64);
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // 保存狀態和驗證碼
      await chrome.storage.local.set({
        oauth_state: state,
        code_verifier: codeVerifier,
        auth_timestamp: Date.now(),
      });

      // 構建授權 URL
      const authUrl = new URL(BITBUCKET_OAUTH_CONFIG.AUTHORIZATION_ENDPOINT);
      authUrl.searchParams.append('client_id', OAUTH_CONFIG.CLIENT_ID);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', OAUTH_CONFIG.REDIRECT_URL);
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('code_challenge', codeChallenge);
      authUrl.searchParams.append('code_challenge_method', 'S256');
      authUrl.searchParams.append('scope', BITBUCKET_OAUTH_CONFIG.REQUIRED_SCOPES.join(' '));

      return new Promise(resolve => {
        chrome.identity.launchWebAuthFlow(
          { url: authUrl.toString(), interactive: true },
          async redirectUrl => {
            if (chrome.runtime.lastError) {
              console.error('Auth flow error:', chrome.runtime.lastError.message);
              resolve(null);
              return;
            }

            const token = await this.handleAuthRedirect(redirectUrl ?? null);
            resolve(token);
          },
        );
      });
    } catch (error) {
      console.error('OAuth initialization error:', error);
      return null;
    }
  }

  private async handleAuthRedirect(redirectUrl: string | null): Promise<string | null> {
    if (!redirectUrl) {
      return null;
    }

    try {
      const url = new URL(redirectUrl);
      const params = new URLSearchParams(url.search);
      const authCode = params.get('code');
      const returnedState = params.get('state');

      if (!authCode) {
        throw new Error('No authorization code received');
      }

      // 獲取存儲的狀態和驗證碼
      const { oauth_state, code_verifier } = await chrome.storage.local.get([
        'oauth_state',
        'code_verifier',
      ]);

      // 驗證狀態
      if (returnedState !== oauth_state) {
        throw new Error('State mismatch - possible CSRF attack');
      }

      // 交換 token
      const tokenData = await this.exchangeCodeForToken(authCode, code_verifier);
      if (!tokenData?.access_token) {
        throw new Error('Failed to obtain access token');
      }

      // 保存 token
      await this.saveTokenData(tokenData);
      return tokenData.access_token;
    } catch (error) {
      console.error('Auth redirect handling error:', error);
      return null;
    }
  }

  private async exchangeCodeForToken(code: string, codeVerifier: string): Promise<any> {
    const response = await fetch(OAUTH_CONFIG.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${OAUTH_CONFIG.CLIENT_ID}:${OAUTH_CONFIG.CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: OAUTH_CONFIG.CLIENT_ID,
        code_verifier: codeVerifier,
        redirect_uri: OAUTH_CONFIG.REDIRECT_URL,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    return response.json();
  }

  private async saveTokenData(tokenData: any): Promise<void> {
    await chrome.storage.local.set({
      [OAUTH_CONFIG.TOKEN_STORAGE_KEY]: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Date.now() + tokenData.expires_in * 1000,
      },
    });
  }

  async refreshToken(): Promise<string | null> {
    try {
      const data = await chrome.storage.local.get(OAUTH_CONFIG.TOKEN_STORAGE_KEY);
      const tokenData = data[OAUTH_CONFIG.TOKEN_STORAGE_KEY];

      if (!tokenData?.refresh_token) {
        return null;
      }

      const response = await fetch(OAUTH_CONFIG.TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokenData.refresh_token,
          client_id: OAUTH_CONFIG.CLIENT_ID,
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const newTokenData = await response.json();
      await this.saveTokenData(newTokenData);
      return newTokenData.access_token;
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }
}
