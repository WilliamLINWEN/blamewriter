/**
 * Unit tests for Chrome extension storage utilities
 */

import { mockChromeStorage, setMockStorageData, getMockStorageData, clearMockStorageData } from '../mocks/chrome';

// Mock implementation of storage utilities (these would be imported from actual files)
const mockSaveToStorage = async (data: Record<string, any>): Promise<void> => {
  await chrome.storage.local.set(data);
};

const mockLoadFromStorage = async (keys: string[]): Promise<Record<string, any>> => {
  const result = await chrome.storage.local.get(keys);
  return result;
};

describe('Chrome Storage Utilities', () => {
  beforeEach(() => {
    // Clear storage before each test
    clearMockStorageData();
  });

  describe('saveToStorage', () => {
    it('should save data to chrome storage', async () => {
      const testData = {
        templates: [{ id: '1', name: 'Test Template', content: 'Test content' }],
        selectedProvider: 'openai'
      };

      await mockSaveToStorage(testData);

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith(testData);
      expect(getMockStorageData()).toEqual(testData);
    });

    it('should handle empty data', async () => {
      const emptyData = {};

      await mockSaveToStorage(emptyData);

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith(emptyData);
    });
  });

  describe('loadFromStorage', () => {
    it('should load data from chrome storage', async () => {
      const testData = {
        templates: [{ id: '1', name: 'Test Template' }],
        authStatus: { authenticated: true }
      };
      
      setMockStorageData(testData);

      const result = await mockLoadFromStorage(['templates', 'authStatus']);

      expect(mockChromeStorage.local.get).toHaveBeenCalledWith(['templates', 'authStatus']);
      expect(result).toEqual(testData);
    });

    it('should return empty object for non-existent keys', async () => {
      const result = await mockLoadFromStorage(['nonExistentKey']);

      expect(result).toEqual({});
    });

    it('should load all data when no keys specified', async () => {
      const testData = { key1: 'value1', key2: 'value2' };
      setMockStorageData(testData);

      const result = await mockLoadFromStorage([]);

      expect(result).toEqual(testData);
    });
  });

  describe('Chrome Storage API Integration', () => {
    it('should handle storage changes', () => {
      const listener = jest.fn();
      chrome.storage.onChanged.addListener(listener);

      expect(chrome.storage.onChanged.addListener).toHaveBeenCalledWith(listener);
    });

    it('should remove storage data', async () => {
      setMockStorageData({ key1: 'value1', key2: 'value2' });

      await chrome.storage.local.remove('key1');

      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith('key1');
    });

    it('should clear all storage data', async () => {
      setMockStorageData({ key1: 'value1', key2: 'value2' });

      await chrome.storage.local.clear();

      expect(mockChromeStorage.local.clear).toHaveBeenCalled();
    });
  });
});