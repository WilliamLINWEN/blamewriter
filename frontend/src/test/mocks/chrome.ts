/**
 * Chrome Extension API Mocks for Testing
 * Provides comprehensive mocks for all Chrome extension APIs used in the project
 */

export interface ChromeMockStorage {
  [key: string]: any;
}

// Mock storage for chrome.storage.local
const mockStorage: ChromeMockStorage = {};

// Mock for chrome.storage
export const mockChromeStorage = {
  local: {
    get: jest.fn((keys?: string | string[] | null, callback?: (items: ChromeMockStorage) => void) => {
      const result: ChromeMockStorage = {};
      
      if (keys === null || keys === undefined) {
        // Return all items
        Object.assign(result, mockStorage);
      } else if (typeof keys === 'string') {
        // Single key
        if (keys in mockStorage) {
          result[keys] = mockStorage[keys];
        }
      } else if (Array.isArray(keys)) {
        // Array of keys - if empty array, return all items
        if (keys.length === 0) {
          Object.assign(result, mockStorage);
        } else {
          keys.forEach(key => {
            if (key in mockStorage) {
              result[key] = mockStorage[key];
            }
          });
        }
      } else if (typeof keys === 'object') {
        // Object with default values
        Object.keys(keys).forEach(key => {
          result[key] = mockStorage[key] !== undefined ? mockStorage[key] : keys[key];
        });
      }

      if (callback) {
        setTimeout(() => callback(result), 0);
      }
      return Promise.resolve(result);
    }),

    set: jest.fn((items: ChromeMockStorage, callback?: () => void) => {
      Object.assign(mockStorage, items);
      if (callback) {
        setTimeout(callback, 0);
      }
      return Promise.resolve();
    }),

    remove: jest.fn((keys: string | string[], callback?: () => void) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(key => {
        delete mockStorage[key];
      });
      if (callback) {
        setTimeout(callback, 0);
      }
      return Promise.resolve();
    }),

    clear: jest.fn((callback?: () => void) => {
      Object.keys(mockStorage).forEach(key => {
        delete mockStorage[key];
      });
      if (callback) {
        setTimeout(callback, 0);
      }
      return Promise.resolve();
    }),

    getBytesInUse: jest.fn(() => Promise.resolve(0)),
  },
  
  // Add onChanged listener mock
  onChanged: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn()
  }
};

// Mock for chrome.runtime
export const mockChromeRuntime = {
  sendMessage: jest.fn((message: any, callback?: (response: any) => void) => {
    // Mock response based on message type
    let mockResponse: any = { success: true };
    
    if (message.type === 'GENERATE_DESCRIPTION') {
      mockResponse = {
        success: true,
        description: 'Mock generated description',
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      };
    } else if (message.type === 'GET_AUTH_STATUS') {
      mockResponse = {
        success: true,
        authenticated: true,
        user: { username: 'testuser' }
      };
    }

    if (callback) {
      setTimeout(() => callback(mockResponse), 0);
    }
    return Promise.resolve(mockResponse);
  }),

  connect: jest.fn(() => ({
    postMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onDisconnect: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  })),

  onMessage: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn()
  },

  onConnect: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  },

  getURL: jest.fn((path: string) => `chrome-extension://mock-extension-id/${path}`),
  
  id: 'mock-extension-id',
  
  getManifest: jest.fn(() => ({
    manifest_version: 3,
    name: 'Mock Extension',
    version: '1.0.0'
  }))
};

// Mock for chrome.tabs
export const mockChromeTabs = {
  query: jest.fn((queryInfo: chrome.tabs.QueryInfo, callback?: (tabs: chrome.tabs.Tab[]) => void) => {
    const mockTab: chrome.tabs.Tab = {
      id: 1,
      index: 0,
      windowId: 1,
      highlighted: true,
      active: true,
      pinned: false,
      url: 'https://bitbucket.org/workspace/repo/pull-requests/123',
      title: 'Test PR - Bitbucket',
      favIconUrl: undefined,
      status: 'complete',
      incognito: false,
      selected: true,
      audible: false,
      discarded: false,
      autoDiscardable: true,
      mutedInfo: { muted: false },
      width: 1200,
      height: 800
    };

    const result = [mockTab];
    if (callback) {
      setTimeout(() => callback(result), 0);
    }
    return Promise.resolve(result);
  }),

  sendMessage: jest.fn((tabId: number, message: any, callback?: (response: any) => void) => {
    const mockResponse = { success: true };
    if (callback) {
      setTimeout(() => callback(mockResponse), 0);
    }
    return Promise.resolve(mockResponse);
  }),

  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  
  onUpdated: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  },

  onActivated: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  }
};

// Mock for chrome.action (Manifest V3)
export const mockChromeAction = {
  setBadgeText: jest.fn(),
  setBadgeBackgroundColor: jest.fn(),
  setIcon: jest.fn(),
  setTitle: jest.fn(),
  setPopup: jest.fn(),
  
  onClicked: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  }
};

// Complete Chrome mock object
export const mockChrome = {
  storage: mockChromeStorage,
  runtime: mockChromeRuntime,
  tabs: mockChromeTabs,
  action: mockChromeAction
};

// Helper function to clear storage data
export const clearMockStorageData = () => {
  Object.keys(mockStorage).forEach(key => {
    delete mockStorage[key];
  });
};

// Helper function to reset all mocks
export const resetChromeMocks = () => {
  // Clear storage
  clearMockStorageData();

  // Reset all Jest mocks
  Object.values(mockChromeStorage.local).forEach(fn => {
    if (jest.isMockFunction(fn)) {
      fn.mockClear();
    }
  });

  Object.values(mockChromeRuntime).forEach(fn => {
    if (jest.isMockFunction(fn)) {
      fn.mockClear();
    }
  });

  Object.values(mockChromeTabs).forEach(fn => {
    if (jest.isMockFunction(fn)) {
      fn.mockClear();
    }
  });

  Object.values(mockChromeAction).forEach(fn => {
    if (jest.isMockFunction(fn)) {
      fn.mockClear();
    }
  });
};

// Helper function to set storage data for tests
export const setMockStorageData = (data: ChromeMockStorage) => {
  Object.assign(mockStorage, data);
};

// Helper function to get current storage data
export const getMockStorageData = (): ChromeMockStorage => {
  return { ...mockStorage };
};