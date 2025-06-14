// Popup script for Bitbucket PR Helper extension

interface BitbucketPRInfo {
  workspace: string;
  repo: string;
  prId: string;
  fullUrl: string;
}

// Updated GenerateRequest interface
interface GenerateRequest {
  action: 'generate';
  prUrl: string; // Changed from 'url'
  token: string;

  templateContent: string;
  llmConfig: {
    providerId: string;
    modelId: string;
    apiKey: string | null;
    customEndpoint: string | null;
  };
}

interface GenerateResponse {
  description?: string;
  error?: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
}

interface ModelDetail { id: string; name: string; }
interface LLMProviderDef {
    id: string;
    name: string;
    models: ModelDetail[];
}
interface UserLLMConfig {
    providerId: string | null;
    apiKey: string | null;
    selectedModelId: string | null;
    customEndpoint: string | null;
}

class PopupController {
  private tokenInput!: HTMLInputElement;
  private generateButton!: HTMLButtonElement;
  private resultTextarea!: HTMLTextAreaElement;
  private statusMessage!: HTMLElement;
  private actionButtons!: HTMLElement;
  private copyButton!: HTMLButtonElement;
  private fillButton!: HTMLButtonElement;
  private loadingSpinner!: HTMLElement;
  private buttonText!: HTMLElement;
  private optionsButton!: HTMLButtonElement;

  private templateSelect!: HTMLSelectElement;
  private availableTemplates: Template[] = [];

