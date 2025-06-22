/**
 * Unit tests for Chrome extension messaging system
 */

import { mockChromeRuntime, mockChromeTabs } from '../mocks/chrome';

// Mock message types (these would be imported from actual message definitions)
interface GenerateDescriptionMessage {
  type: 'GENERATE_DESCRIPTION';
  payload: {
    prUrl: string;
    template: string;
    provider: string;
    model: string;
  };
}

interface AuthStatusMessage {
  type: 'GET_AUTH_STATUS';
}

describe('Chrome Extension Messaging', () => {
  describe('runtime.sendMessage', () => {
    it('should send message and receive response', async () => {
      const message: GenerateDescriptionMessage = {
        type: 'GENERATE_DESCRIPTION',
        payload: {
          prUrl: 'https://bitbucket.org/workspace/repo/pull-requests/123',
          template: 'Default template',
          provider: 'openai',
          model: 'gpt-3.5-turbo',
        },
      };

      const response = await chrome.runtime.sendMessage(message);

      expect(mockChromeRuntime.sendMessage).toHaveBeenCalledWith(message);
      expect(response).toEqual({
        success: true,
        description: 'Mock generated description',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
      });
    });

    it('should handle auth status requests', async () => {
      const message: AuthStatusMessage = {
        type: 'GET_AUTH_STATUS',
      };

      const response = await chrome.runtime.sendMessage(message);

      expect(mockChromeRuntime.sendMessage).toHaveBeenCalledWith(message);
      expect(response).toEqual({
        success: true,
        authenticated: true,
        user: { username: 'testuser' },
      });
    });

    it('should handle message with callback', done => {
      const message = { type: 'TEST_MESSAGE' };

      chrome.runtime.sendMessage(message, response => {
        expect(response).toEqual({ success: true });
        done();
      });

      expect(mockChromeRuntime.sendMessage).toHaveBeenCalledWith(message, expect.any(Function));
    });
  });

  describe('tabs.sendMessage', () => {
    it('should send message to specific tab', async () => {
      const tabId = 1;
      const message = {
        type: 'FILL_DESCRIPTION',
        payload: {
          description: 'Generated PR description',
        },
      };

      const response = await chrome.tabs.sendMessage(tabId, message);

      expect(mockChromeTabs.sendMessage).toHaveBeenCalledWith(tabId, message);
      expect(response).toEqual({ success: true });
    });

    it('should handle tab message with callback', done => {
      const tabId = 1;
      const message = { type: 'PING' };

      chrome.tabs.sendMessage(tabId, message, response => {
        expect(response).toEqual({ success: true });
        done();
      });

      expect(mockChromeTabs.sendMessage).toHaveBeenCalledWith(tabId, message, expect.any(Function));
    });
  });

  describe('message listeners', () => {
    it('should add message listener', () => {
      const listener = jest.fn();

      chrome.runtime.onMessage.addListener(listener);

      expect(mockChromeRuntime.onMessage.addListener).toHaveBeenCalledWith(listener);
    });

    it('should remove message listener', () => {
      const listener = jest.fn();

      chrome.runtime.onMessage.removeListener(listener);

      expect(mockChromeRuntime.onMessage.removeListener).toHaveBeenCalledWith(listener);
    });

    it('should check if listener exists', () => {
      const listener = jest.fn();

      chrome.runtime.onMessage.hasListener(listener);

      expect(mockChromeRuntime.onMessage.hasListener).toHaveBeenCalledWith(listener);
    });
  });

  describe('port connections', () => {
    it('should create port connection', () => {
      const port = chrome.runtime.connect();

      expect(mockChromeRuntime.connect).toHaveBeenCalled();
      expect(port).toHaveProperty('postMessage');
      expect(port).toHaveProperty('onMessage');
      expect(port).toHaveProperty('onDisconnect');
    });

    it('should post message through port', () => {
      const port = chrome.runtime.connect();
      const message = { type: 'STREAM_MESSAGE', data: 'test' };

      port.postMessage(message);

      expect(port.postMessage).toHaveBeenCalledWith(message);
    });
  });
});
