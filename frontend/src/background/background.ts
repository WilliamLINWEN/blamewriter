// Background script for Bitbucket PR Helper extension
// Phase 3 implementation - Service Worker with OAuth support

import { getBackendBaseUrl, BACKEND_OAUTH_CONFIG } from '../common/oauth_config';
import {
  saveOAuthTokens,
  getOAuthTokens,
  isOAuthTokenValid,
  clearOAuthTokens,
  saveOAuthState,
  getAndClearOAuthState,
} from '../common/oauth_storage';

interface GenerateRequest {
  action: 'generate';
  prUrl: string;
  token?: string; // Optional - OAuth will be used for authentication
  templateContent: string;
  llmConfig: {
    providerId: string;
    modelId: string;
    customEndpoint: string | null;
  };
}

interface GenerateResponse {
  description?: string;
  error?: string;
}

interface ApiRequestBody {
  prUrl: string;
  bitbucketToken: string;
  template: {
    content: string;
  };
  llmConfig: {
    providerId: string;
    modelId: string;
    customEndpoint: string | null;
  };
}

interface ApiResponseBody {
  success: boolean;
  data?: {
    description: string;
    metadata: any;
    diffStats: any;
    template: any;
    llmProvider: any;
  };
  error?: {
    code: string;
    message: string;
    details: string;
    category: string;
    retryable: boolean;
    suggestedAction: string;
  };
}

// OAuth-related interfaces
interface OAuthRequest {
  action: 'oauth_authenticate' | 'oauth_get_status' | 'oauth_logout';
}

interface OAuthResponse {
  success: boolean;
  authenticated?: boolean;
  userInfo?: any;
  error?: string;
}

interface AuthenticateRequest {
  action: 'authenticate';
}

interface AuthenticateResponse {
  success: boolean;
  userInfo?: any;
  error?: string;
}

class BackgroundService {
  private readonly API_BASE_URL = 'http://localhost:3001';
  private readonly GENERATE_ENDPOINT = '/api/v2/generate';
  private readonly REQUEST_TIMEOUT = 60000; // 60 seconds

