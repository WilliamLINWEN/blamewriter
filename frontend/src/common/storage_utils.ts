// frontend/src/common/storage_utils.ts
import { ExtensionStorage, StorageQuotaInfo, StorageCleanupConfig, TemplateUsageStats, Template } from './storage_schema'; // To allow type hints for keys

/**
 * Retrieves an item from chrome.storage.sync.
 * @param key The key of the item to retrieve.
 * @param defaultValue The default value to return if the key is not found.
 * @returns A promise that resolves to the retrieved item or the default value.
 */
export async function getFromStorage<K extends keyof ExtensionStorage>(
    key: K,
    defaultValue: NonNullable<ExtensionStorage[K]> // Ensure defaultValue matches the type for that key and is not undefined/null
): Promise<NonNullable<ExtensionStorage[K]>> {
    return new Promise((resolve, reject) => {
        try {
            // @ts-ignore
            chrome.storage.sync.get([key], (result) => {
                // @ts-ignore
                if (chrome.runtime.lastError) {
                    // @ts-ignore
                    console.error(`Error getting item '${key}' from storage:`, chrome.runtime.lastError.message);
                    // @ts-ignore
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (result && result[key] !== undefined && result[key] !== null) {
                    resolve(result[key] as NonNullable<ExtensionStorage[K]>);
                } else {
                    resolve(defaultValue);
                }
            });
        } catch (e) {
            console.error(`Exception while trying to get item '${key}' from storage:`, e);
            reject(e);
        }
    });
}

/**
 * Saves one or more items to chrome.storage.sync (internal function).
 * @param items An object containing one or more key/value pairs to save.
 * @returns A promise that resolves when the items have been saved or rejects on error.
 */
async function saveToStorageInternal(items: Partial<ExtensionStorage>): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            // @ts-ignore
            chrome.storage.sync.set(items, () => {
                // @ts-ignore
                if (chrome.runtime.lastError) {
                    // @ts-ignore
                    console.error('Error saving items to storage:', items, chrome.runtime.lastError.message);
                    // @ts-ignore
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                console.log('Items saved to storage:', items);
                resolve();
            });
        } catch (e) {
            console.error('Exception while trying to save items to storage:', items, e);
            reject(e);
        }
    });
}

/**
 * Saves one or more items to chrome.storage.sync with optional quota checking.
 * @param items An object containing one or more key/value pairs to save.
 * @param checkQuota Whether to check storage quota before saving (default: true)
 * @returns A promise that resolves when the items have been saved or rejects on error.
 */
export async function saveToStorage(items: Partial<ExtensionStorage>, checkQuota: boolean = true): Promise<void> {
    if (checkQuota) {
        const canSave = await checkStorageQuotaBeforeSave(items);
        if (!canSave) {
            throw new Error('Storage quota exceeded and cleanup failed. Please free up space or reduce data size.');
        }
    }

    return saveToStorageInternal(items);
}

// --- Advanced Storage Features (Deferred) ---

// **Storage Quota Management and Cleanup:**
// Chrome's `chrome.storage.sync` has specific quota limitations (QUOTA_BYTES and QUOTA_BYTES_PER_ITEM).
// Exceeding these quotas will result in errors when `saveToStorage` is called,
// which should be caught and can be reported to the user.
// Proactive quota management (e.g., calculating current usage, warning users,
// or implementing LRU cleanup for specific data types) is a more advanced feature
// and is deferred for future consideration. For now, the extension relies on
// the error handling within `saveToStorage` to report issues if quotas are hit.

// **Storage Integrity Validation:**
// Validating the integrity of all stored data on load (e.g., ensuring all template IDs
// referenced elsewhere actually exist, or that LLM configuration fields meet specific
// provider requirements beyond basic structure) can be complex.
// Currently, basic structural validation is performed during the import of settings.
// Comprehensive, ongoing integrity checks across all stored data are deferred.
// Type safety via TypeScript interfaces provides some level of structural integrity at development time.

// --- Storage Quota Management ---

/**
 * Chrome storage sync quota limits (as per Chrome extension API documentation)
 */
export const CHROME_STORAGE_SYNC_QUOTA_BYTES = 102400; // 100KB
export const CHROME_STORAGE_SYNC_QUOTA_BYTES_PER_ITEM = 8192; // 8KB per item

/**
 * Gets current storage usage information and quota status.
 * @returns Promise resolving to storage quota information
 */
