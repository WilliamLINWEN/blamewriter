// Popup script for Bitbucket PR Helper extension

import {
    Template,
    UserLLMConfig,
    LLMProvider as LLMProviderDef,
    ModelDetail
} from '../common/storage_schema';
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
  token: string;
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
    this.setupStorageListeners(); // Added
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
            if(this.currentUserLLMConfig) {
                this.currentUserLLMConfig.providerId = this.llmProviderSelect.value || null;
                this.currentUserLLMConfig.selectedModelId = null;
            } else {
                this.currentUserLLMConfig = { providerId: this.llmProviderSelect.value || null, selectedModelId: null, customEndpoint: null };
            }
            this.renderLLMModelSelection();
            this.validateTokenInput();
        });
    }
    if (this.llmModelSelect) {
        this.llmModelSelect.addEventListener('change', () => {
             if(this.currentUserLLMConfig) {
                this.currentUserLLMConfig.selectedModelId = this.llmModelSelect.value || null;
             }
             this.validateTokenInput();
        });
    }
     if (this.templateSelect) {
        this.templateSelect.addEventListener('change', () => this.validateTokenInput());
    }
  }

  private initializeState(): void {
    this.checkCurrentPage();
    this.validateTokenInput();
    this.hideActionButtons();
    this.clearStatus();
    this.loadAndRenderTemplates();
    this.loadAndRenderLLMConfig();
  }

  private setupStorageListeners(): void {
    // @ts-ignore
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync') {
            return;
        }
        console.log("Popup: Storage changed in 'sync' area:", changes);

        if (changes.userLLMConfig) {
            console.log("Popup: UserLLMConfig changed. Reloading LLM config for popup.");
            this.loadAndRenderLLMConfig().catch(err => console.error("Popup: Error reloading LLM config on change:", err));
        }
        if (changes.templates) {
            console.log("Popup: Templates changed. Reloading templates for popup.");
            this.loadAndRenderTemplates().catch(err => console.error("Popup: Error reloading templates on change:", err));
        }
    });
  }

  private initializeLLMProviderData(): void {
    this.availableLLMProviders = [
        { id: 'openai', name: 'OpenAI', models: [ {id: 'gpt-4o', name: 'GPT-4o'}, {id: 'gpt-4-turbo', name: 'GPT-4 Turbo'}, { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' } ], requiresCustomEndpoint: false },
        { id: 'anthropic', name: 'Anthropic (Claude)', models: [ {id: 'claude-3-opus-20240229', name: 'Claude 3 Opus'}, {id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet'}, { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' } ], requiresCustomEndpoint: false },
        { id: 'ollama', name: 'Ollama (Local)', models: [ {id: 'llama3', name: 'Llama 3 (default)'}, {id: 'codellama', name: 'CodeLlama'} ], requiresCustomEndpoint: true }
    ];
  }

  private async loadAndRenderLLMConfig(): Promise<void> {
    if (!this.llmProviderSelect || !this.llmModelSelect) return;
    this.initializeLLMProviderData();

    this.llmProviderSelect.disabled = true; this.llmModelSelect.disabled = true;
    this.llmProviderSelect.innerHTML = '<option value="">-- Loading --</option>';
    this.llmModelSelect.innerHTML = '<option value="">-- Wait --</option>';

    try {
        this.currentUserLLMConfig = await getFromStorage('userLLMConfig', { providerId: null, selectedModelId: null, customEndpoint: null });

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
        provider.models.forEach(model => { const o=document.createElement('option');o.value=model.id;o.textContent=model.name;this.llmModelSelect.appendChild(o);});
        if (this.currentUserLLMConfig && this.currentUserLLMConfig.providerId === selectedProviderId && this.currentUserLLMConfig.selectedModelId) {
            if(provider.models.some(m => m.id === this.currentUserLLMConfig!.selectedModelId)) this.llmModelSelect.value = this.currentUserLLMConfig.selectedModelId;
        }
        this.llmModelSelect.disabled = false;
    } else {
        const o=document.createElement('option');o.value='';o.textContent=selectedProviderId ? '-- No Models --':'-- Select Provider --';this.llmModelSelect.appendChild(o);
    }
  }

  private async loadAndRenderTemplates(): Promise<void> {
    if (!this.templateSelect) return;
    this.templateSelect.disabled = true;
    this.templateSelect.innerHTML = '<option value="">-- Loading Templates --</option>';
    try {
        this.availableTemplates = await getFromStorage('templates', []);
        this.templateSelect.innerHTML = '';
        if (this.availableTemplates.length === 0) { const o=document.createElement('option');o.value='';o.textContent='-- No Templates Configured --';this.templateSelect.appendChild(o);this.templateSelect.disabled=true; }
        else { const dO=document.createElement('option');dO.value='';dO.textContent='-- Select a Template --';this.templateSelect.appendChild(dO);
            this.availableTemplates.forEach(t => {const o=document.createElement('option');o.value=t.id;o.textContent=t.name;this.templateSelect.appendChild(o);});
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
      if (!isValid && this.statusMessage.textContent === '') { // Only show token error if no other error is shown
        this.showError('Invalid Bitbucket OAuth token format.');
      } else if (isValid && this.statusMessage.className.includes('error')) { // Clear if valid and error was shown
         // this.clearStatus(); // This might clear other important messages, be cautious
      }
    } else {
      this.tokenInput.classList.remove('invalid');
    }
  }

  private isValidToken(token: string): boolean {
    if (!token || token.length < 20) return false;
    return true
  }

  private async handleGenerateClick(): Promise<void> {
    try {
      const tokenValue = this.tokenInput.value.trim();
      // ValidateTokenInput should have already handled generateButton.disabled state
      if (this.generateButton.disabled) {
          if (!tokenValue || !this.isValidToken(tokenValue)) this.showError('Invalid OAuth token.');
          else if (!this.templateSelect.value) this.showError('Please select a template.');
          else if (!this.llmProviderSelect.value) this.showError('Please select an LLM Provider.');
          else if (!this.llmModelSelect.value) this.showError('Please select an LLM Model.');
          else this.showError('Please ensure all fields and selections are valid.');
          return;
      }
      // @ts-ignore
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      if (!currentTab || !currentTab.url) { this.showError('Cannot access current page.'); return; }
      const prInfo = this.extractPRInfoFromUrl(currentTab.url); // Already checked by checkCurrentPage for button state too
      if (!prInfo) { this.showError('Not a Bitbucket PR page.'); return; }

      const selectedTemplate = this.availableTemplates.find(t => t.id === this.templateSelect.value);
      if (!selectedTemplate) { this.showError("Selected template not found."); return; } // Should be caught by button state

      const selectedProviderId = this.llmProviderSelect.value;
      const selectedModelId = this.llmModelSelect.value;

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
            customEndpoint: this.currentUserLLMConfig.customEndpoint || null
        }
      };

      // Track template usage (async, don't wait for it)
      updateTemplateUsageStats(selectedTemplate.id).catch(error => 
          console.warn('Failed to update template usage stats:', error)
      );

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
    if(this.generateButton) this.generateButton.disabled = loading || commonDisableCondition;
    if(this.loadingSpinner) this.loadingSpinner.style.display = loading ? 'block' : 'none';
    if(this.buttonText) this.buttonText.textContent = loading ? 'Generating...' : 'Generate Description';
  }
  private showActionButtons(): void { if (this.actionButtons) this.actionButtons.style.display = 'flex'; }
  private hideActionButtons(): void { if (this.actionButtons) this.actionButtons.style.display = 'none'; }
  private showSuccess(message: string): void { if(this.statusMessage) {this.statusMessage.textContent = message; this.statusMessage.className = 'status-message success';} }
  private showError(message: string): void { if(this.statusMessage) {this.statusMessage.textContent = String(message || 'An error occurred'); this.statusMessage.className = 'status-message error';} }
  private showInfo(message: string): void { if(this.statusMessage) {this.statusMessage.textContent = message; this.statusMessage.className = 'status-message info';} }
  private clearStatus(): void { if(this.statusMessage){this.statusMessage.textContent = ''; this.statusMessage.className = 'status-message';} }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

export { PopupController };
