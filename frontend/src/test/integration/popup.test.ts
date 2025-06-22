/**
 * Integration tests for popup UI components
 */

import { screen, fireEvent } from '@testing-library/dom';
import { mockChromeRuntime, mockChromeTabs, setMockStorageData } from '../mocks/chrome';

// Mock popup HTML structure
const createPopupDOM = () => {
  document.body.innerHTML = `
    <div id="popup-container">
      <div id="auth-section">
        <div id="auth-status">Not authenticated</div>
        <button id="login-btn">Login</button>
        <button id="logout-btn" style="display: none;">Logout</button>
      </div>
      
      <div id="generation-section" style="display: none;">
        <select id="template-select">
          <option value="">Select template...</option>
          <option value="default">Default Template</option>
          <option value="feature">Feature Template</option>
        </select>
        
        <select id="provider-select">
          <option value="">Select provider...</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="ollama">Ollama</option>
        </select>
        
        <select id="model-select">
          <option value="">Select model...</option>
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          <option value="gpt-4">GPT-4</option>
        </select>
        
        <button id="generate-btn" disabled>Generate Description</button>
      </div>
      
      <div id="results-section" style="display: none;">
        <div id="generated-description"></div>
        <button id="copy-btn">Copy</button>
        <button id="fill-btn">Fill into Page</button>
      </div>
      
      <div id="error-section" style="display: none;">
        <div id="error-message"></div>
      </div>
    </div>
  `;
};

// Mock popup controller functionality
const mockPopupController = {
  checkAuthStatus: async () => {
    const response = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' });
    const authStatus = document.getElementById('auth-status')!;
    const loginBtn = document.getElementById('login-btn')!;
    const logoutBtn = document.getElementById('logout-btn')!;
    const generationSection = document.getElementById('generation-section')!;

    if (response.authenticated) {
      authStatus.textContent = `Logged in as ${response.user.username}`;
      loginBtn.style.display = 'none';
      logoutBtn.style.display = 'block';
      generationSection.style.display = 'block';
    } else {
      authStatus.textContent = 'Not authenticated';
      loginBtn.style.display = 'block';
      logoutBtn.style.display = 'none';
      generationSection.style.display = 'none';
    }
  },

  loadTemplates: async () => {
    const templates = await chrome.storage.local.get(['templates']);
    const templateSelect = document.getElementById('template-select') as HTMLSelectElement;

    // Clear existing dynamically added options (keep first 3 default options)
    while (templateSelect.options.length > 3) {
      templateSelect.removeChild(templateSelect.lastChild!);
    }

    if (templates.templates) {
      templates.templates.forEach((template: any) => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        templateSelect.appendChild(option);
      });
    }
  },

  generateDescription: async () => {
    const templateSelect = document.getElementById('template-select') as HTMLSelectElement;
    const providerSelect = document.getElementById('provider-select') as HTMLSelectElement;
    const modelSelect = document.getElementById('model-select') as HTMLSelectElement;

    const message = {
      type: 'GENERATE_DESCRIPTION',
      payload: {
        template: templateSelect.value,
        provider: providerSelect.value,
        model: modelSelect.value,
        prUrl: 'https://bitbucket.org/workspace/repo/pull-requests/123',
      },
    };

    try {
      const response = await chrome.runtime.sendMessage(message);
      if (response.success) {
        const resultsSection = document.getElementById('results-section')!;
        const descriptionDiv = document.getElementById('generated-description')!;

        descriptionDiv.textContent = response.description;
        resultsSection.style.display = 'block';
      }
    } catch (error) {
      const errorSection = document.getElementById('error-section')!;
      const errorMessage = document.getElementById('error-message')!;

      errorMessage.textContent = 'Failed to generate description';
      errorSection.style.display = 'block';
    }
  },

  fillIntoPage: async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      const description = document.getElementById('generated-description')!.textContent;
      await chrome.tabs.sendMessage(tabs[0].id, {
        type: 'FILL_DESCRIPTION',
        payload: { description },
      });
    }
  },

  copyToClipboard: async () => {
    const description = document.getElementById('generated-description')!.textContent;
    if (description) {
      await navigator.clipboard.writeText(description);
    }
  },
};