  private llmProviderSelect!: HTMLSelectElement;
  private llmModelSelect!: HTMLSelectElement;
  private availableLLMProviders: LLMProviderDef[] = [];
  private currentUserLLMConfig: UserLLMConfig | null = null;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.initializeState();
  }

  private initializeElements(): void {
    this.tokenInput = document.getElementById('bitbucket-token') as HTMLInputElement;
    this.generateButton = document.getElementById('generate-btn') as HTMLButtonElement;
    this.resultTextarea = document.getElementById('result-textarea') as HTMLTextAreaElement;
    this.statusMessage = document.getElementById('status-message') as HTMLElement;
    this.actionButtons = document.querySelector('.action-buttons') as HTMLElement;
    this.copyButton = document.getElementById('copy-btn') as HTMLButtonElement;
    this.fillButton = document.getElementById('fill-btn') as HTMLButtonElement;
    this.loadingSpinner = document.querySelector('.loading-spinner') as HTMLElement;
    this.buttonText = document.querySelector('.btn-text') as HTMLElement;
    this.optionsButton = document.getElementById('options-btn') as HTMLButtonElement;
    this.templateSelect = document.getElementById('popup-template-select') as HTMLSelectElement;
    this.llmProviderSelect = document.getElementById('popup-llm-provider-select') as HTMLSelectElement;
    this.llmModelSelect = document.getElementById('popup-llm-model-select') as HTMLSelectElement;

    if (!this.tokenInput || !this.generateButton || !this.resultTextarea ||
        !this.statusMessage || !this.optionsButton || !this.templateSelect ||
        !this.llmProviderSelect || !this.llmModelSelect) {
      console.error('Required DOM elements not found');
      this.showError('Interface initialization failed.');
      return;
    }
  }

  private setupEventListeners(): void {
    this.tokenInput.addEventListener('input', () => this.validateTokenInput());
    this.tokenInput.addEventListener('paste', () => setTimeout(() => this.validateTokenInput(), 0));
    this.generateButton.addEventListener('click', () => this.handleGenerateClick());
    if (this.copyButton) this.copyButton.addEventListener('click', () => this.copyToClipboard());
    if (this.fillButton) this.fillButton.addEventListener('click', () => this.fillIntoPage());
    this.tokenInput.addEventListener('keypress', e => {
      if (e.key === 'Enter' && !this.generateButton.disabled) this.handleGenerateClick();
    });
    if (this.optionsButton) { // @ts-ignore
      this.optionsButton.addEventListener('click', () => { if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage(); else window.open(chrome.runtime.getURL('options/options.html')); });
    }
    if (this.llmProviderSelect) {
        this.llmProviderSelect.addEventListener('change', () => {
            if(this.currentUserLLMConfig) { // Update internal state if config is loaded
                this.currentUserLLMConfig.providerId = this.llmProviderSelect.value || null;
                this.currentUserLLMConfig.selectedModelId = null;
            } else { // If config wasn't loaded, initialize a temporary one for UI behavior
                this.currentUserLLMConfig = { providerId: this.llmProviderSelect.value || null, apiKey: null, selectedModelId: null, customEndpoint: null };
            }
            this.renderLLMModelSelection();
            this.validateTokenInput(); // Re-validate to enable/disable generate button
        });
    }
    if (this.llmModelSelect) {
        this.llmModelSelect.addEventListener('change', () => {
             if(this.currentUserLLMConfig) { // Should always exist if provider was selected
                this.currentUserLLMConfig.selectedModelId = this.llmModelSelect.value || null;
             }
             this.validateTokenInput(); // Re-validate
        });
    }
     if (this.templateSelect) {
        this.templateSelect.addEventListener('change', () => this.validateTokenInput()); // Re-validate
    }
  }

  private initializeState(): void {
    this.checkCurrentPage();
    this.validateTokenInput(); // Initial validation for button state
    this.hideActionButtons();
    this.clearStatus();
    this.loadAndRenderTemplates();
    this.loadAndRenderLLMConfig();
  }

  private initializeLLMProviderData(): void {
    this.availableLLMProviders = [
        { id: 'openai', name: 'OpenAI', models: [ {id: 'gpt-4o', name: 'GPT-4o'}, {id: 'gpt-4-turbo', name: 'GPT-4 Turbo'}, { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' } ] },
        { id: 'anthropic', name: 'Anthropic (Claude)', models: [ {id: 'claude-3-opus-20240229', name: 'Claude 3 Opus'}, {id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet'}, { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' } ] },
        { id: 'ollama', name: 'Ollama (Local)', models: [ {id: 'llama3', name: 'Llama 3 (default)'}, {id: 'codellama', name: 'CodeLlama'} ] }
    ];
  }

  private async loadAndRenderLLMConfig(): Promise<void> {
    if (!this.llmProviderSelect || !this.llmModelSelect) return;
    this.initializeLLMProviderData();

    this.llmProviderSelect.disabled = true; this.llmModelSelect.disabled = true;
    this.llmProviderSelect.innerHTML = '<option value="">-- Loading --</option>';
    this.llmModelSelect.innerHTML = '<option value="">-- Wait --</option>';

    try { // @ts-ignore
        const result = await chrome.storage.sync.get('userLLMConfig');
        this.currentUserLLMConfig = (result.userLLMConfig as UserLLMConfig) || { providerId: null, apiKey: null, selectedModelId: null, customEndpoint: null };

        this.llmProviderSelect.innerHTML = '<option value="">-- Select Provider --</option>';
        this.availableLLMProviders.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id; option.textContent = p.name;
            this.llmProviderSelect.appendChild(option);
        });

        if (this.currentUserLLMConfig && this.currentUserLLMConfig.providerId) {
            this.llmProviderSelect.value = this.currentUserLLMConfig.providerId;
        }
        this.llmProviderSelect.disabled = false;
        this.renderLLMModelSelection();
    } catch (error) {
        this.llmProviderSelect.innerHTML = '<option value="">-- Error --</option>';
        this.llmModelSelect.innerHTML = '<option value="">-- Error --</option>';
        this.showError("Failed to load LLM config.");
    }
  }

  private renderLLMModelSelection(): void {
    if (!this.llmModelSelect || !this.llmProviderSelect) return;
    const selectedProviderId = this.llmProviderSelect.value;
    const provider = this.availableLLMProviders.find(p => p.id === selectedProviderId);

    this.llmModelSelect.innerHTML = ''; this.llmModelSelect.disabled = true;

    if (provider && provider.models && provider.models.length > 0) {
        const defaultOpt = document.createElement('option'); defaultOpt.value = ""; defaultOpt.textContent = "-- Select Model --";
        this.llmModelSelect.appendChild(defaultOpt);
        provider.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id; option.textContent = model.name;
            this.llmModelSelect.appendChild(option);
        });
        if (this.currentUserLLMConfig && this.currentUserLLMConfig.providerId === selectedProviderId && this.currentUserLLMConfig.selectedModelId) {
            const modelExists = provider.models.some(m => m.id === this.currentUserLLMConfig!.selectedModelId);
            if(modelExists) this.llmModelSelect.value = this.currentUserLLMConfig.selectedModelId;
        }
        this.llmModelSelect.disabled = false;
    } else {
        const option = document.createElement('option');
        option.value = ''; option.textContent = selectedProviderId ? '-- No Models --' : '-- Select Provider --';
        this.llmModelSelect.appendChild(option);
    }
  }

  private async loadAndRenderTemplates(): Promise<void> {
    if (!this.templateSelect) return;
    this.templateSelect.disabled = true;
    this.templateSelect.innerHTML = '<option value="">-- Loading Templates --</option>';
    try { // @ts-ignore
        const result = await chrome.storage.sync.get('templates');
        this.availableTemplates = (result.templates as Template[]) || [];
        this.templateSelect.innerHTML = '';
        if (this.availableTemplates.length === 0) {
            const option = document.createElement('option'); option.value = '';
            option.textContent = '-- No Templates Configured --';
            this.templateSelect.appendChild(option); this.templateSelect.disabled = true;
        } else {
            const defaultOption = document.createElement('option'); defaultOption.value = '';
            defaultOption.textContent = '-- Select a Template --';
            this.templateSelect.appendChild(defaultOption);
            this.availableTemplates.forEach(template => {
                const option = document.createElement('option'); option.value = template.id;
                option.textContent = template.name; this.templateSelect.appendChild(option);
            });
            this.templateSelect.disabled = false;
        }
    } catch (error) {
        this.templateSelect.innerHTML = '<option value="">-- Error Loading --</option>';
        this.templateSelect.disabled = true; this.showError("Failed to load templates.");
    }
  }
  private async checkCurrentPage(): Promise<void> {
    try { // @ts-ignore
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      if (!currentTab || !currentTab.url) { this.showError('Cannot access current page.'); return; }
      const prInfo = this.extractPRInfoFromUrl(currentTab.url);
      if (!prInfo) { this.showError('Not a Bitbucket PR page.'); this.generateButton.disabled = true; return; }
      this.showInfo(`PR: ${prInfo.workspace}/${prInfo.repo}#${prInfo.prId}`);
    } catch (error) { this.showError('Error checking page.'); }
  }
  private extractPRInfoFromUrl(url: string): BitbucketPRInfo | null {
    const prUrlPattern = /^https:\/\/bitbucket\.org\/([^\/]+)\/([^\/]+)\/pull-requests\/(\d+)/;
    const match = url.match(prUrlPattern);
    if (!match) return null;
    return { workspace: match[1]!, repo: match[2]!, prId: match[3]!, fullUrl: url };
  }
  private validateTokenInput(): void {
    const tokenValue = this.tokenInput.value.trim();
    const isValid = this.isValidToken(tokenValue);
    const templateSelected = !!this.templateSelect.value;
    const providerSelected = !!this.llmProviderSelect.value;
    const modelSelected = !!this.llmModelSelect.value;

    this.generateButton.disabled = !isValid || !templateSelected || !providerSelected || !modelSelected;

    if (tokenValue.length > 0) {
      this.tokenInput.classList.toggle('invalid', !isValid);
      if (!isValid) this.showError('Invalid Bitbucket OAuth token format.');
      // else this.clearStatus(); // Don't clear if other errors exist
    } else {
      this.tokenInput.classList.remove('invalid');
      // this.clearStatus(); // Don't clear if other errors exist
    }
  }
  private isValidToken(token: string): boolean {
    if (!token || token.length < 20) return false;
    return /^[a-zA-Z0-9_-]+$/.test(token);
  }

  private async handleGenerateClick(): Promise<void> {
    try {
      const tokenValue = this.tokenInput.value.trim();
      if (!tokenValue || !this.isValidToken(tokenValue)) { this.showError('Invalid OAuth token.'); return; }
      // @ts-ignore
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      if (!currentTab || !currentTab.url) { this.showError('Cannot access current page.'); return; }
      const prInfo = this.extractPRInfoFromUrl(currentTab.url);
      if (!prInfo) { this.showError('Not a Bitbucket PR page.'); return; }

      const selectedTemplateId = this.templateSelect.value;
      const selectedTemplate = this.availableTemplates.find(t => t.id === selectedTemplateId);
      if (!selectedTemplate) { this.showError("Please select a template."); return; }

      const selectedProviderId = this.llmProviderSelect.value;
      const selectedModelId = this.llmModelSelect.value;

      if (!selectedProviderId) { this.showError('Please select an LLM provider.'); return; }
      if (!selectedModelId) { this.showError('Please select an LLM model.'); return; }

      if (!this.currentUserLLMConfig || this.currentUserLLMConfig.providerId !== selectedProviderId) {
          this.showError('LLM configuration error. Please save settings in Options page.'); return;
      }

      this.setLoadingState(true); this.showInfo('Generating PR description...');

      const request: GenerateRequest = {
          action: 'generate',
          prUrl: currentTab.url,
          token: tokenValue,
          templateContent: selectedTemplate.content,
          llmConfig: {
            providerId: selectedProviderId,
            modelId: selectedModelId,
            apiKey: this.currentUserLLMConfig.apiKey || null,
            customEndpoint: this.currentUserLLMConfig.customEndpoint || null,
          }
      };

      console.log("Sending generation request to background:", request);
      const response = await this.sendMessageToBackground(request);
      this.handleGenerateResponse(response);
    } catch (error) { this.showError('Unexpected error during generation.'); }
    finally { this.setLoadingState(false); }
  }

  private sendMessageToBackground(request: GenerateRequest): Promise<GenerateResponse> {
    return new Promise(resolve => { // @ts-ignore
      chrome.runtime.sendMessage(request, (response: GenerateResponse) => { // @ts-ignore
        if (chrome.runtime.lastError) resolve({ error: 'Background script error.' });
        else resolve(response || { error: 'No response from background.' });
      });
    });
  }
  private handleGenerateResponse(response: GenerateResponse): void {
    if (response.error) {
      this.showError(typeof response.error === 'string' ? response.error : 'Unknown error.');
      this.resultTextarea.value = ''; this.hideActionButtons();
    } else if (response.description) {
      this.showSuccess('PR description generated!');
      this.resultTextarea.value = response.description; this.showActionButtons();
    } else {
      this.showError('Invalid response.'); this.resultTextarea.value = ''; this.hideActionButtons();
    }
  }
  private async copyToClipboard(): Promise<void> {
    const text = this.resultTextarea.value;
    if (!text) { this.showError('No content to copy.'); return; }
    try { await navigator.clipboard.writeText(text); this.showSuccess('Copied!'); }
    catch (error) { this.resultTextarea.select(); document.execCommand('copy'); this.showSuccess('Copied (fallback)!'); }
  }
  private async fillIntoPage(): Promise<void> {
    const text = this.resultTextarea.value;
    if (!text) { this.showError('No content to fill.'); return; }
    this.showInfo('Fill into page: See Phase 2 plan.');
    await this.copyToClipboard();
  }
  private setLoadingState(loading: boolean): void {
    const commonDisableCondition = !this.isValidToken(this.tokenInput.value.trim()) ||
                                  !this.templateSelect.value ||
                                  !this.llmProviderSelect.value ||
                                  !this.llmModelSelect.value;
    this.generateButton.disabled = loading || commonDisableCondition;
    this.loadingSpinner.style.display = loading ? 'block' : 'none';
    this.buttonText.textContent = loading ? 'Generating...' : 'Generate Description';
  }
  private showActionButtons(): void { if (this.actionButtons) this.actionButtons.style.display = 'flex'; }
  private hideActionButtons(): void { if (this.actionButtons) this.actionButtons.style.display = 'none'; }
  private showSuccess(message: string): void { this.statusMessage.textContent = message; this.statusMessage.className = 'status-message success'; }
  private showError(message: string): void { this.statusMessage.textContent = String(message || 'An error occurred'); this.statusMessage.className = 'status-message error'; }
  private showInfo(message: string): void { this.statusMessage.textContent = message; this.statusMessage.className = 'status-message info'; }
  private clearStatus(): void { this.statusMessage.textContent = ''; this.statusMessage.className = 'status-message'; }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

export { PopupController };
