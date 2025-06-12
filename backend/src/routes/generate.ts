import express from 'express';

/**
 * Request interface for the generate MVP endpoint
 */
export interface GenerateMVPRequest {
  prUrl: string;
  bitbucketToken: string;
}

/**
 * Response interface for successful generation
 */
export interface GenerateMVPResponse {
  success: true;
  data: {
    description: string;
    prUrl: string;
    generatedAt: string;
  };
}

/**
 * Response interface for error cases
 */
export interface GenerateMVPErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
  timestamp: string;
}

/**
 * Union type for all possible responses
 */
export type GenerateMVPApiResponse = GenerateMVPResponse | GenerateMVPErrorResponse;

/**
 * Validation error details
 */
interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validates that a string is a valid Bitbucket PR URL
 */
function isValidBitbucketPrUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // Check if it's a Bitbucket domain
    if (!urlObj.hostname.includes('bitbucket.org')) {
      return false;
    }
    
    // Check if the path matches PR URL pattern: /workspace/repo/pull-requests/id
    const pathPattern = /^\/[^\/]+\/[^\/]+\/pull-requests\/\d+/;
    return pathPattern.test(urlObj.pathname);
  } catch {
    return false;
  }
}

/**
 * Validates the request body for the generate MVP endpoint
 */
function validateGenerateRequest(body: any): { isValid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  // Check if prUrl is present and valid
  if (!body.prUrl) {
    errors.push({
      field: 'prUrl',
      message: 'PR URL is required'
    });
  } else if (typeof body.prUrl !== 'string') {
    errors.push({
      field: 'prUrl',
      message: 'PR URL must be a string'
    });
  } else if (body.prUrl.trim() === '') {
    errors.push({
      field: 'prUrl',
      message: 'PR URL cannot be empty'
    });
  } else if (!isValidBitbucketPrUrl(body.prUrl.trim())) {
    errors.push({
      field: 'prUrl',
      message: 'Invalid Bitbucket PR URL format. Expected format: https://bitbucket.org/workspace/repo/pull-requests/id'
    });
  }
  
  // Check if bitbucketToken is present and valid
  if (!body.bitbucketToken) {
    errors.push({
      field: 'bitbucketToken',
      message: 'Bitbucket token is required'
    });
  } else if (typeof body.bitbucketToken !== 'string') {
    errors.push({
      field: 'bitbucketToken',
      message: 'Bitbucket token must be a string'
    });
  } else if (body.bitbucketToken.trim() === '') {
    errors.push({
      field: 'bitbucketToken',
      message: 'Bitbucket token cannot be empty'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Creates an error response with proper formatting
 */
function createErrorResponse(
  code: string,
  message: string,
  details?: string
): GenerateMVPErrorResponse {
  const errorObj: GenerateMVPErrorResponse['error'] = {
    code,
    message
  };
  
  if (details !== undefined) {
    errorObj.details = details;
  }
  
  return {
    success: false,
    error: errorObj,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates a success response with proper formatting
 */
function createSuccessResponse(
  description: string,
  prUrl: string
): GenerateMVPResponse {
  return {
    success: true,
    data: {
      description,
      prUrl,
      generatedAt: new Date().toISOString()
    }
  };
}

/**
 * Main handler for the generate MVP endpoint
 */
async function handleGenerateMVP(
  req: express.Request,
  res: express.Response
): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Log the incoming request
    console.log(`🚀 [${new Date().toISOString()}] POST /api/v1/generate-mvp - Request received`);
    console.log('Request body keys:', Object.keys(req.body));
    
    // Validate request body
    const validation = validateGenerateRequest(req.body);
    
    if (!validation.isValid) {
      console.log('❌ Request validation failed:', validation.errors);
      
      const errorDetails = validation.errors
        .map(err => `${err.field}: ${err.message}`)
        .join('; ');
      
      const errorResponse = createErrorResponse(
        'VALIDATION_ERROR',
        'Request validation failed',
        errorDetails
      );
      
      res.status(400).json(errorResponse);
      return;
    }
    
    // Extract validated data
    const { prUrl, bitbucketToken } = req.body as GenerateMVPRequest;
    
    console.log(`✅ Request validation passed for PR: ${prUrl}`);
    console.log(`🔑 Token provided: ${bitbucketToken.substring(0, 8)}...`);
    
    // TODO: Implement Bitbucket API integration
    // TODO: Implement OpenAI API integration
    // For now, return a placeholder response to complete the endpoint structure
    
    const mockDescription = `# PR Description (Generated)

This is a placeholder description that will be replaced with actual OpenAI-generated content based on the PR diff.

**PR URL:** ${prUrl}
**Generated at:** ${new Date().toISOString()}

## Changes Summary
- Placeholder for actual diff analysis
- Will be implemented in subsequent tasks

## Impact
- Placeholder for impact analysis
- Will be generated based on actual code changes`;

    const successResponse = createSuccessResponse(mockDescription, prUrl);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [${new Date().toISOString()}] Request completed successfully in ${duration}ms`);
    
    res.status(200).json(successResponse);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [${new Date().toISOString()}] Request failed after ${duration}ms:`, error);
    
    const errorResponse = createErrorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred while processing the request',
      error instanceof Error ? error.message : 'Unknown error'
    );
    
    res.status(500).json(errorResponse);
  }
}

// Create router
const router = express.Router();

// POST /api/v1/generate-mvp endpoint
router.post('/generate-mvp', handleGenerateMVP);

export default router;