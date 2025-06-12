import express from 'express';
import { parseBitbucketPRUrl, BitbucketUrlError, formatBitbucketUrlError } from '../utils/bitbucket';
import { createBitbucketClient, BitbucketServiceError, formatBitbucketServiceError } from '../services/bitbucket';

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
    
    // Parse the PR URL to extract workspace, repo, and PR ID
    let prInfo;
    try {
      prInfo = parseBitbucketPRUrl(prUrl);
      console.log(`🔍 Parsed PR info:`, {
        workspace: prInfo.workspace,
        repo: prInfo.repo,
        prId: prInfo.prId
      });
    } catch (error: unknown) {
      if (error instanceof BitbucketUrlError) {
        console.log('❌ PR URL parsing failed:', error.message);
        
        const errorResponse = createErrorResponse(
          'INVALID_PR_URL',
          'Invalid Bitbucket PR URL',
          formatBitbucketUrlError(error)
        );
        
        res.status(400).json(errorResponse);
        return;
      }
      
      // Re-throw unexpected errors
      throw error;
    }
    
    // Create Bitbucket API client
    const bitbucketClient = createBitbucketClient(bitbucketToken);
    
    // Fetch PR diff from Bitbucket API
    let prDiff;
    try {
      console.log(`🌐 Fetching PR diff from Bitbucket API...`);
      prDiff = await bitbucketClient.fetchPRDiff(prInfo);
      console.log(`✅ PR diff fetched successfully, size: ${prDiff.size} bytes`);
      
      // Log a preview of the diff (first 200 characters)
      const diffPreview = prDiff.diff.substring(0, 200).replace(/\n/g, '\\n');
      console.log(`📄 Diff preview: ${diffPreview}${prDiff.diff.length > 200 ? '...' : ''}`);
      
    } catch (error: unknown) {
      if (error instanceof BitbucketServiceError) {
        console.log('❌ Bitbucket API request failed:', error.message);
        
        let statusCode = 500;
        let errorCode = 'BITBUCKET_API_ERROR';
        
        // Map specific error codes to appropriate HTTP status codes
        switch (error.code) {
          case 'UNAUTHORIZED':
            statusCode = 401;
            errorCode = 'INVALID_TOKEN';
            break;
          case 'FORBIDDEN':
            statusCode = 403;
            errorCode = 'ACCESS_DENIED';
            break;
          case 'NOT_FOUND':
            statusCode = 404;
            errorCode = 'PR_NOT_FOUND';
            break;
          case 'RATE_LIMITED':
            statusCode = 429;
            errorCode = 'RATE_LIMITED';
            break;
          case 'TIMEOUT':
          case 'NETWORK_ERROR':
            statusCode = 503;
            errorCode = 'SERVICE_UNAVAILABLE';
            break;
        }
        
        const errorResponse = createErrorResponse(
          errorCode,
          'Failed to fetch PR data from Bitbucket',
          formatBitbucketServiceError(error)
        );
        
        res.status(statusCode).json(errorResponse);
        return;
      }
      
      // Re-throw unexpected errors
      throw error;
    }
    
    // TODO: Implement OpenAI API integration to generate description from diff
    // For now, return a more realistic placeholder response that includes actual PR data
    
    const mockDescription = `# PR Description (Generated)

**Repository:** ${prInfo.workspace}/${prInfo.repo}
**Pull Request:** #${prInfo.prId}
**Generated at:** ${new Date().toISOString()}

## Summary
This pull request contains ${prDiff.size} bytes of changes. 

## Changes Detected
Based on the diff analysis:
- Total diff size: ${prDiff.size} bytes
- Contains ${prDiff.diff.split('\n').length} lines of changes
- ${prDiff.diff.includes('+++') ? 'Files added/modified' : 'No file additions detected'}
- ${prDiff.diff.includes('---') ? 'Files removed/modified' : 'No file deletions detected'}

## Next Steps
- [ ] Review the changes
- [ ] Run tests
- [ ] Update documentation if needed

*This description was generated automatically and will be enhanced with AI-powered analysis once OpenAI integration is complete.*

---
**Original PR URL:** ${prUrl}`;

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