export async function getStorageQuotaInfo(): Promise<StorageQuotaInfo> {
    return new Promise((resolve, reject) => {
        try {
            // @ts-ignore
            chrome.storage.sync.getBytesInUse(null, (bytesInUse: number) => {
                // @ts-ignore
                if (chrome.runtime.lastError) {
                    // @ts-ignore
                    console.error('Error getting storage bytes in use:', chrome.runtime.lastError.message);
                    // @ts-ignore
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                const quotaBytes = CHROME_STORAGE_SYNC_QUOTA_BYTES;
                const usagePercentage = Math.round((bytesInUse / quotaBytes) * 100);
                const isNearLimit = usagePercentage >= 80;
                const isCritical = usagePercentage >= 95;

                const quotaInfo: StorageQuotaInfo = {
                    bytesInUse,
                    quotaBytes,
                    usagePercentage,
                    isNearLimit,
                    isCritical
                };

                console.log('Storage quota info:', quotaInfo);
                resolve(quotaInfo);
            });
        } catch (e) {
            console.error('Exception while getting storage quota info:', e);
            reject(e);
        }
    });
}

/**
 * Checks storage quota before saving and performs cleanup if needed.
 * @param items Items to be saved
 * @returns Promise resolving to true if save can proceed, false if quota exceeded
 */
export async function checkStorageQuotaBeforeSave(items: Partial<ExtensionStorage>): Promise<boolean> {
    try {
        const quotaInfo = await getStorageQuotaInfo();
        const itemsSize = calculateItemsSize(items);
        
        // Estimate if adding these items would exceed quota
        const estimatedNewSize = quotaInfo.bytesInUse + itemsSize;
        const estimatedUsagePercent = (estimatedNewSize / quotaInfo.quotaBytes) * 100;

        console.log(`Storage check: Current ${quotaInfo.usagePercentage}%, Estimated after save: ${Math.round(estimatedUsagePercent)}%`);

        if (estimatedUsagePercent >= 100) {
            console.warn('Storage quota would be exceeded, attempting cleanup...');
            const cleanupSuccess = await performStorageCleanup();
            if (!cleanupSuccess) {
                console.error('Storage quota exceeded and cleanup failed');
                return false;
            }
            // Re-check after cleanup
            const newQuotaInfo = await getStorageQuotaInfo();
            const newEstimatedSize = newQuotaInfo.bytesInUse + itemsSize;
            const newEstimatedUsagePercent = (newEstimatedSize / newQuotaInfo.quotaBytes) * 100;
            return newEstimatedUsagePercent < 100;
        }

        if (quotaInfo.isCritical) {
            console.warn('Storage usage is critical, consider cleanup');
            // Optionally trigger automatic cleanup
            await performStorageCleanup();
        }

        return true;
    } catch (error) {
        console.error('Error checking storage quota:', error);
        return true; // Allow save to proceed if quota check fails
    }
}

/**
 * Calculates the approximate size of items in bytes.
 * @param items Items to calculate size for
 * @returns Estimated size in bytes
 */
function calculateItemsSize(items: Partial<ExtensionStorage>): number {
    try {
        const jsonString = JSON.stringify(items);
        return new Blob([jsonString]).size;
    } catch (error) {
        console.error('Error calculating items size:', error);
        return 0;
    }
}

/**
 * Enhanced saveToStorage with quota management.
 * @param items Items to save
 * @param skipQuotaCheck Skip quota check (for cleanup operations)
 * @returns Promise resolving when items are saved
 */
async function saveToStorageWithQuotaCheck(items: Partial<ExtensionStorage>, skipQuotaCheck: boolean = false): Promise<void> {
    if (!skipQuotaCheck) {
        const canSave = await checkStorageQuotaBeforeSave(items);
        if (!canSave) {
            throw new Error('Storage quota exceeded and cleanup failed. Please free up space or reduce data size.');
        }
    }

    return saveToStorageInternal(items);
}

/**
 * Performs storage cleanup based on the configured strategy.
 * @returns Promise resolving to true if cleanup was successful
 */
export async function performStorageCleanup(): Promise<boolean> {
    try {
        console.log('Starting storage cleanup...');
        
        // Get cleanup configuration
        const appSettings = await getFromStorage('appSettings', { schemaVersion: 1 });
        const cleanupConfig: StorageCleanupConfig = appSettings.storageCleanupConfig || {
            autoCleanupEnabled: true,
            maxTemplates: 20,
            warningThresholdPercent: 80,
            criticalThresholdPercent: 95,
            cleanupStrategy: 'oldest'
        };

        // Get current templates and usage stats
        const templates = await getFromStorage('templates', []);
        const usageStats = await getFromStorage('templateUsageStats', []);

        if (templates.length <= cleanupConfig.maxTemplates) {
            console.log('Template count within limits, no cleanup needed');
            return true;
        }

        // Determine templates to remove based on strategy
        const templatesToRemove = selectTemplatesForRemoval(templates, usageStats, cleanupConfig);
        
        if (templatesToRemove.length === 0) {
            console.log('No templates selected for removal');
            return false;
        }

        // Remove selected templates
        const remainingTemplates = templates.filter(t => !templatesToRemove.some(tr => tr.id === t.id));
        const remainingUsageStats = usageStats.filter(s => !templatesToRemove.some(tr => tr.id === s.templateId));

        // Save cleaned data
        await saveToStorageInternal({
            templates: remainingTemplates,
            templateUsageStats: remainingUsageStats,
            appSettings: {
                ...appSettings,
                storageCleanupConfig: {
                    ...cleanupConfig,
                    lastCleanupDate: new Date().toISOString()
                }
            }
        });

        console.log(`Storage cleanup completed. Removed ${templatesToRemove.length} templates.`);
        return true;
    } catch (error) {
        console.error('Error during storage cleanup:', error);
        return false;
    }
}

/**
 * Selects templates for removal based on cleanup strategy.
 * @param templates All templates
 * @param usageStats Usage statistics
 * @param config Cleanup configuration
 * @returns Templates to be removed
 */
function selectTemplatesForRemoval(
    templates: Template[],
    usageStats: TemplateUsageStats[],
    config: StorageCleanupConfig
): Template[] {
    const excessCount = templates.length - config.maxTemplates;
    if (excessCount <= 0) return [];

    let sortedTemplates: Template[];

    switch (config.cleanupStrategy) {
        case 'oldest':
            sortedTemplates = templates.sort((a, b) => {
                const aDate = a.metadata?.createdAt || '1970-01-01';
                const bDate = b.metadata?.createdAt || '1970-01-01';
                return new Date(aDate).getTime() - new Date(bDate).getTime();
            });
            break;

        case 'largest':
            sortedTemplates = templates.sort((a, b) => {
                const aSize = JSON.stringify(a).length;
                const bSize = JSON.stringify(b).length;
                return bSize - aSize; // Largest first
            });
            break;

        case 'leastUsed':
            sortedTemplates = templates.sort((a, b) => {
                const aStats = usageStats.find(s => s.templateId === a.id);
                const bStats = usageStats.find(s => s.templateId === b.id);
                const aUsage = aStats ? aStats.useCount : 0;
                const bUsage = bStats ? bStats.useCount : 0;
                return aUsage - bUsage; // Least used first
            });
            break;

        default:
            sortedTemplates = templates;
    }

    return sortedTemplates.slice(0, excessCount);
}

/**
 * Updates template usage statistics.
 * @param templateId Template ID that was used
 */
export async function updateTemplateUsageStats(templateId: string): Promise<void> {
    try {
        const usageStats = await getFromStorage('templateUsageStats', []);
        const now = new Date().toISOString();
        
        const existingStats = usageStats.find(s => s.templateId === templateId);
        if (existingStats) {
            existingStats.lastUsed = now;
            existingStats.useCount += 1;
        } else {
            // Get template size for new stats
            const templates = await getFromStorage('templates', []);
            const template = templates.find(t => t.id === templateId);
            const sizeBytes = template ? JSON.stringify(template).length : 0;

            usageStats.push({
                templateId,
                lastUsed: now,
                useCount: 1,
                sizeBytes
            });
        }

        await saveToStorageInternal({ templateUsageStats: usageStats });
    } catch (error) {
        console.error('Error updating template usage stats:', error);
    }
}

/**
 * Gets storage usage breakdown by data type.
 * @returns Promise resolving to usage breakdown
 */
export async function getStorageUsageBreakdown(): Promise<{[key: string]: number}> {
    try {
        const allData = await new Promise<{[key: string]: any}>((resolve, reject) => {
            // @ts-ignore
            chrome.storage.sync.get(null, (result) => {
                // @ts-ignore
                if (chrome.runtime.lastError) {
                    // @ts-ignore
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(result);
            });
        });

        const breakdown: {[key: string]: number} = {};
        
        for (const [key, value] of Object.entries(allData)) {
            try {
                const size = JSON.stringify(value).length;
                breakdown[key] = size;
            } catch (error) {
                console.error(`Error calculating size for key ${key}:`, error);
                breakdown[key] = 0;
            }
        }

        return breakdown;
    } catch (error) {
        console.error('Error getting storage usage breakdown:', error);
        return {};
    }
}
