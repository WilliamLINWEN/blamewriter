// Popup script for Bitbucket PR Helper extension
// Phase 1 MVP implementation

interface BitbucketPRInfo {
  workspace: string;
  repo: string;
  prId: string;
  fullUrl: string;
}

interface GenerateRequest {
  action: 'generate';
  url: string;
  token: string;
}

interface GenerateResponse {
  description?: string;
  error?: string;
}

class PopupController {
  private tokenInput: HTMLInputElement;
  private generateButton: HTMLButtonElement;
  private resultTextarea: HTMLTextAreaElement;
  private statusMessage: HTMLElement;
  private actionButtons: HTMLElement;
  private copyButton: HTMLButtonElement;
  private fillButton: HTMLButtonElement;
  private loadingSpinner: HTMLElement;
  private buttonText: HTMLElement;

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

    // Verify all required elements are present
    if (!this.tokenInput || !this.generateButton || !this.resultTextarea || !this.statusMessage) {
      console.error('Required DOM elements not found');
      this.showError('Interface initialization failed. Please refresh the popup.');
      return;
    }
  }

  private setupEventListeners(): void {
    // Token input validation
    this.tokenInput.addEventListener('input', () => {
      this.validateTokenInput();
    });

    this.tokenInput.addEventListener('paste', () => {
      // Validate after paste event completes
      setTimeout(() => this.validateTokenInput(), 0);
    });

    // Generate button click handler
    this.generateButton.addEventListener('click', () => {
      this.handleGenerateClick();
    });

    // Action buttons
    if (this.copyButton) {
      this.copyButton.addEventListener('click', () => {
        this.copyToClipboard();
      });
    }

    if (this.fillButton) {
      this.fillButton.addEventListener('click', () => {
        this.fillIntoPage();
      });
    }

    // Enter key support for token input
    this.tokenInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !this.generateButton.disabled) {
        this.handleGenerateClick();
      }
    });
  }

  private initializeState(): void {
    // Check current page on popup open
    this.checkCurrentPage();
    
    // Initialize UI state
    this.validateTokenInput();
    this.hideActionButtons();
    this.clearStatus();
  }

  private async checkCurrentPage(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab || !currentTab.url) {
        this.showError('Unable to access current page. Please refresh and try again.');
        return;
      }

      const prInfo = this.extractPRInfoFromUrl(currentTab.url);
      if (!prInfo) {
        this.showError('Please navigate to a Bitbucket Pull Request page first.');
        this.generateButton.disabled = true;
        return;
      }

      this.showInfo(`Detected PR: ${prInfo.workspace}/${prInfo.repo}#${prInfo.prId}`);
    } catch (error) {
      console.error('Error checking current page:', error);
      this.showError('Unable to access current page. Please ensure you have the required permissions.');
    }
  }

  private extractPRInfoFromUrl(url: string): BitbucketPRInfo | null {
    // Bitbucket PR URL pattern: https://bitbucket.org/workspace/repo/pull-requests/123
    const prUrlPattern = /^https:\/\/bitbucket\.org\/([^\/]+)\/([^\/]+)\/pull-requests\/(\d+)/;
    const match = url.match(prUrlPattern);
    
    if (!match) {
      return null;
    }

    return {
      workspace: match[1],
      repo: match[2],
      prId: match[3],
      fullUrl: url
    };
  }

  private validateTokenInput(): void {
    const tokenValue = this.tokenInput.value.trim();
    const isValid = this.isValidToken(tokenValue);
    
    // Enable/disable generate button based on token validity
    this.generateButton.disabled = !isValid;
    
    // Update input styling based on validity
    if (tokenValue.length > 0) {
      if (isValid) {
        this.tokenInput.classList.remove('invalid');
        this.clearStatus();
      } else {
        this.tokenInput.classList.add('invalid');
        this.showError('Please enter a valid Bitbucket OAuth token');
      }
    } else {
      this.tokenInput.classList.remove('invalid');
      this.clearStatus();
    }
  }

  private isValidToken(token: string): boolean {
    // Basic token validation
    // Bitbucket OAuth tokens are typically 40+ characters alphanumeric
    if (!token || token.length < 20) {
      return false;
    }
    
    // Check for common token patterns
    const tokenPattern = /^[a-zA-Z0-9_-]+$/;
    return tokenPattern.test(token);
  }

  private async handleGenerateClick(): Promise<void> {
    try {
      const tokenValue = this.tokenInput.value.trim();
      if (!tokenValue || !this.isValidToken(tokenValue)) {
        this.showError('Please enter a valid Bitbucket OAuth token');
        return;
      }

      // Get current tab URL
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab || !currentTab.url) {
        this.showError('Unable to access current page');
        return;
      }

      // Validate current page is a Bitbucket PR page
      const prInfo = this.extractPRInfoFromUrl(currentTab.url);
      if (!prInfo) {
        this.showError('Please navigate to a Bitbucket Pull Request page');
        return;
      }

      // Show loading state
      this.setLoadingState(true);
      this.showInfo('Generating PR description...');

      // Send message to background script
      const request: GenerateRequest = {
        action: 'generate',
        url: currentTab.url,
        token: tokenValue
      };

      const response = await this.sendMessageToBackground(request);
      this.handleGenerateResponse(response);

    } catch (error) {
      console.error('Error in generate click handler:', error);
      this.showError('An unexpected error occurred. Please try again.');
    } finally {
      this.setLoadingState(false);
    }
  }

  private sendMessageToBackground(request: GenerateRequest): Promise<GenerateResponse> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(request, (response: GenerateResponse) => {
        // Handle potential errors in message passing
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          resolve({ error: 'Failed to communicate with extension background script' });
        } else {
          resolve(response || { error: 'No response received from background script' });
        }
      });
    });
  }

  private handleGenerateResponse(response: GenerateResponse): void {
    if (response.error) {
      this.showError(response.error);
      this.resultTextarea.value = '';
      this.hideActionButtons();
    } else if (response.description) {
      this.showSuccess('PR description generated successfully!');
      this.resultTextarea.value = response.description;
      this.showActionButtons();
    } else {
      this.showError('Received invalid response from server');
      this.resultTextarea.value = '';
      this.hideActionButtons();
    }
  }

  private async copyToClipboard(): Promise<void> {
    try {
      const text = this.resultTextarea.value;
      if (!text) {
        this.showError('No content to copy');
        return;
      }

      await navigator.clipboard.writeText(text);
      this.showSuccess('Description copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      this.resultTextarea.select();
      document.execCommand('copy');
      this.showSuccess('Description copied to clipboard!');
    }
  }

  private async fillIntoPage(): Promise<void> {
    try {
      const text = this.resultTextarea.value;
      if (!text) {
        this.showError('No content to fill');
        return;
      }

      // This would be implemented in future phases with content script integration
      // For now, just show a message
      this.showInfo('Fill into page functionality will be implemented in Phase 2');
      
      // Also copy to clipboard as a fallback
      await this.copyToClipboard();
    } catch (error) {
      console.error('Failed to fill into page:', error);
      this.showError('Failed to fill content into page');
    }
  }

  private setLoadingState(loading: boolean): void {
    if (loading) {
      this.generateButton.disabled = true;
      this.loadingSpinner.style.display = 'block';
      this.buttonText.textContent = 'Generating...';
    } else {
      this.generateButton.disabled = !this.isValidToken(this.tokenInput.value.trim());
      this.loadingSpinner.style.display = 'none';
      this.buttonText.textContent = 'Generate Description';
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

  private showSuccess(message: string): void {
    this.statusMessage.textContent = message;
    this.statusMessage.className = 'status-message success';
  }

  private showError(message: string): void {
    this.statusMessage.textContent = message;
    this.statusMessage.className = 'status-message error';
  }

  private showInfo(message: string): void {
    this.statusMessage.textContent = message;
    this.statusMessage.className = 'status-message info';
  }

  private clearStatus(): void {
    this.statusMessage.textContent = '';
    this.statusMessage.className = 'status-message';
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup script loaded');
  new PopupController();
});

// Export for testing purposes
export { PopupController };
