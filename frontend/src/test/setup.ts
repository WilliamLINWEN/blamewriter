/**
 * Jest Test Setup for Frontend Browser Extension
 * Sets up Chrome extension mocks and Testing Library
 */

import '@testing-library/jest-dom';
import { mockChrome, resetChromeMocks } from './mocks/chrome';

// Mock Chrome APIs globally
(global as any).chrome = mockChrome;

// Mock window.chrome as well (some code might use this)
Object.defineProperty(window, 'chrome', {
  value: mockChrome,
  writable: true,
});

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock console methods to reduce noise in tests
const originalConsole = console;
beforeEach(() => {
  if (process.env.JEST_VERBOSE !== 'true') {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
    console.error = originalConsole.error; // Keep errors visible
  }
});

afterEach(() => {
  // Reset Chrome mocks after each test
  resetChromeMocks();

  // Reset fetch mock
  if (jest.isMockFunction(global.fetch)) {
    (global.fetch as jest.Mock).mockClear();
  }

  // Restore console
  if (process.env.JEST_VERBOSE !== 'true') {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    console.error = originalConsole.error;
  }
});

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve('mock clipboard text')),
  },
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Export mock utilities for use in tests
export { mockChrome, resetChromeMocks } from './mocks/chrome';
export { localStorageMock, sessionStorageMock };