  constructor() {
    this.setupMessageListener();
    this.logStartup();
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener(
      (
        request: GenerateRequest | OAuthRequest | AuthenticateRequest,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: GenerateResponse | OAuthResponse | AuthenticateResponse) => void,
      ) => {
        this.handleMessage(request, sender, sendResponse);
        // Return true to indicate we will send a response asynchronously
        return true;
      },
    );
  }

  private logStartup(): void {
    console.log('Background script loaded and ready');
    console.log('API Base URL:', this.API_BASE_URL);
    console.log('Generate Endpoint:', this.GENERATE_ENDPOINT);
  }

  private async handleMessage(
    request: GenerateRequest | OAuthRequest | AuthenticateRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: GenerateResponse | OAuthResponse | AuthenticateResponse) => void,
  ): Promise<void> {
    console.log('Received message:', request);

    try {
      if (request.action === 'generate') {
        const response = await this.handleGenerateRequest(request as GenerateRequest);
        console.log('Sending response:', response);
        sendResponse(response);
      } else if (request.action === 'oauth_authenticate') {
        const response = await this.handleOAuthAuthenticate();
        sendResponse(response);
      } else if (request.action === 'oauth_get_status') {
        const response = await this.handleOAuthGetStatus();
        sendResponse(response);
      } else if (request.action === 'oauth_logout') {
        const response = await this.handleOAuthLogout();
        sendResponse(response);
      } else if (request.action === 'authenticate') {
        const response = await this.handleAuthenticate();
        sendResponse(response);
      } else {
        console.warn('Unknown action:', request.action);
        sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: 'Internal error processing request' });
    }
  }

  private async handleGenerateRequest(request: GenerateRequest): Promise<GenerateResponse> {
    // Validate request parameters
    const validationError = this.validateGenerateRequest(request);
    if (validationError) {
      return { error: validationError };
    }

    try {
      // Get valid OAuth access token
      const accessToken = await this.getValidAccessTokenWithRefresh();
      if (!accessToken) {
        return {
          error: 'Authentication required. Please authenticate with Bitbucket first.',
        };
      }

      // Make HTTP request to backend API using OAuth token
      const apiResponse = await this.callBackendAPI(
        request.prUrl,
        accessToken,
        request.templateContent,
        request.llmConfig,
      );

      return this.processApiResponse(apiResponse);
    } catch (error) {
      console.error('Error in generate request:', error);
      return this.handleRequestError(error);
    }
  }

  private validateGenerateRequest(request: GenerateRequest): string | null {
    if (!request.prUrl) {
      return 'URL is required';
    }

    // Validate URL format
    const urlPattern = /^https:\/\/bitbucket\.org\/[^/]+\/[^/]+\/pull-requests\/\d+/;
    if (!urlPattern.test(request.prUrl)) {
      return 'Invalid Bitbucket PR URL format';
    }

    // Note: OAuth token validation is handled separately in handleGenerateRequest

    return null;
  }

  private async callBackendAPI(
    prUrl: string,
    bitbucketToken: string,
    templateContent: string,
    llmConfig: {
      providerId: string;
      modelId: string;
      customEndpoint: string | null;
    },
  ): Promise<Response> {
    const requestBody: ApiRequestBody = {
      prUrl: prUrl,
      bitbucketToken: bitbucketToken,
      template: {
        content: templateContent,
      },
      llmConfig: llmConfig,
    };

    console.log('Making API request to:', `${this.API_BASE_URL}${this.GENERATE_ENDPOINT}`);
    console.log('Request body:', { prUrl: requestBody.prUrl, bitbucketToken: '[REDACTED]' });

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

    try {
      const response = await fetch(`${this.API_BASE_URL}${this.GENERATE_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('API response status:', response.status);

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async processApiResponse(response: Response): Promise<GenerateResponse> {
    // Handle different HTTP status codes
    if (!response.ok) {
      return this.handleHttpError(response);
    }

    try {
      const data: ApiResponseBody = await response.json();
      console.log('API response data:', data);

      // Handle new v2 API format
      if (data.success === false && data.error) {
        return { error: data.error.message };
      }

      if (data.success === true && data.data?.description) {
        return { description: data.data.description };
      }

      return { error: 'Invalid response format from server' };
    } catch (error) {
      console.error('Error parsing API response:', error);
      return { error: 'Failed to parse server response' };
    }
  }

  private async handleHttpError(response: Response): Promise<GenerateResponse> {
    console.error('HTTP error:', response.status, response.statusText);

    try {
      // Try to get error details from response body
      const errorData = await response.json();
      console.log('Backend error response:', errorData);

      // Check if backend provides specific error message
      if (errorData && typeof errorData === 'object') {
        // Handle v2 API error format
        if (errorData.success === false && errorData.error) {
          return {
            error:
              errorData.error.message || errorData.error.details || 'Unknown error from server',
          };
        }

        // Handle different error response formats (backward compatibility)
        if (errorData.error && typeof errorData.error === 'string') {
          return { error: errorData.error };
        }

        if (errorData.message && typeof errorData.message === 'string') {
          return { error: errorData.message };
        }

        // If error is an object, try to extract message
        if (errorData.error && typeof errorData.error === 'object') {
          if (errorData.error.message) {
            return { error: errorData.error.message };
          }
          if (errorData.error.details) {
            return { error: errorData.error.details };
          }
        }
      }
    } catch (e) {
      // Ignore JSON parsing errors for error responses
      console.warn('Could not parse error response as JSON:', e);
    }

    // Return appropriate error message based on status code
    switch (response.status) {
      case 400:
        return { error: 'Invalid request. Please check your input and try again.' };
      case 401:
        return { error: 'Authentication failed. Please check your Bitbucket token.' };
      case 403:
        return { error: 'Access denied. Please check your permissions.' };
      case 404:
        return { error: 'Pull request not found. Please check the URL.' };
      case 429:
        return { error: 'Rate limit exceeded. Please try again later.' };
      case 500:
        return { error: 'Server error. Please try again later.' };
      case 503:
        return { error: 'Service temporarily unavailable. Please try again later.' };
      default:
        return { error: `Request failed with status ${response.status}` };
    }
  }

  private handleRequestError(error: unknown): GenerateResponse {
    if (error instanceof Error) {
      console.error('Request error:', error.message);

      // Handle specific error types
      if (error.name === 'AbortError') {
        return { error: 'Request timed out. Please try again.' };
      }

      if (error.message.includes('fetch')) {
        return {
          error:
            'Network error. Please check your connection and ensure the backend server is running.',
        };
      }

      if (error.message.includes('CORS')) {
        return { error: 'Cross-origin request blocked. Please check the server configuration.' };
      }

      // Check for connection errors
      if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION')) {
        return {
          error:
            'Cannot connect to server. Please ensure the backend is running on http://localhost:3001',
        };
      }

      return { error: `Request failed: ${error.message}` };
    }

    console.error('Unknown error:', error);
    return { error: 'An unexpected error occurred' };
  }

  // ========================
  // OAuth Authentication Methods
  // ========================

  /**
   * Handle OAuth authentication request
   */
  private async handleOAuthAuthenticate(): Promise<OAuthResponse> {
    try {
      console.log('🔐 Starting OAuth authentication flow...');

      // Check if already authenticated
      const isValid = await isOAuthTokenValid();
      if (isValid) {
        const userInfo = await getOAuthTokens();
        return {
          success: true,
          authenticated: true,
          userInfo: userInfo?.user_info,
        };
      }

      // Start OAuth flow
      const authResult = await this.initiateOAuthFlow();

      if (authResult.success) {
        return {
          success: true,
          authenticated: true,
          userInfo: authResult.userInfo,
        };
      } else {
        return {
          success: false,
          authenticated: false,
          error: authResult.error || 'Authentication failed',
        };
      }
    } catch (error) {
      console.error('OAuth authentication error:', error);
      return {
        success: false,
        authenticated: false,
        error: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Handle OAuth status check request
   */
  private async handleOAuthGetStatus(): Promise<OAuthResponse> {
    try {
      const isValid = await isOAuthTokenValid();
      const userInfo = isValid ? await getOAuthTokens() : null;

      return {
        success: true,
        authenticated: isValid,
        userInfo: userInfo?.user_info,
      };
    } catch (error) {
      console.error('Error checking OAuth status:', error);
      return {
        success: false,
        authenticated: false,
        error: `Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Handle OAuth logout request
   */
  private async handleOAuthLogout(): Promise<OAuthResponse> {
    try {
      await clearOAuthTokens();
      console.log('🚪 User logged out successfully');

      return {
        success: true,
        authenticated: false,
      };
    } catch (error) {
      console.error('Error during logout:', error);
      return {
        success: false,
        authenticated: true,
        error: `Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Handle general authenticate request (alias for OAuth authenticate)
   */
  private async handleAuthenticate(): Promise<AuthenticateResponse> {
    const oauthResponse = await this.handleOAuthAuthenticate();
    return {
      success: oauthResponse.success,
      userInfo: oauthResponse.userInfo,
      ...(oauthResponse.error && { error: oauthResponse.error }),
    };
  }

  /**
   * Initiate OAuth flow using chrome.identity.launchWebAuthFlow
   */
  private async initiateOAuthFlow(): Promise<{ success: boolean; userInfo?: any; error?: string }> {
    try {
      // Get OAuth authorization URL from backend
      const oauthResult = await this.getOAuthAuthUrlFromBackend();
      if (!oauthResult.success || !oauthResult.authUrl || !oauthResult.state) {
        throw new Error(oauthResult.error || 'Failed to get OAuth authorization URL');
      }

      // Save the state for later validation
      await saveOAuthState(oauthResult.state);
      console.info('oauthResult.authUrl: ', oauthResult.authUrl);
      console.log('🌐 Launching OAuth web auth flow...');

      // Launch OAuth flow
      return new Promise(resolve => {
        chrome.identity.launchWebAuthFlow(
          {
            url: oauthResult.authUrl!,
            interactive: true,
          },
          async responseUrl => {
            try {
              console.info('🔗 OAuth response URL:', responseUrl);
              if (chrome.runtime.lastError) {
                console.error('OAuth flow error:', chrome.runtime.lastError);
                resolve({
                  success: false,
                  error: chrome.runtime.lastError.message || 'OAuth flow failed',
                });
                return;
              }

              if (!responseUrl) {
                resolve({
                  success: false,
                  error: 'OAuth flow was cancelled or failed',
                });
                return;
              }

              console.log('✅ OAuth callback received');

              // Process the callback URL
              const result = await this.processOAuthCallback(responseUrl);
              resolve(result);
            } catch (error) {
              console.error('Error processing OAuth callback:', error);
              resolve({
                success: false,
                error: `Callback processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              });
            }
          },
        );
      });
    } catch (error) {
      console.error('Error initiating OAuth flow:', error);
      return {
        success: false,
        error: `OAuth initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get OAuth authorization URL from backend
   */
  private async getOAuthAuthUrlFromBackend(): Promise<{
    success: boolean;
    authUrl?: string;
    state?: string;
    error?: string;
  }> {
    try {
      const backendUrl = getBackendBaseUrl();
      const configUrl = `${backendUrl}${BACKEND_OAUTH_CONFIG.ENDPOINTS.OAUTH_INIT}`;

      console.log('📡 Getting OAuth auth URL from backend:', configUrl);
      console.log('🔧 Backend base URL:', backendUrl);
      console.log('🔧 OAuth init endpoint:', BACKEND_OAUTH_CONFIG.ENDPOINTS.OAUTH_INIT);

      // First test basic connectivity
      console.log('🧪 Testing basic connectivity...');
      try {
        const healthResponse = await fetch(`${backendUrl}/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        console.log('🧪 Health check response status:', healthResponse.status);
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          console.log('🧪 Health check data:', healthData);
        }
      } catch (healthError) {
        console.error('🧪 Health check failed:', healthError);
      }

      console.log('📡 Making OAuth config request...');
      const response = await fetch(configUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', response.headers);

      if (!response.ok) {
        throw new Error(`Backend config request failed: ${response.status} ${response.statusText}`);
      }

      const config = await response.json();
      console.log('📡 Backend response:', config);

      if (!config.success || !config.authUrl || !config.state) {
        throw new Error('Invalid response from backend OAuth init endpoint');
      }
      return {
        success: true,
        authUrl: config.authUrl,
        state: config.state,
      };
    } catch (error) {
      console.error('❌ Error getting OAuth config from backend:', error);
      console.error('❌ Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
      });
      return {
        success: false,
        error: `Failed to get OAuth configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Process OAuth callback URL and exchange code for tokens
   */
  private async processOAuthCallback(responseUrl: string): Promise<{
    success: boolean;
    userInfo?: any;
    error?: string;
  }> {
    try {
      console.log('🔄 Processing OAuth callback...');

      // Parse callback URL
      const url = new URL(responseUrl);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      // Check for OAuth errors
      if (error) {
        const errorDescription =
          url.searchParams.get('error_description') || 'OAuth authorization failed';
        console.error('OAuth error:', error, errorDescription);
        return {
          success: false,
          error: `OAuth error: ${error} - ${errorDescription}`,
        };
      }

      if (!code) {
        return {
          success: false,
          error: 'No authorization code received from OAuth provider',
        };
      }

      // Validate state parameter
      const storedState = await getAndClearOAuthState();
      if (!storedState || storedState !== state) {
        console.error('OAuth state mismatch:', { stored: storedState, received: state });
        return {
          success: false,
          error: 'OAuth state validation failed - possible CSRF attack',
        };
      }

      // Exchange code for tokens via backend
      const tokenResult = await this.exchangeCodeForTokens(code, state);

      return tokenResult;
    } catch (error) {
      console.error('Error processing OAuth callback:', error);
      return {
        success: false,
        error: `Callback processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Exchange authorization code for access tokens via backend
   */
  private async exchangeCodeForTokens(
    code: string,
    state: string,
  ): Promise<{
    success: boolean;
    userInfo?: any;
    error?: string;
  }> {
    try {
      const backendUrl = getBackendBaseUrl();
      // const callbackUrl = OAUTH_CONFIG.REDIRECT_URL;
      const callbackUrl = `${backendUrl}${BACKEND_OAUTH_CONFIG.ENDPOINTS.OAUTH_CALLBACK}`;

      console.log('🔑 Exchanging code for tokens...');

      // const response = await fetch(callbackUrl, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({ code, state })
      // });
      const params = new URLSearchParams({ code, state }).toString();
      const response = await fetch(`${callbackUrl}?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Token exchange failed: ${response.status} ${response.statusText}`,
        );
      }

      const tokenData = await response.json();

      // Save tokens to local storage
      await saveOAuthTokens(tokenData.tokens, tokenData.userInfo);

      console.log('✅ OAuth tokens saved successfully');

      return {
        success: true,
        userInfo: tokenData.userInfo,
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      return {
        success: false,
        error: `Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Refresh expired OAuth tokens
   */
  private async refreshOAuthTokens(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔄 Refreshing OAuth tokens...');

      const tokens = await getOAuthTokens();
      if (!tokens || !tokens.refresh_token) {
        return {
          success: false,
          error: 'No refresh token available',
        };
      }

      const backendUrl = getBackendBaseUrl();
      const refreshUrl = `${backendUrl}${BACKEND_OAUTH_CONFIG.ENDPOINTS.OAUTH_REFRESH}`;

      const response = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: tokens.refresh_token,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Token refresh failed: ${response.status} ${response.statusText}`,
        );
      }

      const tokenData = await response.json();

      // Save new tokens
      await saveOAuthTokens(tokenData.tokens, tokenData.userInfo);

      console.log('✅ OAuth tokens refreshed successfully');

      return { success: true };
    } catch (error) {
      console.error('Error refreshing OAuth tokens:', error);

      // If refresh fails, clear tokens to force re-authentication
      await clearOAuthTokens();

      return {
        success: false,
        error: `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  private async getValidAccessTokenWithRefresh(): Promise<string | null> {
    try {
      // First check if current token is valid
      const isValid = await isOAuthTokenValid();
      if (isValid) {
        const tokens = await getOAuthTokens();
        return tokens?.access_token || null;
      }

      // Try to refresh the token
      const refreshResult = await this.refreshOAuthTokens();
      if (refreshResult.success) {
        const tokens = await getOAuthTokens();
        return tokens?.access_token || null;
      }

      // If refresh failed, return null to trigger re-authentication
      console.log('Token refresh failed, user needs to re-authenticate');
      return null;
    } catch (error) {
      console.error('Error getting valid access token:', error);
      return null;
    }
  }

  /**
   * Validate stored OAuth tokens
   */
  private async validateStoredTokens(): Promise<{
    valid: boolean;
    needsRefresh: boolean;
    error?: string;
  }> {
    try {
      const tokens = await getOAuthTokens();

      if (!tokens || !tokens.access_token) {
        return { valid: false, needsRefresh: false, error: 'No tokens stored' };
      }

      // Check if token is expired
      if (tokens.token_expiry) {
        const now = Date.now();
        const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

        if (now >= tokens.token_expiry - bufferTime) {
          return {
            valid: false,
            needsRefresh: !!tokens.refresh_token,
            error: 'Token expired',
          };
        }
      }

      // Optional: Validate token with backend
      const backendUrl = getBackendBaseUrl();
      const validateUrl = `${backendUrl}${BACKEND_OAUTH_CONFIG.ENDPOINTS.OAUTH_VALIDATE}`;

      try {
        const response = await fetch(validateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.access_token}`,
          },
        });

        if (response.ok) {
          return { valid: true, needsRefresh: false };
        } else if (response.status === 401) {
          return {
            valid: false,
            needsRefresh: !!tokens.refresh_token,
            error: 'Token validation failed',
          };
        } else {
          // If validation endpoint is unavailable, assume token is valid
          console.warn('Token validation endpoint unavailable, assuming valid');
          return { valid: true, needsRefresh: false };
        }
      } catch (validationError) {
        // If validation fails due to network issues, assume token is valid
        console.warn(
          'Token validation failed due to network issues, assuming valid:',
          validationError,
        );
        return { valid: true, needsRefresh: false };
      }
    } catch (error) {
      console.error('Error validating stored tokens:', error);
      return {
        valid: false,
        needsRefresh: false,
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Initialize the background service
console.log('Initializing background service...');
new BackgroundService();

// Export for testing purposes
export { BackgroundService };
