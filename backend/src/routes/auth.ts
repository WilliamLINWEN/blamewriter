import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { getOAuthConfig } from '../services/oauth-config';

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        displayName: string;
        accessToken: string;
      };
    }
  }
}

const router = express.Router();

// In-memory store for OAuth states and tokens (in production, use Redis or database)
const oauthStates = new Map<string, { timestamp: number; redirectUri?: string }>();
const tokenStore = new Map<string, { accessToken: string; refreshToken: string; expiresAt: number }>();

// Clean up expired states every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes
      oauthStates.delete(state);
    }
  }
}, 10 * 60 * 1000);

/**
 * OAuth initialization endpoint
 * GET /api/auth/bitbucket
 * Generates OAuth URL for Bitbucket authentication
 */
router.get('/bitbucket', (req, res) => {
  try {
    console.log('🔐 OAuth initialization request received');
    console.log('🔍 Request headers:', req.headers);
    console.log('🔍 Request origin:', req.get('origin'));
    console.log('🔍 Request user-agent:', req.get('user-agent'));
    
    const config = getOAuthConfig();
    
    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();
    
    // Store state with timestamp for validation
    oauthStates.set(state, { 
      timestamp,
      redirectUri: req.query.redirect_uri as string 
    });
    
    // Build OAuth authorization URL
    const authUrl = new URL('https://bitbucket.org/site/oauth2/authorize');
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('redirect_uri', config.redirectUri);

    console.log(`🔐 OAuth initialization: Generated auth URL for state: ${state}`);
    console.log(`OAuth URL: ${authUrl.toString()}`);
    
    res.json({
      success: true,
      authUrl: authUrl.toString(),
      state,
      expiresIn: 600 // 10 minutes
    });
    
  } catch (error) {
    console.error('❌ OAuth initialization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize OAuth flow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * OAuth callback endpoint
 * GET /api/auth/callback
 * Handles OAuth callback and exchanges authorization code for access token
 */
router.get('/callback', (req, res) => {
  const handleCallback = async () => {
    try {
      const { code, state, error: oauthError } = req.query;
      console.log('🔐 OAuth callback request received');
      console.log('🔍 Callback query parameters:', req.query);
      // Handle OAuth errors
      if (oauthError) {
        console.error('❌ OAuth error from Bitbucket:', oauthError);
        return res.status(400).json({
          success: false,
          error: 'OAuth authentication failed',
          details: oauthError
        });

      }
      
      // Validate required parameters
      if (!code || !state) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters',
          message: 'Authorization code and state are required'
        });
      }
      
      // Validate state parameter
      const stateData = oauthStates.get(state as string);
      if (!stateData) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired state parameter',
          message: 'OAuth flow validation failed'
        });
      }
      
      // Check state expiration (10 minutes)
      if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
        oauthStates.delete(state as string);
        return res.status(400).json({
          success: false,
          error: 'Expired OAuth flow',
          message: 'Please try again'
        });
      }
      
      // Clean up used state
      oauthStates.delete(state as string);
      
      const config = getOAuthConfig();
      
      // Exchange authorization code for access token
      const tokenResponse = await axios.post('https://bitbucket.org/site/oauth2/access_token', {
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });
      console.log('🔐 OAuth token exchange response:', tokenResponse.data);
      
      const { access_token, refresh_token, expires_in, token_type } = tokenResponse.data;
      
      if (!access_token) {
        throw new Error('No access token received from Bitbucket');
      }
      
      // Calculate expiration time
      const expiresAt = Date.now() + (expires_in * 1000);
      
      // Generate session ID for token storage
      const sessionId = crypto.randomBytes(32).toString('hex');
      
      // Store tokens securely (in production, use encrypted storage)
      tokenStore.set(sessionId, {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt
      });
      
      console.log(`✅ OAuth token exchange successful for session: ${sessionId}`);


      // https://ocnpjgndcjcnbfmceoliodbppkpecgio.chromiumapp.org/
      // Return success with session ID
      return res.json({
        tokens: tokenResponse.data,
        success: true,
        sessionId,
        tokenType: token_type || 'Bearer',
        expiresIn: expires_in,
        expiresAt,
        message: 'OAuth authentication successful'
      });
      
    } catch (error) {
      console.error('❌ OAuth callback error:', error);
      
      if (axios.isAxiosError(error)) {
        console.error('Bitbucket API error:', error.response?.data);
        return res.status(500).json({
          success: false,
          error: 'Token exchange failed',
          message: error.response?.data?.error_description || 'Failed to exchange authorization code'
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'OAuth callback processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
  
  handleCallback().catch(error => {
    console.error('❌ Unhandled callback error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to process OAuth callback'
      });
    }
  });
});

