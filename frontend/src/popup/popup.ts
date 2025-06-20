// Popup script for Bitbucket PR Helper extension - Phase 3 OAuth Implementation

import { Template, UserLLMConfig, LLMProvider as LLMProviderDef } from '../common/storage_schema';
import { getFromStorage, updateTemplateUsageStats } from '../common/storage_utils';

interface BitbucketPRInfo {
  workspace: string;
  repo: string;
  prId: string;
  fullUrl: string;
}

interface GenerateRequest {
  action: 'generate';
  prUrl: string;
  templateContent: string;
  llmConfig: {
    providerId: string;
    modelId: string;
    customEndpoint: string | null;
  };
}

interface GenerateResponse {
  description?: string;
  error?: string;
}

// interface OAuthRequest {
//   action: 'oauth_authenticate' | 'oauth_get_status' | 'oauth_logout';
// }

interface OAuthResponse {
  success: boolean;
  authenticated?: boolean;
  userInfo?: any;
  error?: string;
}

// interface AuthenticateRequest {
//   action: 'authenticate';
// }
//
// interface AuthenticateResponse {
//   success: boolean;
//   userInfo?: any;
//   error?: string;
// }

class PopupController {
  private generateButton!: HTMLButtonElement;
  private resultTextarea!: HTMLTextAreaElement;
  private statusMessage!: HTMLElement;
  private actionButtons!: HTMLElement;
  private copyButton!: HTMLButtonElement;
  private fillButton!: HTMLButtonElement;
  private loadingSpinner!: HTMLElement;
  private buttonText!: HTMLElement;
  private optionsButton!: HTMLButtonElement;
  private authStatus!: HTMLElement;

  private templateSelect!: HTMLSelectElement;
  private availableTemplates: Template[] = [];

  private llmProviderSelect!: HTMLSelectElement;
  private llmModelSelect!: HTMLSelectElement;
  private availableLLMProviders: LLMProviderDef[] = [];
  private currentUserLLMConfig: UserLLMConfig | null = null;