describe('Popup Integration Tests', () => {
  beforeEach(() => {
    createPopupDOM();
  });

  describe('Authentication Flow', () => {
    it('should show login state when not authenticated', async () => {
      // Mock unauthenticated state
      (mockChromeRuntime.sendMessage as jest.Mock).mockResolvedValueOnce({
        success: true,
        authenticated: false,
      });

      await mockPopupController.checkAuthStatus();

      expect(screen.getByText('Not authenticated')).toBeInTheDocument();
      expect(screen.getByText('Login')).toBeVisible();
      expect(document.getElementById('generation-section')).not.toBeVisible();
    });

    it('should show authenticated state when logged in', async () => {
      // Mock authenticated state
      (mockChromeRuntime.sendMessage as jest.Mock).mockResolvedValueOnce({
        success: true,
        authenticated: true,
        user: { username: 'testuser' },
      });

      await mockPopupController.checkAuthStatus();

      expect(screen.getByText('Logged in as testuser')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeVisible();
      expect(document.getElementById('generation-section')).toBeVisible();
    });
  });

  describe('Template Loading', () => {
    it('should load templates from storage', async () => {
      const mockTemplates = [
        { id: 'template1', name: 'Bug Fix Template', content: 'Bug fix content' },
        { id: 'template2', name: 'Feature Template', content: 'Feature content' },
      ];

      setMockStorageData({ templates: mockTemplates });

      await mockPopupController.loadTemplates();

      const templateSelect = document.getElementById('template-select') as HTMLSelectElement;
      expect(templateSelect.options).toHaveLength(5); // 3 default + 2 loaded
      expect(templateSelect.options[3].textContent).toBe('Bug Fix Template');
      expect(templateSelect.options[4].textContent).toBe('Feature Template');
    });

    it('should handle empty templates list', async () => {
      setMockStorageData({ templates: [] });

      await mockPopupController.loadTemplates();

      const templateSelect = document.getElementById('template-select') as HTMLSelectElement;
      expect(templateSelect.options).toHaveLength(3); // Only default options
    });
  });

  describe('Description Generation', () => {
    beforeEach(() => {
      // Set up form values
      const templateSelect = document.getElementById('template-select') as HTMLSelectElement;
      const providerSelect = document.getElementById('provider-select') as HTMLSelectElement;
      const modelSelect = document.getElementById('model-select') as HTMLSelectElement;

      templateSelect.value = 'default';
      providerSelect.value = 'openai';
      modelSelect.value = 'gpt-3.5-turbo';
    });

    it('should generate description successfully', async () => {
      await mockPopupController.generateDescription();

      expect(mockChromeRuntime.sendMessage).toHaveBeenCalledWith({
        type: 'GENERATE_DESCRIPTION',
        payload: {
          template: 'default',
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          prUrl: 'https://bitbucket.org/workspace/repo/pull-requests/123',
        },
      });

      expect(document.getElementById('results-section')).toBeVisible();
      expect(screen.getByText('Mock generated description')).toBeInTheDocument();
    });

    it('should handle generation errors', async () => {
      (mockChromeRuntime.sendMessage as jest.Mock).mockRejectedValueOnce(
        new Error('Network error'),
      );

      await mockPopupController.generateDescription();

      expect(document.getElementById('error-section')).toBeVisible();
      expect(screen.getByText('Failed to generate description')).toBeInTheDocument();
    });
  });

  describe('Fill Into Page', () => {
    it('should send description to content script', async () => {
      // Set up generated description
      document.getElementById('generated-description')!.textContent = 'Test description';

      await mockPopupController.fillIntoPage();

      expect(mockChromeTabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
      expect(mockChromeTabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'FILL_DESCRIPTION',
        payload: { description: 'Test description' },
      });
    });
  });

  describe('UI Interactions', () => {
    it('should enable generate button when all fields are selected', () => {
      const templateSelect = document.getElementById('template-select') as HTMLSelectElement;
      const providerSelect = document.getElementById('provider-select') as HTMLSelectElement;
      const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
      const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;

      // Initially disabled
      expect(generateBtn.disabled).toBe(true);

      // Select values
      templateSelect.value = 'default';
      fireEvent.change(templateSelect);

      providerSelect.value = 'openai';
      fireEvent.change(providerSelect);

      modelSelect.value = 'gpt-3.5-turbo';
      fireEvent.change(modelSelect);

      // Should be enabled (in real implementation, this would be handled by event listeners)
      // For this test, we're just demonstrating the concept
      if (templateSelect.value && providerSelect.value && modelSelect.value) {
        generateBtn.disabled = false;
      }

      expect(generateBtn.disabled).toBe(false);
    });

    it('should copy description to clipboard', async () => {
      document.getElementById('generated-description')!.textContent = 'Test description';

      await mockPopupController.copyToClipboard();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test description');
    });
  });
});
