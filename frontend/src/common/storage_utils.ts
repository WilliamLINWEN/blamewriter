// frontend/src/common/storage_utils.ts
import { ExtensionStorage } from './storage_schema'; // To allow type hints for keys

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
 * Saves one or more items to chrome.storage.sync.
 * @param items An object containing one or more key/value pairs to save.
 * @returns A promise that resolves when the items have been saved or rejects on error.
 */
export async function saveToStorage(items: Partial<ExtensionStorage>): Promise<void> {
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