  // Authentication state
  private isAuthenticated = false;
  private isCheckingAuth = true;
  private userInfo: any = null;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.initializeState();
    this.setupStorageListeners();
    this.checkAuthenticationStatus();
  }

  private initializeElements(): void {
    this.generateButton = document.getElementById('generate-btn') as HTMLButtonElement;
    this.resultTextarea = document.getElementById('result-textarea') as HTMLTextAreaElement;
    this.statusMessage = document.getElementById('status-message') as HTMLElement;
    this.actionButtons = document.querySelector('.action-buttons') as HTMLElement;
    this.copyButton = document.getElementById('copy-btn') as HTMLButtonElement;
    this.fillButton = document.getElementById('fill-btn') as HTMLButtonElement;
    this.loadingSpinner = document.querySelector(
      '.generate-button .loading-spinner',
    ) as HTMLElement;
    this.buttonText = document.querySelector('.btn-text') as HTMLElement;
    this.optionsButton = document.getElementById('options-btn') as HTMLButtonElement;
    this.templateSelect = document.getElementById('popup-template-select') as HTMLSelectElement;
    this.llmProviderSelect = document.getElementById(
      'popup-llm-provider-select',
    ) as HTMLSelectElement;
    this.llmModelSelect = document.getElementById('popup-llm-model-select') as HTMLSelectElement;
    this.authStatus = document.getElementById('auth-status') as HTMLElement;

    console.log('🔍 Element initialization check:', {
      generateButton: !!this.generateButton,
      loadingSpinner: !!this.loadingSpinner,
      buttonText: !!this.buttonText,
      templateSelect: !!this.templateSelect,
      llmProviderSelect: !!this.llmProviderSelect,
      llmModelSelect: !!this.llmModelSelect,
      authStatus: !!this.authStatus,
    });

    if (
      !this.generateButton ||
      !this.resultTextarea ||
      !this.statusMessage ||
      !this.optionsButton ||
      !this.templateSelect ||
      !this.llmProviderSelect ||
      !this.llmModelSelect ||
      !this.authStatus
    ) {
      console.error('Required DOM elements not found');
      this.showError('Interface initialization failed.');
    }
  }

  private setupEventListeners(): void {
    this.generateButton.addEventListener('click', () => this.handleGenerateClick());
    if (this.copyButton) {
      this.copyButton.addEventListener('click', () => this.copyToClipboard());
    }
    if (this.fillButton) {
      this.fillButton.addEventListener('click', () => this.fillIntoPage());
    }

    if (this.optionsButton) {
      this.optionsButton.addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL('options/options.html'));
        }
      });
    }

    if (this.llmProviderSelect) {
      this.llmProviderSelect.addEventListener('change', () => {
        if (this.currentUserLLMConfig) {
          this.currentUserLLMConfig.providerId = this.llmProviderSelect.value || null;
          this.currentUserLLMConfig.selectedModelId = null;
        } else {
          this.currentUserLLMConfig = {
            providerId: this.llmProviderSelect.value || null,
            selectedModelId: null,
            customEndpoint: null,
          };
        }
        this.renderLLMModelSelection();
        this.updateGenerateButtonState();
      });
    }

    if (this.llmModelSelect) {
      this.llmModelSelect.addEventListener('change', () => {
        if (this.currentUserLLMConfig) {
          this.currentUserLLMConfig.selectedModelId = this.llmModelSelect.value || null;
        }
        this.updateGenerateButtonState();
      });
    }

    if (this.templateSelect) {
      this.templateSelect.addEventListener('change', () => this.updateGenerateButtonState());
    }
  }

  private initializeState(): void {
    this.checkCurrentPage();
    this.updateGenerateButtonState();
    this.hideActionButtons();
    this.clearStatus();
    this.loadAndRenderTemplates();
    this.loadAndRenderLLMConfig();
  }

  private setupStorageListeners(): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') {
        return;
      }
      console.log("Popup: Storage changed in 'sync' area:", changes);

      if (changes.userLLMConfig) {
        console.log('Popup: UserLLMConfig changed. Reloading LLM config for popup.');
        this.loadAndRenderLLMConfig().catch(err =>
          console.error('Popup: Error reloading LLM config on change:', err),
        );
      }
      if (changes.templates) {
        console.log('Popup: Templates changed. Reloading templates for popup.');
        this.loadAndRenderTemplates().catch(err =>
          console.error('Popup: Error reloading templates on change:', err),
        );
      }
    });
  }

  // ========================
  // Authentication Methods
  // ========================

  private async checkAuthenticationStatus(): Promise<void> {
    try {
      this.isCheckingAuth = true;
      this.updateAuthStatus();

      const response = (await this.sendMessageToBackground({
        action: 'oauth_get_status',
      })) as OAuthResponse;

      this.isCheckingAuth = false;

      if (response.success) {
        this.isAuthenticated = response.authenticated || false;
        this.userInfo = response.userInfo;
      } else {
        this.isAuthenticated = false;
        this.userInfo = null;
        console.error('Failed to check auth status:', response.error);
      }

      this.updateAuthStatus();
      this.updateGenerateButtonState();
    } catch (error) {
      console.error('Error checking authentication status:', error);
      this.isCheckingAuth = false;
      this.isAuthenticated = false;
      this.updateAuthStatus();
      this.updateGenerateButtonState();
    }
  }

  private async authenticateUser(): Promise<void> {
    try {
      console.log('🔐 Starting authentication...');

      this.isCheckingAuth = true;
      this.updateAuthStatus();

      const response = (await this.sendMessageToBackground({
        action: 'oauth_authenticate',
      })) as OAuthResponse;

      this.isCheckingAuth = false;

      if (response.success && response.authenticated) {
        this.isAuthenticated = true;
        this.userInfo = response.userInfo;
        console.log('✅ Authentication successful');
        this.showSuccess('Successfully authenticated with Bitbucket!');
      } else {
        this.isAuthenticated = false;
        this.userInfo = null;
        const errorMsg = response.error || 'Authentication failed';
        console.error('❌ Authentication failed:', errorMsg);
        this.showError(`Authentication failed: ${errorMsg}`);
      }

      this.updateAuthStatus();
      this.updateGenerateButtonState();
    } catch (error) {
      console.error('Authentication error:', error);
      this.isCheckingAuth = false;
      this.isAuthenticated = false;
      this.showError(
        `Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.updateAuthStatus();
      this.updateGenerateButtonState();
    }
  }

  private async logoutUser(): Promise<void> {
    try {
      const response = (await this.sendMessageToBackground({
        action: 'oauth_logout',
      })) as OAuthResponse;

      if (response.success) {
        this.isAuthenticated = false;
        this.userInfo = null;
        this.showSuccess('Successfully logged out');
      } else {
        this.showError(`Logout failed: ${response.error || 'Unknown error'}`);
      }

      this.updateAuthStatus();
      this.updateGenerateButtonState();
    } catch (error) {
      console.error('Logout error:', error);
      this.showError(`Logout error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private updateAuthStatus(): void {
    if (!this.authStatus) {
      return;
    }

    // Clear previous content
    this.authStatus.innerHTML = '';
    this.authStatus.className = 'auth-status';

    if (this.isCheckingAuth) {
      this.authStatus.classList.add('checking');
      this.authStatus.innerHTML = `
        <div class="auth-checking">
          <div class="loading-spinner"></div>
          <span>Checking authentication...</span>
        </div>
      `;
    } else if (this.isAuthenticated) {
      this.authStatus.classList.add('authenticated');
      const username = this.userInfo?.username || 'Unknown User';
      this.authStatus.innerHTML = `
        <div class="auth-message">✅ Authenticated as <strong>${username}</strong></div>
        <button class="auth-login-button" id="logout-btn" style="background-color: #de350b;">Logout</button>
      `;

      // Add logout button listener
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => this.logoutUser());
      }
    } else {
      this.authStatus.classList.add('unauthenticated');
      this.authStatus.innerHTML = `
        <div class="auth-message">🔐 Authentication required to generate PR descriptions</div>
        <button class="auth-login-button" id="login-btn">Login with Bitbucket</button>
      `;

      // Add login button listener
      const loginBtn = document.getElementById('login-btn');
      if (loginBtn) {
        loginBtn.addEventListener('click', () => this.authenticateUser());
      }
    }
  }

  // ========================
  // Validation and State Management
  // ========================

  private updateGenerateButtonState(): void {
    if (!this.generateButton) {
      return;
    }

    console.log('🔄 updateGenerateButtonState called');
    console.log('🔍 Auth state:', {
      isAuthenticated: this.isAuthenticated,
      isCheckingAuth: this.isCheckingAuth,
      userInfo: this.userInfo,
    });

    // Check authentication
    if (!this.isAuthenticated) {
      this.generateButton.disabled = true;
      this.generateButton.title = 'Please authenticate with Bitbucket first';
      console.log('❌ Button disabled: Not authenticated');
      return;
    }

    // Check if we're on a valid PR page
    if (!this.isValidBitbucketPRPage()) {
      this.generateButton.disabled = true;
      this.generateButton.title = 'Please navigate to a Bitbucket Pull Request page';
      console.log('❌ Button disabled: Invalid PR page');
      return;
    }

    // Check template selection
    const selectedTemplate = this.templateSelect?.value;
    if (!selectedTemplate) {
      this.generateButton.disabled = true;
      this.generateButton.title = 'Please select a template';
      console.log('❌ Button disabled: No template selected');
      return;
    }

    // Check LLM configuration
    const hasValidLLMConfig =
      this.currentUserLLMConfig &&
      this.currentUserLLMConfig.providerId &&
      this.currentUserLLMConfig.selectedModelId;

    if (!hasValidLLMConfig) {
      this.generateButton.disabled = true;
      this.generateButton.title = 'Please select an LLM provider and model';
      console.log('❌ Button disabled: Invalid LLM config');
      return;
    }

    // All checks passed
    this.generateButton.disabled = false;
    this.generateButton.title = 'Generate PR description using AI';
    console.log('✅ Button enabled: All checks passed');
  }

  private isValidBitbucketPRPage(): boolean {
    // We'll check the current URL when generating
    return true; // For now, assume valid until we check during generation
  }

  private validateGenerateRequest(): { isValid: boolean; error?: string } {
    // Check authentication
    if (!this.isAuthenticated) {
      return { isValid: false, error: 'Please authenticate with Bitbucket first' };
    }

    // Check template selection
    const selectedTemplate = this.templateSelect?.value;
    if (!selectedTemplate) {
      return { isValid: false, error: 'Please select a template' };
    }

    // Check LLM configuration
    const hasValidLLMConfig =
      this.currentUserLLMConfig &&
      this.currentUserLLMConfig.providerId &&
      this.currentUserLLMConfig.selectedModelId;

    if (!hasValidLLMConfig) {
      return { isValid: false, error: 'Please select an LLM provider and model' };
    }

    return { isValid: true };
  }

  private async handleGenerateClick(): Promise<void> {
    try {
      this.clearStatus();
      this.setLoadingState(true);

      // Validate authentication and form inputs
      const validation = this.validateGenerateRequest();
      if (!validation.isValid) {
        this.showError(validation.error!);
        this.setLoadingState(false);
        return;
      }

      // If not authenticated, trigger authentication first
      if (!this.isAuthenticated) {
        await this.authenticateUser();
        if (!this.isAuthenticated) {
          this.showError('Authentication required to generate PR descriptions');
          this.setLoadingState(false);
          return;
        }
      }

      // Check if we're on a valid PR page
      const currentUrl = await this.getCurrentTabUrl();
      if (!currentUrl) {
        this.showError('Could not get current page URL.');
        this.setLoadingState(false);
        return;
      }

      if (!this.isValidBitbucketPRUrl(currentUrl)) {
        this.showError('Please navigate to a Bitbucket PR page to use this feature.');
        this.setLoadingState(false);
        return;
      }

      const selectedTemplate = this.availableTemplates.find(
        t => t.id === this.templateSelect.value,
      );
      if (!selectedTemplate) {
        this.showError('Selected template not found.');
        this.setLoadingState(false);
        return;
      }

      if (!this.currentUserLLMConfig) {
        this.showError('LLM configuration not found.');
        this.setLoadingState(false);
        return;
      }

      const request: GenerateRequest = {
        action: 'generate',
        prUrl: currentUrl,
        templateContent: selectedTemplate.content,
        llmConfig: {
          providerId: this.currentUserLLMConfig.providerId!,
          modelId: this.currentUserLLMConfig.selectedModelId!,
          customEndpoint: this.currentUserLLMConfig.customEndpoint,
        },
      };

      console.log('Sending generate request...');
      const response = (await this.sendMessageToBackground(request)) as GenerateResponse;
      console.log('Generate response received:', response);

      if (response.description) {
        this.showSuccess('Description generated successfully!');
        this.displayResult(response.description);
        await updateTemplateUsageStats(selectedTemplate.id);
      } else {
        this.showError(response.error || 'Failed to generate description');
      }
    } catch (error) {
      console.error('Generate error:', error);
      this.showError('An unexpected error occurred');
    } finally {
      this.setLoadingState(false);
    }
  }

  private isValidBitbucketPRUrl(url: string): boolean {
    const prUrlPattern = /^https:\/\/bitbucket\.org\/[^/]+\/[^/]+\/pull-requests\/\d+/;
    return prUrlPattern.test(url);
  }

  // ========================
  // LLM Provider and Template Management
  // ========================

  private initializeLLMProviderData(): void {
    this.availableLLMProviders = [
      {
        id: 'openai',
        name: 'OpenAI',
        models: [
          { id: 'gpt-4o', name: 'GPT-4o' },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        ],
        requiresCustomEndpoint: false,
      },
      {
        id: 'anthropic',
        name: 'Anthropic (Claude)',
        models: [
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
          { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
          { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
        ],
        requiresCustomEndpoint: false,
      },
      {
        id: 'ollama',
        name: 'Ollama (Local)',
        models: [
          { id: 'llama3', name: 'Llama 3 (default)' },
          { id: 'codellama', name: 'CodeLlama' },
        ],
        requiresCustomEndpoint: true,
      },
    ];
  }

  private async loadAndRenderLLMConfig(): Promise<void> {
    if (!this.llmProviderSelect || !this.llmModelSelect) {
      return;
    }
    this.initializeLLMProviderData();

    this.llmProviderSelect.disabled = true;
    this.llmModelSelect.disabled = true;
    this.llmProviderSelect.innerHTML = '<option value="">-- Loading --</option>';
    this.llmModelSelect.innerHTML = '<option value="">-- Wait --</option>';

    try {
      this.currentUserLLMConfig = await getFromStorage('userLLMConfig', {
        providerId: null,
        selectedModelId: null,
        customEndpoint: null,
      });

      this.llmProviderSelect.innerHTML = '<option value="">-- Select Provider --</option>';
      this.availableLLMProviders.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        this.llmProviderSelect.appendChild(option);
      });

      if (this.currentUserLLMConfig && this.currentUserLLMConfig.providerId) {
        this.llmProviderSelect.value = this.currentUserLLMConfig.providerId;
      } else if (this.availableLLMProviders.length > 0 && this.availableLLMProviders[0]) {
        // Auto-select the first provider for better UX
        const firstProvider = this.availableLLMProviders[0];
        this.llmProviderSelect.value = firstProvider.id;
        this.currentUserLLMConfig = {
          providerId: firstProvider.id,
          selectedModelId: null,
          customEndpoint: null,
        };
        console.log('✅ Auto-selected first LLM provider:', firstProvider.name);
      }
      this.llmProviderSelect.disabled = false;
      this.renderLLMModelSelection();
      this.updateGenerateButtonState();
    } catch (error) {
      this.llmProviderSelect.innerHTML = '<option value="">-- Error --</option>';
      this.llmModelSelect.innerHTML = '<option value="">-- Error --</option>';
      this.showError('Failed to load LLM config.');
    }
  }

  private renderLLMModelSelection(): void {
    if (!this.llmModelSelect || !this.llmProviderSelect) {
      return;
    }
    const selectedProviderId = this.llmProviderSelect.value;
    const provider = this.availableLLMProviders.find(p => p.id === selectedProviderId);

    this.llmModelSelect.innerHTML = '';
    this.llmModelSelect.disabled = true;

    if (provider && provider.models && provider.models.length > 0) {
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '-- Select Model --';
      this.llmModelSelect.appendChild(defaultOpt);

      provider.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        this.llmModelSelect.appendChild(option);
      });

      if (
        this.currentUserLLMConfig &&
        this.currentUserLLMConfig.providerId === selectedProviderId &&
        this.currentUserLLMConfig.selectedModelId
      ) {
        if (provider.models.some(m => m.id === this.currentUserLLMConfig!.selectedModelId)) {
          this.llmModelSelect.value = this.currentUserLLMConfig.selectedModelId;
        }
      } else if (provider.models.length > 0 && provider.models[0]) {
        // Auto-select the first model for better UX
        const firstModel = provider.models[0];
        this.llmModelSelect.value = firstModel.id;
        if (this.currentUserLLMConfig) {
          this.currentUserLLMConfig.selectedModelId = firstModel.id;
        }
        console.log('✅ Auto-selected first model:', firstModel.name);
      }
      this.llmModelSelect.disabled = false;
    } else {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = selectedProviderId ? '-- No Models --' : '-- Select Provider --';
      this.llmModelSelect.appendChild(option);
    }
  }

  private async loadAndRenderTemplates(): Promise<void> {
    if (!this.templateSelect) {
      return;
    }

    this.templateSelect.disabled = true;
    this.templateSelect.innerHTML = '<option value="">-- Loading Templates --</option>';

    try {
      this.availableTemplates = await getFromStorage('templates', []);
      this.templateSelect.innerHTML = '';

      if (this.availableTemplates.length === 0) {
        this.templateSelect.innerHTML = '<option value="">-- No Templates Available --</option>';
        this.showError('No templates found. Please add templates in the options page.');
        return;
      }

      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '-- Select Template --';
      this.templateSelect.appendChild(defaultOption);

      this.availableTemplates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        this.templateSelect.appendChild(option);
      });

      // Auto-select the first template for better UX
      if (this.availableTemplates.length > 0 && this.availableTemplates[0]) {
        this.templateSelect.value = this.availableTemplates[0].id;
        console.log('✅ Auto-selected first template:', this.availableTemplates[0].name);
      }

      this.templateSelect.disabled = false;
      this.updateGenerateButtonState();
    } catch (error) {
      console.error('Failed to load templates:', error);
      this.templateSelect.innerHTML = '<option value="">-- Error Loading Templates --</option>';
      this.showError('Failed to load templates. Please try again.');
    }
  }

  // ========================
  // Utility Methods
  // ========================

  private async getCurrentTabUrl(): Promise<string | null> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs[0]?.url || null;
    } catch (error) {
      console.error('Error getting current tab URL:', error);
      return null;
    }
  }

  private async checkCurrentPage(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      if (!currentTab || !currentTab.url) {
        this.showError('Cannot access current page.');
        return;
      }

      const prInfo = this.extractPRInfoFromUrl(currentTab.url);
      if (!prInfo) {
        this.showInfo('Navigate to a Bitbucket PR page to generate descriptions.');
        return;
      }

      this.showInfo(`PR: ${prInfo.workspace}/${prInfo.repo}#${prInfo.prId}`);
    } catch (error) {
      this.showError('Error checking page.');
    }
  }

  private extractPRInfoFromUrl(url: string): BitbucketPRInfo | null {
    const prUrlPattern = /^https:\/\/bitbucket\.org\/([^/]+)\/([^/]+)\/pull-requests\/(\d+)/;
    const match = url.match(prUrlPattern);
    if (!match) {
      return null;
    }
    return {
      workspace: match[1]!,
      repo: match[2]!,
      prId: match[3]!,
      fullUrl: url,
    };
  }

  private async sendMessageToBackground(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  private displayResult(description: string): void {
    if (this.resultTextarea) {
      this.resultTextarea.value = description;
      this.showActionButtons();
    }
  }

  private showActionButtons(): void {
    if (this.actionButtons) {
      this.actionButtons.style.display = 'flex';
    }
  }

  private hideActionButtons(): void {
    if (this.actionButtons) {
      this.actionButtons.style.display = 'none';
    }
  }

  private async copyToClipboard(): Promise<void> {
    try {
      if (this.resultTextarea && this.resultTextarea.value) {
        await navigator.clipboard.writeText(this.resultTextarea.value);
        this.showSuccess('Description copied to clipboard!');
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      this.showError('Failed to copy to clipboard');
    }
  }

  private async fillIntoPage(): Promise<void> {
    try {
      if (!this.resultTextarea || !this.resultTextarea.value) {
        this.showError('No description to fill');
        return;
      }

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];

      if (!activeTab?.id) {
        this.showError('Cannot access current tab');
        return;
      }

      // Send message to content script to fill the description
      chrome.tabs.sendMessage(
        activeTab.id,
        {
          action: 'fillDescription',
          description: this.resultTextarea.value,
        },
        response => {
          if (chrome.runtime.lastError) {
            this.showError(
              'Failed to fill description. Please ensure you are on a Bitbucket PR page.',
            );
          } else if (response && response.success) {
            this.showSuccess('Description filled into page!');
          } else {
            this.showError('Failed to fill description into page');
          }
        },
      );
    } catch (error) {
      console.error('Error filling into page:', error);
      this.showError('Failed to fill description into page');
    }
  }

  private setLoadingState(loading: boolean): void {
    console.log('🔄 setLoadingState called with loading:', loading);
    console.log('🔍 Elements check:', {
      generateButton: !!this.generateButton,
      loadingSpinner: !!this.loadingSpinner,
      buttonText: !!this.buttonText,
    });

    if (this.generateButton && this.loadingSpinner && this.buttonText) {
      if (loading) {
        this.generateButton.disabled = true;
        this.loadingSpinner.style.display = 'block';
        this.buttonText.textContent = 'Generating...';
        console.log('✅ Loading state set to true');
      } else {
        this.updateGenerateButtonState(); // This will handle the disabled state properly
        this.loadingSpinner.style.display = 'none';
        this.buttonText.textContent = 'Generate Description';
        console.log('✅ Loading state set to false');
      }
    } else {
      console.error('❌ setLoadingState: Missing required elements');
    }
  }

  private showError(message: string): void {
    if (this.statusMessage) {
      this.statusMessage.textContent = message;
      this.statusMessage.className = 'status-message error';
      this.statusMessage.style.display = 'block';
    }
  }

  private showSuccess(message: string): void {
    if (this.statusMessage) {
      this.statusMessage.textContent = message;
      this.statusMessage.className = 'status-message success';
      this.statusMessage.style.display = 'block';
    }
  }

  private showInfo(message: string): void {
    if (this.statusMessage) {
      this.statusMessage.textContent = message;
      this.statusMessage.className = 'status-message info';
      this.statusMessage.style.display = 'block';
    }
  }

  private clearStatus(): void {
    if (this.statusMessage) {
      this.statusMessage.textContent = '';
      this.statusMessage.className = 'status-message';
      this.statusMessage.style.display = 'none';
    }
  }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM loaded, initializing controller...');
  new PopupController();
});

// Export for testing purposes
export { PopupController };
