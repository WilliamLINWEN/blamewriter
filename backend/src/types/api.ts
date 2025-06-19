// backend/src/types/api.ts

/**
 * API versioning and request/response types for Phase 2
 */

// =====================================
// API Versioning Types
// =====================================

export interface ApiVersion {
  version: string;
  deprecationDate?: string;
  sunsetDate?: string;
  supportedFeatures: string[];
}

export interface ApiMetadata {
  version: string;
  timestamp: string;
  requestId: string;
  processingTime?: number;
  rateLimit?: {
    remaining: number;
    reset: number;
    limit: number;
  };
}

// =====================================
// Enhanced Request Interfaces
// =====================================

/**
 * Base request interface with common fields
 */
export interface BaseApiRequest {
  /** Request metadata for tracking and debugging */
  metadata?: {
    requestId?: string;
    clientVersion?: string;
    userAgent?: string;
  };
}

/**
 * LLM Configuration for requests
 */
export interface LLMConfig {
  providerId: string;
  modelId: string;
  apiKey?: string | undefined;
  customEndpoint?: string | undefined;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
}

/**
 * Template configuration
 */
export interface TemplateConfig {
  id?: string | undefined;
  content: string;
  placeholders?: Record<string, any>;
}

/**
 * Enhanced Generate Request (Phase 2)
 */
export interface GenerateRequest extends BaseApiRequest {
  prUrl: string;
  bitbucketToken: string;
  llmConfig: LLMConfig;
  template: TemplateConfig;
  /** Optional metadata - can be undefined */
  metadata?: {
    requestId?: string;
    clientVersion?: string;
    userAgent?: string;
  };
  options?: {
    diffProcessing?: {
      maxChunkSize?: number;
      ignoredPatterns?: string[];
      chunkingStrategy?: 'size' | 'file' | 'semantic';
      enableMapReduce?: boolean;
    };
    output?: {
      format?: 'markdown' | 'plain' | 'html';
      maxLength?: number;
      includeDiffStats?: boolean;
    };
  };
}

/**
 * Backward-compatible MVP Request (Phase 1)
 */
export interface GenerateMVPRequest extends BaseApiRequest {
  prUrl: string;
  bitbucketToken: string;
  templateContent?: string;
  llmConfig?: Partial<LLMConfig>;
}

// =====================================
// Enhanced Response Interfaces
// =====================================

/**
 * Diff processing statistics
 */
export interface DiffStats {
  totalFiles: number;
  addedLines: number;
  deletedLines: number;
  modifiedFiles: number;
  fileTypes: Record<string, number>;
  largestFile: {
    name: string;
    changes: number;
  };
  processingMethod: 'direct' | 'chunked' | 'map-reduce';
  chunksProcessed?: number;
}

/**
 * Enhanced Generate Response (Phase 2)
 */
export interface GenerateResponse {
  success: true;
  data: {
    description: string;
    metadata: ApiMetadata;
    diffStats?: DiffStats;
    template?: {
      id?: string | undefined;
      placeholders: Record<string, any>;
    };
    llmProvider: {
      name: string;
      model: string;
      tokensUsed?: number | undefined;
      cost?: number | undefined;
    };
  };
}

/**
 * Backward-compatible MVP Response (Phase 1)
 */
export interface GenerateMVPResponse {
  description: string;
  metadata?: Partial<ApiMetadata>;
}

/**
 * Enhanced Error Response with detailed information
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string | undefined;
    category: 'validation' | 'authentication' | 'authorization' | 'rate_limit' | 'provider' | 'processing' | 'internal';
    retryable: boolean;
    suggestedAction?: string | undefined;
  };
  metadata: ApiMetadata;
}

/**
 * Union types for responses
 */
export type GenerateApiResponse = GenerateResponse | ApiErrorResponse;
export type GenerateMVPApiResponse = GenerateMVPResponse | ApiErrorResponse;

// =====================================
// Provider Capability Types
// =====================================

export interface ProviderCapability {
  id: string;
  name: string;
  models: Array<{
    id: string;
    name: string;
    contextWindow: number;
    costPer1kTokens?: number;
    features: string[];
  }>;
  features: {
    streaming: boolean;
    functionCalling: boolean;
    imageInput: boolean;
    customEndpoint: boolean;
  };
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

// =====================================
// Request Validation Types
// =====================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}