/**
 * Token refresh endpoint
 * POST /api/auth/refresh
 * Refreshes expired OAuth tokens
 */
router.post('/refresh', (req, res) => {
  const handleRefresh = async () => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Missing session ID',
          message: 'Session ID is required for token refresh'
        });
      }
      
      // Get stored tokens
      const tokenData = tokenStore.get(sessionId);
      if (!tokenData) {
        return res.status(401).json({
          success: false,
          error: 'Invalid session',
          message: 'Session not found or expired'
        });
      }
      
      const { refreshToken } = tokenData;
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'No refresh token available',
          message: 'Re-authentication required'
        });
      }
      
      const config = getOAuthConfig();
      
      // Refresh the access token
      const refreshResponse = await axios.post('https://bitbucket.org/site/oauth2/access_token', {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });
      
      const { access_token, refresh_token: newRefreshToken, expires_in } = refreshResponse.data;
      
      if (!access_token) {
        throw new Error('No access token received from refresh');
      }
      
      // Update stored tokens
      const expiresAt = Date.now() + (expires_in * 1000);
      tokenStore.set(sessionId, {
        accessToken: access_token,
        refreshToken: newRefreshToken || refreshToken, // Use new refresh token if provided
        expiresAt
      });
      
      console.log(`🔄 Token refresh successful for session: ${sessionId}`);
      
      return res.json({
        success: true,
        expiresIn: expires_in,
        expiresAt,
        message: 'Token refreshed successfully'
      });
      
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      
      if (axios.isAxiosError(error)) {
        console.error('Bitbucket refresh error:', error.response?.data);
        
        // If refresh token is invalid, clear the session
        const { sessionId } = req.body;
        if (sessionId && error.response?.status === 400) {
          tokenStore.delete(sessionId);
        }
        
        return res.status(401).json({
          success: false,
          error: 'Token refresh failed',
          message: error.response?.data?.error_description || 'Refresh token is invalid or expired',
          requiresReauth: true
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Token refresh processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
  
  handleRefresh().catch(error => {
    console.error('❌ Unhandled refresh error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to process token refresh'
      });
    }
  });
});

/**
 * Token validation middleware
 * Validates OAuth tokens for protected routes
 */
export const validateOAuthToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const handleValidation = async (): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const sessionId = req.headers['x-session-id'] as string;
      
      // Check for Bearer token or session ID
      let accessToken: string | undefined;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
      } else if (sessionId) {
        const tokenData = tokenStore.get(sessionId);
        if (tokenData && tokenData.expiresAt > Date.now()) {
          accessToken = tokenData.accessToken;
        }
      }
      
      if (!accessToken) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Valid OAuth token or session required'
        });
        return;
      }
      
      // Validate token with Bitbucket API
      try {
        const userResponse = await axios.get('https://api.bitbucket.org/2.0/user', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        });
        
        // Add user info to request for use in protected routes
        req.user = {
          id: userResponse.data.account_id,
          username: userResponse.data.username,
          displayName: userResponse.data.display_name,
          accessToken
        };
        
        next();
        
      } catch (apiError) {
        if (axios.isAxiosError(apiError) && apiError.response?.status === 401) {
          res.status(401).json({
            success: false,
            error: 'Invalid or expired token',
            message: 'Token validation failed',
            requiresReauth: true
          });
          return;
        }
        throw apiError;
      }
      
    } catch (error) {
      console.error('❌ Token validation error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Token validation failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      return;
    }
  };
  
  handleValidation().catch(error => {
    console.error('❌ Unhandled validation error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to validate OAuth token'
      });
    }
  });
};

export default router;
