// Background script for Bitbucket PR Helper extension
// Phase 1 MVP implementation - Service Worker

interface GenerateRequest {
  action: 'generate';
  prUrl: string;
  token: string;
  templateContent: string;
  llmConfig: {
    providerId: string;
    modelId: string;
    apiKey: string | null;
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
    apiKey: string | null;
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
        request: GenerateRequest,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: GenerateResponse) => void,
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
    request: GenerateRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: GenerateResponse) => void,
  ): Promise<void> {
    console.log('Received message:', request);

    try {
      if (request.action === 'generate') {
        const response = await this.handleGenerateRequest(request);
        console.log('Sending response:', response);
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
      // Make HTTP request to backend API
      const apiResponse = await this.callBackendAPI(request.prUrl, request.token, request.templateContent, request.llmConfig);
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

    if (!request.token) {
      return 'Bitbucket token is required';
    }

    // Validate URL format
    const urlPattern = /^https:\/\/bitbucket\.org\/[^\/]+\/[^\/]+\/pull-requests\/\d+/;
    if (!urlPattern.test(request.prUrl)) {
      return 'Invalid Bitbucket PR URL format';
    }

    // Basic token validation
    if (request.token.length < 20) {
    // if (request.token.length < 20 || !/^[a-zA-Z0-9_-]+$/.test(request.token)) {
      return 'Invalid token format';
    }

    return null;
  }

  private async callBackendAPI(
    prUrl: string, 
    bitbucketToken: string, 
    templateContent: string, 
    llmConfig: {
      providerId: string;
      modelId: string;
      apiKey: string | null;
      customEndpoint: string | null;
    }
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
          return { error: errorData.error.message || errorData.error.details || 'Unknown error from server' };
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
}

// Initialize the background service
console.log('Initializing background service...');
new BackgroundService();

// Export for testing purposes
export { BackgroundService };
