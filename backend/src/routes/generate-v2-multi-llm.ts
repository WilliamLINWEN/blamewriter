/**
 * Enhanced Generate Route with Multi-LLM Provider Support (Phase 2)
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
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
  LLMProviderType,
  LLMProviderError,
  formatLLMProviderError,
} from '../services/llm-provider';
import {
  getProviderFactory,
  AnyProviderConfig,
} from '../services/providers/provider-factory';
import {
  GenerateRequest,
  GenerateResponse,
  ApiErrorResponse,
  GenerateApiResponse,
  ApiMetadata,
  DiffStats,
} from '../types/api';

/**
 * Router for the enhanced generate endpoint
 */
export const router = express.Router();

/**
 * Validate the request payload
 */
function validateGenerateRequest(body: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Basic validation
  if (!body.prUrl || typeof body.prUrl !== 'string') {
    errors.push('prUrl is required and must be a string');
  }

  if (!body.bitbucketToken || typeof body.bitbucketToken !== 'string') {
    errors.push('bitbucketToken is required and must be a string');
  }

  if (!body.llmConfig || typeof body.llmConfig !== 'object') {
    errors.push('llmConfig is required and must be an object');
  } else {
    if (!body.llmConfig.providerId || typeof body.llmConfig.providerId !== 'string') {
      errors.push('llmConfig.providerId is required and must be a string');
    }

    if (!body.llmConfig.modelId || typeof body.llmConfig.modelId !== 'string') {
      errors.push('llmConfig.modelId is required and must be a string');
    }

    // Validate provider-specific requirements
    const providerId = body.llmConfig.providerId?.toLowerCase();
    if (['openai', 'anthropic', 'xai'].includes(providerId) && !body.llmConfig.apiKey) {
      errors.push(`llmConfig.apiKey is required for ${providerId} provider`);
    }

    if (providerId === 'ollama' && !body.llmConfig.customEndpoint) {
      errors.push('llmConfig.customEndpoint is required for ollama provider');
    }
  }

  if (!body.template || typeof body.template !== 'object') {
    errors.push('template is required and must be an object');
  } else {
    if (!body.template.content || typeof body.template.content !== 'string') {
      errors.push('template.content is required and must be a string');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Map request LLM config to provider config
 */
function mapToProviderConfig(llmConfig: any): { type: LLMProviderType; config: AnyProviderConfig } {
  const providerId = llmConfig.providerId.toLowerCase();

  switch (providerId) {
    case 'openai':
      return {
        type: LLMProviderType.OPENAI,
        config: {
          apiKey: llmConfig.apiKey,
          model: llmConfig.modelId,
          timeout: llmConfig.parameters?.timeout,
          maxRetries: llmConfig.parameters?.maxRetries,
          organizationId: llmConfig.parameters?.organizationId,
        },
      };

    case 'anthropic':
      return {
        type: LLMProviderType.ANTHROPIC,
        config: {
          apiKey: llmConfig.apiKey,
          model: llmConfig.modelId,
          baseUrl: llmConfig.customEndpoint,
          timeout: llmConfig.parameters?.timeout,
          maxRetries: llmConfig.parameters?.maxRetries,
        },
      };

    case 'xai':
      return {
        type: LLMProviderType.XAI,
        config: {
          apiKey: llmConfig.apiKey,
          model: llmConfig.modelId,
          baseUrl: llmConfig.customEndpoint,
          timeout: llmConfig.parameters?.timeout,
          maxRetries: llmConfig.parameters?.maxRetries,
        },
      };

    case 'ollama':
      return {
        type: LLMProviderType.OLLAMA,
        config: {
          baseUrl: llmConfig.customEndpoint || 'http://localhost:11434',
          model: llmConfig.modelId,
          timeout: llmConfig.parameters?.timeout,
          maxRetries: llmConfig.parameters?.maxRetries,
        },
      };

    default:
      throw new Error(`Unsupported provider: ${providerId}`);
  }
}

/**
 * Calculate diff statistics
 */
function calculateDiffStats(diffContent: string): DiffStats {
  const lines = diffContent.split('\n');
  let addedLines = 0;
  let deletedLines = 0;
  const fileTypes: Record<string, number> = {};
  const files = new Set<string>();
  let largestFileChanges = 0;
  let largestFileName = '';

  let currentFile = '';
  let currentFileChanges = 0;

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      // Save previous file stats
      if (currentFile && currentFileChanges > largestFileChanges) {
        largestFileChanges = currentFileChanges;
        largestFileName = currentFile;
      }

      // Start new file
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      if (match && match[2]) {
        currentFile = match[2];
        files.add(currentFile);
        currentFileChanges = 0;

        // Track file types
        const ext = currentFile.split('.').pop()?.toLowerCase() || 'unknown';
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      }
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      addedLines++;
      currentFileChanges++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletedLines++;
      currentFileChanges++;
    }
  }

  // Check last file
  if (currentFile && currentFileChanges > largestFileChanges) {
    largestFileChanges = currentFileChanges;
    largestFileName = currentFile;
  }

  return {
    totalFiles: files.size,
    addedLines,
    deletedLines,
    modifiedFiles: files.size,
    fileTypes,
    largestFile: {
      name: largestFileName,
      changes: largestFileChanges,
    },
    processingMethod: 'direct', // Will be updated if chunking is used
  };
}

/**
 * Enhanced PR description generation endpoint
 */
router.post('/generate', async (req: express.Request, res: express.Response): Promise<void> => {
  const startTime = Date.now();
  const requestId = uuidv4();

  console.log(`🚀 [Generate V2] Request started: ${requestId}`);
  console.log(`📝 [Generate V2] Request body:`, JSON.stringify(req.body, null, 2));

  try {
    // Validate request
    const validation = validateGenerateRequest(req.body);
    if (!validation.isValid) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request validation failed',
          details: validation.errors.join('; '),
          category: 'validation',
          retryable: false,
          suggestedAction: 'Please check the request format and required fields',
        },
        metadata: {
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          requestId,
          processingTime: Date.now() - startTime,
        },
      };

      console.log(`❌ [Generate V2] Validation failed:`, validation.errors);
      res.status(400).json(errorResponse);
      return;
    }

    const request = req.body as GenerateRequest;

    // Parse Bitbucket PR URL
    console.log(`🔍 [Generate V2] Parsing PR URL: ${request.prUrl}`);
    const urlInfo = parseBitbucketPRUrl(request.prUrl);
    console.log('✅ URL parsed successfully:', urlInfo);

    const bitbucketClient = createBitbucketClient(request.bitbucketToken);

    let prData;

    console.log('🔍 [Generate V2] Fetching PR data from Bitbucket...');
    const prInfo = await bitbucketClient.fetchPRInfo(urlInfo);
    console.log(`🌐 [Generate V2] Fetching PR diff from Bitbucket...`);
    const prDiff = await bitbucketClient.fetchPRDiff(urlInfo);
    prData = { ...prInfo, diff: prDiff };
    console.log('✅ PR data fetched successfully');

    const diffContent: string = prData.diff.diff;

    console.log(`📊 [Generate V2] Diff retrieved: ${diffContent.length} characters`);

    // Calculate diff statistics
    const diffStats = calculateDiffStats(diffContent);
    console.log(`📈 [Generate V2] Diff stats:`, diffStats);

    // Create LLM provider
    const { type, config } = mapToProviderConfig(request.llmConfig);
    const provider = getProviderFactory().createProvider(type, config);

    console.log(`🤖 [Generate V2] Using provider: ${type}`);

    // Use provider's built-in template processing instead of manual replacement
    console.log(`📝 [Generate V2] Using provider template processing with standardized placeholders...`);
    
    // Prepare generation options with template processing
    const generationOptions = {
      model: request.llmConfig.modelId,
      template: request.template.content,
      templateData: {
        // Standard placeholders (using {PLACEHOLDER} format)
        BRANCH_NAME: prData.source?.branch?.name || 'Unknown',
        COMMIT_MESSAGES: '', // TODO: Extract from PR data when available
        DIFF_SUMMARY: `Diff size: ${prData.diff.size} characters${prData.diff.truncated ? ' (truncated)' : ''}`,
        PULL_REQUEST_TITLE: prData.title || 'No title provided',
        PULL_REQUEST_BODY: prData.description || 'No description provided',
        DIFF_CONTENT: diffContent || 'No diff available',
        
        // Legacy placeholders (using {{placeholder}} format for backward compatibility)
        // Note: These are supported but {PLACEHOLDER} format is preferred
        title: prData.title || 'No title provided',
        description: prData.description || 'No description provided',
        author: prData.author?.display_name || 'Unknown',
        source_branch: prData.source?.branch?.name || 'Unknown',
        destination_branch: prData.destination?.branch?.name || 'Unknown',
        diff: diffContent || 'No diff available',
      },
      ...(request.llmConfig.parameters?.maxTokens && { maxTokens: request.llmConfig.parameters.maxTokens }),
      ...(request.llmConfig.parameters?.temperature && { temperature: request.llmConfig.parameters.temperature }),
      ...(request.options?.diffProcessing?.maxChunkSize && { diffSizeLimit: request.options.diffProcessing.maxChunkSize }),
    };

    // Generate description using base class template processing
    // Note: Using the improved base class method that handles template validation and processing
    const result = await provider.generatePRDescription(generationOptions);

    console.log(`✅ [Generate V2] Description generated successfully`);
    console.log(`📝 [Generate V2] Result: ${result.description.length} characters`);

    // Build response metadata
    const metadata: ApiMetadata = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      requestId,
      processingTime: Date.now() - startTime,
    };

    // Build successful response
    const response: GenerateResponse = {
      success: true,
      data: {
        description: result.description,
        metadata,
        diffStats,
        template: {
          id: request.template.id,
          placeholders: {
            title: prData.title,
            description: prData.description,
            author: prData.author?.display_name,
            source_branch: prData.source?.branch?.name,
            destination_branch: prData.destination?.branch?.name,
            diff: prData.diff.diff
          }
        },
        llmProvider: {
          name: result.provider,
          model: result.model,
          tokensUsed: result.tokensUsed,
          cost: undefined, // Could be calculated based on provider pricing
        },
      },
    };

    console.log(`🎉 [Generate V2] Request completed successfully: ${requestId}`);
    res.json(response);

  } catch (error: any) {
    console.error(`❌ [Generate V2] Request failed:`, error);

    let errorResponse: ApiErrorResponse;

    if (error instanceof BitbucketUrlError) {
      errorResponse = {
        success: false,
        error: {
          code: 'INVALID_PR_URL',
          message: 'Invalid Bitbucket PR URL',
          details: formatBitbucketUrlError(error),
          category: 'validation',
          retryable: false,
          suggestedAction: 'Please provide a valid Bitbucket PR URL',
        },
        metadata: {
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          requestId,
          processingTime: Date.now() - startTime,
        },
      };
    } else if (error instanceof BitbucketServiceError) {
      errorResponse = {
        success: false,
        error: {
          code: 'BITBUCKET_API_ERROR',
          message: 'Bitbucket API error',
          details: formatBitbucketServiceError(error),
          category: 'provider',
          retryable: error.code === 'RATE_LIMITED' || error.code === 'NETWORK_ERROR',
          suggestedAction: 'Please check your Bitbucket token and try again',
        },
        metadata: {
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          requestId,
          processingTime: Date.now() - startTime,
        },
      };
    } else if (error instanceof LLMProviderError) {
      errorResponse = {
        success: false,
        error: {
          code: 'LLM_PROVIDER_ERROR',
          message: 'LLM provider error',
          details: formatLLMProviderError(error),
          category: 'provider',
          retryable: ['RATE_LIMITED', 'TIMEOUT', 'NETWORK_ERROR'].includes(error.code),
          suggestedAction: 'Please check your LLM provider configuration and try again',
        },
        metadata: {
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          requestId,
          processingTime: Date.now() - startTime,
        },
      };
    } else {
      errorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          details: error.message,
          category: 'internal',
          retryable: true,
          suggestedAction: 'Please try again later',
        },
        metadata: {
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          requestId,
          processingTime: Date.now() - startTime,
        },
      };
    }

    const statusCode = error.statusCode || 500;
    res.status(statusCode).json(errorResponse);
  }
});

export default router;
