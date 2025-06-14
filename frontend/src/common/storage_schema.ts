// frontend/src/common/storage_schema.ts

/**
 * Represents a single template configured by the user.
 */
export interface Template {
    id: string;
    name: string;
    content: string;
    metadata?: {
        createdAt: string;
        updatedAt: string;
    };
}

/**
 * Details about a specific LLM model.
 */
export interface ModelDetail {
    id: string; // e.g., 'gpt-3.5-turbo'
    name: string; // e.g., 'GPT-3.5 Turbo'
    contextWindow?: number;
}

/**
 * Defines the structure for a predefined LLM provider's capabilities.
 * This itself is not stored in chrome.storage.sync directly but defines
 * the structure of data used by UserLLMConfig and UI components.
 */
export interface LLMProvider {
    id: string;
    name: string;
    apiKeyLabel?: string;
    requiresApiKey: boolean;
    models: ModelDetail[];
    requiresCustomEndpoint: boolean;
    customEndpointLabel?: string;
    helpText?: string;
}

/**
 * Stores the user's selected LLM provider configuration.
 * This is stored under the 'userLLMConfig' key in chrome.storage.sync.
 */
export interface UserLLMConfig {
    providerId: string | null;
    apiKey: string | null;
    selectedModelId: string | null;
    customEndpoint: string | null;
}

/**
 * Storage quota information and statistics.
 */
export interface StorageQuotaInfo {
    bytesInUse: number;
    quotaBytes: number;
    usagePercentage: number;
    isNearLimit: boolean; // true if usage > 80%
    isCritical: boolean; // true if usage > 95%
}

/**
 * Storage cleanup configuration and statistics.
 */
export interface StorageCleanupConfig {
    autoCleanupEnabled: boolean;
    maxTemplates: number;
    warningThresholdPercent: number; // Default 80%
    criticalThresholdPercent: number; // Default 95%
    cleanupStrategy: 'oldest' | 'largest' | 'leastUsed';
    lastCleanupDate?: string;
}

/**
 * Template usage statistics for cleanup decisions.
 */
export interface TemplateUsageStats {
    templateId: string;
    lastUsed: string;
    useCount: number;
    sizeBytes: number;
}

/**
 * Stores global application settings for the extension.
 * This is stored under the 'appSettings' key in chrome.storage.sync.
 */
export interface AppSettings {
    schemaVersion: number;
    lastSeenVersion?: string; // e.g., extension version
    storageCleanupConfig?: StorageCleanupConfig;
    // Add other global preferences here later if needed
}

/**
 * Defines the overall structure of data stored in chrome.storage.sync.
 * Keys here are the top-level keys used with chrome.storage.sync.get/set.
 */
export interface ExtensionStorage {
    templates?: Template[];
    userLLMConfig?: UserLLMConfig;
    appSettings?: AppSettings;
    templateUsageStats?: TemplateUsageStats[];
    // For popup, we might store last selected template ID locally
    // lastSelectedTemplateId?: string; // Example for chrome.storage.local if needed
}

export const CURRENT_SCHEMA_VERSION = 1;
