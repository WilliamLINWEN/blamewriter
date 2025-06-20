// backend/src/routes/generate-v2.ts

import express from 'express';
import {
  GenerateRequest,
  GenerateResponse,
  GenerateMVPRequest,
  ApiErrorResponse,
  ValidationResult,
  ValidationError,
} from '@/types/api';
import { ApiRequest } from '@/middleware/logging';
import {
  parseBitbucketPRUrl,
  BitbucketUrlError,
  formatBitbucketUrlError,
} from '../utils/bitbucket';
import {
  createBitbucketClient,
  BitbucketServiceError,
  formatBitbucketServiceError,
} from '../services/bitbucket';
import {
  createOpenAIClient,
  OpenAIServiceError,
  formatOpenAIServiceError,
} from '../services/openai';

const router = express.Router();

// =====================================
// Request Validation
// =====================================

/**
 * Validates a GenerateRequest
 */
function validateGenerateRequest(body: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Required fields
  if (!body.prUrl || typeof body.prUrl !== 'string') {
    errors.push({
      field: 'prUrl',
      message: 'prUrl is required and must be a string',
      code: 'REQUIRED_FIELD',
      value: body.prUrl,
    });
  }

  if (!body.bitbucketToken || typeof body.bitbucketToken !== 'string') {
    errors.push({
      field: 'bitbucketToken',
      message: 'bitbucketToken is required and must be a string',
      code: 'REQUIRED_FIELD',
      value: '[REDACTED]',
    });
  }

  if (!body.llmConfig || typeof body.llmConfig !== 'object') {
    errors.push({
      field: 'llmConfig',
      message: 'llmConfig is required and must be an object',
      code: 'REQUIRED_FIELD',
      value: body.llmConfig,
    });
  } else {
    // Validate llmConfig fields
    if (!body.llmConfig.providerId || typeof body.llmConfig.providerId !== 'string') {
      errors.push({
        field: 'llmConfig.providerId',
        message: 'llmConfig.providerId is required and must be a string',
        code: 'REQUIRED_FIELD',
        value: body.llmConfig.providerId,
      });
    }

    if (!body.llmConfig.modelId || typeof body.llmConfig.modelId !== 'string') {
      errors.push({
        field: 'llmConfig.modelId',
        message: 'llmConfig.modelId is required and must be a string',
        code: 'REQUIRED_FIELD',
        value: body.llmConfig.modelId,
      });
    }
  }

  if (!body.template || typeof body.template !== 'object') {
    errors.push({
      field: 'template',
      message: 'template is required and must be an object',
      code: 'REQUIRED_FIELD',
      value: body.template,
    });
  } else {
    if (!body.template.content || typeof body.template.content !== 'string') {
      errors.push({
        field: 'template.content',
        message: 'template.content is required and must be a string',
        code: 'REQUIRED_FIELD',
        value: body.template.content,
      });
    }
  }

  // URL validation
  if (body.prUrl) {
    try {
      parseBitbucketPRUrl(body.prUrl);
    } catch (error) {
      errors.push({
        field: 'prUrl',
        message: 'Invalid Bitbucket PR URL format',
        code: 'INVALID_FORMAT',
        value: body.prUrl,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a backward-compatible MVP request
 */
function validateMVPRequest(body: any): ValidationResult {
  const errors: ValidationError[] = [];

  if (!body.prUrl || typeof body.prUrl !== 'string') {
    errors.push({
      field: 'prUrl',
      message: 'prUrl is required and must be a string',
      code: 'REQUIRED_FIELD',
      value: body.prUrl,
    });
  }

  if (!body.bitbucketToken || typeof body.bitbucketToken !== 'string') {
    errors.push({
      field: 'bitbucketToken',
      message: 'bitbucketToken is required and must be a string',
      code: 'REQUIRED_FIELD',
      value: '[REDACTED]',
    });
  }

  // URL validation
  if (body.prUrl) {
    try {
      parseBitbucketPRUrl(body.prUrl);
    } catch (error) {
      errors.push({
        field: 'prUrl',
        message: 'Invalid Bitbucket PR URL format',
        code: 'INVALID_FORMAT',
        value: body.prUrl,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// =====================================
// Error Response Helpers
// =====================================

function createErrorResponse(
  req: ApiRequest,
  code: string,
  message: string,
  category: ApiErrorResponse['error']['category'],
  retryable: boolean = false,
  details?: string,
  suggestedAction?: string,
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      category,
      retryable,
      suggestedAction,
    },
    metadata: req.apiMetadata,
  };
}

function handleValidationErrors(
  req: ApiRequest,
  res: express.Response,
  errors: ValidationError[],
): void {
  req.audit({
    action: 'generate_request_validation',
    resource: 'api/v1/generate',
    outcome: 'failure',
    details: { validationErrors: errors },
  });

  const errorResponse = createErrorResponse(
    req,
    'VALIDATION_ERROR',
    'Request validation failed',
    'validation',
    false,
    `${errors.length} validation error(s)`,
    'Please check the request format and required fields',
  );

  res.status(400).json(errorResponse);
}

// =====================================
// Route Handlers
// =====================================

/**
 * Enhanced generate endpoint (Phase 2)
 * POST /api/v1/generate
 */
async function handleGenerate(req: express.Request, res: express.Response): Promise<void> {
  const apiReq = req as ApiRequest;

  try {
    console.log(
      `🚀 [${apiReq.apiMetadata.timestamp}] POST /api/v1/generate - Enhanced request received`,
    );

    // Validate request
    const validation = validateGenerateRequest(req.body);
    if (!validation.isValid) {
      handleValidationErrors(apiReq, res, validation.errors);
      return;
    }

    const generateRequest = req.body as GenerateRequest;

    // Parse and validate Bitbucket URL
    let urlInfo;
    try {
      urlInfo = parseBitbucketPRUrl(generateRequest.prUrl);
      console.log('✅ URL parsed successfully:', urlInfo);
    } catch (error) {
      if (error instanceof BitbucketUrlError) {
        const errorResponse = createErrorResponse(
          apiReq,
          'INVALID_PR_URL',
          'Invalid Bitbucket PR URL',
          'validation',
          false,
          formatBitbucketUrlError(error),
          'Please provide a valid Bitbucket pull request URL',
        );
        res.status(400).json(errorResponse);
        return;
      }
      throw error;
    }

    // Audit the generate request
    apiReq.audit({
      action: 'generate_request',
      resource: `pr/${urlInfo.workspace}/${urlInfo.repo}/${urlInfo.prId}`,
      outcome: 'success',
      details: {
        llmProvider: generateRequest.llmConfig.providerId,
        model: generateRequest.llmConfig.modelId,
        templateId: generateRequest.template.id,
        hasCustomEndpoint: !!generateRequest.llmConfig.customEndpoint,
      },
    });

    // Create Bitbucket client
    const bitbucketClient = createBitbucketClient(generateRequest.bitbucketToken);

    // Fetch PR data
    let prData;
    try {
      console.log('🔍 Fetching PR data from Bitbucket...');
      const prInfo = await bitbucketClient.fetchPRInfo(urlInfo);
      const prDiff = await bitbucketClient.fetchPRDiff(urlInfo);
      prData = { ...prInfo, diff: prDiff };
      console.log('✅ PR data fetched successfully');
    } catch (error) {
      if (error instanceof BitbucketServiceError) {
        const errorResponse = createErrorResponse(
          apiReq,
          'BITBUCKET_API_ERROR',
          'Failed to fetch PR data from Bitbucket',
          'provider',
          true,
          formatBitbucketServiceError(error),
          'Please check your Bitbucket token and PR URL',
        );
        res.status(error.statusCode || 500).json(errorResponse);
        return;
      }
      throw error;
    }

    // For now, use OpenAI client (will be replaced with provider factory in 2.2)
    if (generateRequest.llmConfig.providerId !== 'openai') {
      const errorResponse = createErrorResponse(
        apiReq,
        'UNSUPPORTED_PROVIDER',
        'Only OpenAI provider is currently supported',
        'validation',
        false,
        `Provider '${generateRequest.llmConfig.providerId}' is not yet implemented`,
        'Please use "openai" as the providerId',
      );
      res.status(400).json(errorResponse);
      return;
    }

    // Validate API key is provided
    if (!generateRequest.llmConfig.apiKey) {
      const errorResponse = createErrorResponse(
        apiReq,
        'INVALID_REQUEST',
        'LLM API key is required',
        'validation',
        false,
        'apiKey field must be provided in llmConfig',
      );
      res.status(400).json(errorResponse);
      return;
    }

    // Create OpenAI client
    const openaiClient = createOpenAIClient(generateRequest.llmConfig.apiKey);

    // Generate description using template
    let description;
    try {
      console.log('🤖 Generating description with OpenAI...');

      // Template processing (basic for now, will be enhanced in 2.3)
      const processedTemplate = generateRequest.template.content
        .replace('{{title}}', prData.title)
        .replace('{{description}}', prData.description || 'No description provided')
        .replace('{{author}}', prData.author?.display_name || 'Unknown')
        .replace('{{source_branch}}', prData.source?.branch?.name || 'Unknown')
        .replace('{{destination_branch}}', prData.destination?.branch?.name || 'Unknown')
        .replace('{{diff}}', prData.diff.diff || 'No diff available')
        .replace('{DIFF_CONTENT}', prData.diff.diff || 'No diff available'); // Support both formats

      const generatedResult = await openaiClient.generatePRDescription(processedTemplate, {
        model: generateRequest.llmConfig.modelId,
        maxTokens: 1000,
        temperature: 0.7,
      });

      description = generatedResult.description;
      console.log('✅ Description generated successfully');
    } catch (error) {
      if (error instanceof OpenAIServiceError) {
        const errorResponse = createErrorResponse(
          apiReq,
          'LLM_GENERATION_ERROR',
          'Failed to generate description',
          'provider',
          true,
          formatOpenAIServiceError(error),
          'Please check your API key and try again',
        );
        res.status(error.statusCode || 500).json(errorResponse);
        return;
      }
      throw error;
    }

    // Calculate diff stats (basic for now, will be enhanced in 2.4)
    // Note: Detailed stats parsing will be implemented in Phase 2.4
    const diffStats = {
      totalFiles: 0, // Will be calculated from diff parsing
      addedLines: 0, // Will be calculated from diff parsing
      deletedLines: 0, // Will be calculated from diff parsing
      modifiedFiles: 0, // Will be calculated from diff parsing
      fileTypes: {},
      largestFile: {
        name: 'Unknown',
        changes: 0,
      },
      processingMethod: 'direct' as const,
    };

    // Create successful response
    const response: GenerateResponse = {
      success: true,
      data: {
        description,
        metadata: apiReq.apiMetadata,
        diffStats,
        template: {
          id: generateRequest.template.id,
          placeholders: {
            title: prData.title,
            description: prData.description,
            author: prData.author?.display_name,
            source_branch: prData.source?.branch?.name,
            destination_branch: prData.destination?.branch?.name,
            diff: prData.diff.diff,
          },
        },
        llmProvider: {
          name: 'OpenAI',
          model: generateRequest.llmConfig.modelId,
          tokensUsed: undefined, // Will be populated when provider returns this info
          cost: undefined,
        },
      },
    };

    // Audit successful generation
    apiReq.audit({
      action: 'generate_success',
      resource: `pr/${urlInfo.workspace}/${urlInfo.repo}/${urlInfo.prId}`,
      outcome: 'success',
      details: {
        descriptionLength: description.length,
        processingTime: apiReq.apiMetadata.processingTime,
      },
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('❌ Unexpected error in generate endpoint:', error);

    apiReq.audit({
      action: 'generate_error',
      resource: 'api/v1/generate',
      outcome: 'error',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    const errorResponse = createErrorResponse(
      apiReq,
      'INTERNAL_ERROR',
      'An unexpected error occurred',
      'internal',
      true,
      error instanceof Error ? error.message : 'Unknown error',
      'Please try again later or contact support if the issue persists',
    );

    res.status(500).json(errorResponse);
  }
}

/**
 * Backward-compatible MVP endpoint
 * POST /api/v1/generate-mvp
 */
async function handleGenerateMVP(req: express.Request, res: express.Response): Promise<void> {
  const apiReq = req as ApiRequest;

  try {
    console.log(
      `🚀 [${apiReq.apiMetadata.timestamp}] POST /api/v1/generate-mvp - MVP request received (backward compatibility)`,
    );

    // Validate MVP request
    const validation = validateMVPRequest(req.body);
    if (!validation.isValid) {
      handleValidationErrors(apiReq, res, validation.errors);
      return;
    }

    const mvpRequest = req.body as GenerateMVPRequest;

    // Convert MVP request to enhanced request format
    const enhancedRequest: GenerateRequest = {
      prUrl: mvpRequest.prUrl,
      bitbucketToken: mvpRequest.bitbucketToken,
      llmConfig: {
        providerId: mvpRequest.llmConfig?.providerId || 'openai',
        modelId: mvpRequest.llmConfig?.modelId || 'gpt-3.5-turbo',
        apiKey: mvpRequest.llmConfig?.apiKey,
        customEndpoint: mvpRequest.llmConfig?.customEndpoint,
      },
      template: {
        content:
          mvpRequest.templateContent ||
          'Generate a professional PR description for this pull request:\n\nTitle: {{title}}\nDescription: {{description}}\nAuthor: {{author}}\nSource Branch: {{source_branch}}\nDestination Branch: {{destination_branch}}\n\nDiff Summary:\n{{diff}}',
      },
    };

    // Use the same logic as enhanced endpoint
    req.body = enhancedRequest;
    await handleGenerate(req, res);
  } catch (error) {
    console.error('❌ Unexpected error in MVP endpoint:', error);

    const errorResponse = createErrorResponse(
      apiReq,
      'INTERNAL_ERROR',
      'An unexpected error occurred',
      'internal',
      true,
      error instanceof Error ? error.message : 'Unknown error',
    );

    res.status(500).json(errorResponse);
  }
}

// =====================================
// Route Registration
// =====================================

// Enhanced generate endpoint (Phase 2)
router.post('/generate', handleGenerate);

// Backward-compatible MVP endpoint (Phase 1)
router.post('/generate-mvp', handleGenerateMVP);

export default router;
