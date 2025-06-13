console.log("Options script loaded.");

interface Template {
  id: string;
  name: string;
  content: string;
  metadata?: {
    createdAt: string;
    updatedAt: string;
  };
}

interface ModelDetail {
    id: string;
    name: string;
    contextWindow?: number;
}

interface LLMProvider {
    id: string;
    name: string;
    apiKeyLabel?: string;
    requiresApiKey: boolean;
    models: ModelDetail[];
    requiresCustomEndpoint: boolean;
    customEndpointLabel?: string;
    helpText?: string;
}

interface UserLLMConfig {
    providerId: string | null;
    apiKey: string | null;
    selectedModelId: string | null;
    customEndpoint: string | null;
}

interface IOptionsController {
    init(): Promise<void>;
    loadTemplates(): Promise<void>;
    saveTemplateFromForm(): Promise<void>;
    deleteTemplate(templateId: string): Promise<void>;
    populateFormForEdit(templateId: string): void;
    resetTemplateForm(): void;
    previewTemplate(): void;
    exportTemplates(): void;
    importTemplates(event: Event): Promise<void>;

    loadLLMConfiguration(): Promise<void>;
    saveLLMConfiguration(): Promise<void>;
    renderLLMProviderSelection(): void;
    handleProviderSelectionChanged(): void;

    handleEvent(event: Event): void;
    renderSection(section: string): void;
    handleError(error: any, message: string): void;
    showLoading(section: string, isLoading: boolean): void;
    showFeedback(message: string, type: 'info' | 'success' | 'error'): void;
}

class OptionsController implements IOptionsController {
    private templates: Template[] = [];
    private llmProviders: LLMProvider[] = [];
    private currentUserLLMConfig: UserLLMConfig = {
        providerId: null,
        apiKey: null,
        selectedModelId: null,
        customEndpoint: null,
    };

    constructor() {
        console.log("OptionsController initialized.");
    }

    public async init(): Promise<void> {
        console.log("OptionsController init method called.");

        this.loadTemplates();
        const saveButton = document.getElementById('save-template-button');
        if (saveButton) saveButton.addEventListener('click', () => this.saveTemplateFromForm());
        const clearFormButton = document.getElementById('clear-template-form-button');
        if (clearFormButton) clearFormButton.addEventListener('click', () => this.resetTemplateForm());
        const previewButton = document.getElementById('preview-template-button');
        if (previewButton) previewButton.addEventListener('click', () => this.previewTemplate());
        const exportButton = document.getElementById('export-templates-button');
        if (exportButton) exportButton.addEventListener('click', () => this.exportTemplates());
        const importButton = document.getElementById('import-templates-button');
        const importFileInput = document.getElementById('import-file-input') as HTMLInputElement;
        if (importButton && importFileInput) {
            importButton.addEventListener('click', () => importFileInput.click());
            importFileInput.addEventListener('change', (event) => this.importTemplates(event));
        }
        this.resetTemplateForm();

        this.initializeLLMProviders();
        await this.loadLLMConfiguration();

        const providerSelect = document.getElementById('llm-provider-select') as HTMLSelectElement;
        if (providerSelect) {
            providerSelect.addEventListener('change', () => this.handleProviderSelectionChanged());
        }
        const saveLLMButton = document.getElementById('save-llm-config-button');
        if (saveLLMButton) {
            saveLLMButton.addEventListener('click', () => this.saveLLMConfiguration());
        }
    }

    private initializeLLMProviders(): void {
        this.llmProviders = [
            {
                id: 'openai', name: 'OpenAI', apiKeyLabel: 'OpenAI API Key', requiresApiKey: true,
                models: [ {id: 'gpt-4o', name: 'GPT-4o'}, {id: 'gpt-4-turbo', name: 'GPT-4 Turbo'}, { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' } ],
                requiresCustomEndpoint: false,
                helpText: 'Get your API key from platform.openai.com. Ensure you have billing set up.'
            },
            {
                id: 'anthropic', name: 'Anthropic (Claude)', apiKeyLabel: 'Anthropic API Key', requiresApiKey: true,
                models: [ {id: 'claude-3-opus-20240229', name: 'Claude 3 Opus'}, {id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet'}, { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' } ],
                requiresCustomEndpoint: false,
                helpText: 'Get your API key from console.anthropic.com.'
            },
            {
                id: 'ollama', name: 'Ollama (Local)', requiresApiKey: false,
                models: [ {id: 'llama3', name: 'Llama 3 (default)'}, {id: 'codellama', name: 'CodeLlama'}, {id: 'phi3', name: 'Phi-3'} ],
                requiresCustomEndpoint: true, customEndpointLabel: 'Ollama Server URL (e.g., http://localhost:11434)',
                helpText: 'Ensure your Ollama server is running. List available models with `ollama list`.'
            },
        ];
    }

    public async loadLLMConfiguration(): Promise<void> {
        console.log("Loading LLM configuration...");
        try { // @ts-ignore
            const result = await chrome.storage.sync.get('userLLMConfig');
            if (result.userLLMConfig) this.currentUserLLMConfig = result.userLLMConfig;
            else this.currentUserLLMConfig = { providerId: null, apiKey: null, selectedModelId: null, customEndpoint: null };
        } catch (error) {
            this.handleError(error, "Failed to load LLM config.");
            this.currentUserLLMConfig = { providerId: null, apiKey: null, selectedModelId: null, customEndpoint: null };
        }
        this.renderLLMProviderSelection();
    }

    public async saveLLMConfiguration(): Promise<void> {
        const selectedProviderId = (document.getElementById('llm-provider-select') as HTMLSelectElement)?.value;
        const provider = this.llmProviders.find(p => p.id === selectedProviderId);

        if (provider && provider.requiresApiKey) {
            const apiKeyInput = document.getElementById('llm-api-key') as HTMLInputElement;
            if (!apiKeyInput || !apiKeyInput.value.trim()) {
                this.showFeedback(`API Key for ${provider.name} cannot be empty.`, "error");
                return;
            }
        }

        if (!provider) {
            this.currentUserLLMConfig = { providerId: null, apiKey: null, selectedModelId: null, customEndpoint: null };
        } else {
            this.currentUserLLMConfig.providerId = provider.id;
            const apiKeyInput = document.getElementById('llm-api-key') as HTMLInputElement;
            this.currentUserLLMConfig.apiKey = (provider.requiresApiKey && apiKeyInput) ? (apiKeyInput.value.trim() || null) : null;

            const endpointInput = document.getElementById('llm-custom-endpoint') as HTMLInputElement;
            this.currentUserLLMConfig.customEndpoint = (provider.requiresCustomEndpoint && endpointInput) ? (endpointInput.value.trim() || null) : null;

            const modelSelectElement = document.getElementById('llm-model-select') as HTMLSelectElement;
            if (modelSelectElement && modelSelectElement.value) {
                this.currentUserLLMConfig.selectedModelId = modelSelectElement.value;
            } else if (provider && (!provider.models || provider.models.length === 0)) {
                this.currentUserLLMConfig.selectedModelId = null;
            }
        }

        try { // @ts-ignore
            await chrome.storage.sync.set({ userLLMConfig: this.currentUserLLMConfig });
            this.showFeedback("LLM configuration saved.", "success");
        } catch (error) { this.handleError(error, "Failed to save LLM config."); }
    }

    public renderLLMProviderSelection(): void {
        const providerSelect = document.getElementById('llm-provider-select') as HTMLSelectElement;
        if (!providerSelect) return;

        providerSelect.innerHTML = '<option value="">-- Select a Provider --</option>';
        this.llmProviders.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id; option.textContent = p.name;
            providerSelect.appendChild(option);
        });

        providerSelect.value = this.currentUserLLMConfig.providerId || "";
        this.handleProviderSelectionChanged();
    }

    public handleProviderSelectionChanged(): void {
        const providerSelect = document.getElementById('llm-provider-select') as HTMLSelectElement;
        const selectedProviderId = providerSelect.value;
        const provider = this.llmProviders.find(p => p.id === selectedProviderId);

        const settingsContainer = document.getElementById('llm-provider-settings-container');
        const helpTextContainer = document.getElementById('llm-provider-helptext-container');
        if (!settingsContainer || !helpTextContainer) return;

        settingsContainer.innerHTML = ''; helpTextContainer.innerHTML = '';

        if (!provider) {
            settingsContainer.innerHTML = '<p><em>Select a provider to see its settings.</em></p>';
            if (this.currentUserLLMConfig.providerId !== null) {
                 this.currentUserLLMConfig.selectedModelId = null;
            }
            this.currentUserLLMConfig.providerId = null;
            return;
        }

        if (this.currentUserLLMConfig.providerId !== provider.id) {
            this.currentUserLLMConfig.selectedModelId = null;
        }
        this.currentUserLLMConfig.providerId = provider.id;

        if (provider.requiresApiKey) {
            const label = document.createElement('label'); label.setAttribute('for', 'llm-api-key'); label.textContent = provider.apiKeyLabel || 'API Key:';
            const input = document.createElement('input'); input.type = 'password'; input.id = 'llm-api-key'; input.name = 'llm-api-key';
            input.value = (this.currentUserLLMConfig.providerId === provider.id && this.currentUserLLMConfig.apiKey) ? this.currentUserLLMConfig.apiKey : '';
            input.placeholder = 'Enter your API key'; input.style.width = 'calc(90% - 100px)';

            const verifyButton = document.createElement('button');
            verifyButton.id = 'verify-api-key-button';
            verifyButton.textContent = 'Verify Key';
            verifyButton.disabled = true;
            verifyButton.title = 'Backend API key verification is not yet implemented.';
            verifyButton.style.marginLeft = '10px';

            settingsContainer.appendChild(label); settingsContainer.appendChild(document.createElement('br'));
            settingsContainer.appendChild(input);
            settingsContainer.appendChild(verifyButton);
            settingsContainer.appendChild(document.createElement('br'));
        } else {
            if (this.currentUserLLMConfig.providerId === provider.id) this.currentUserLLMConfig.apiKey = null;
        }

        if (provider.requiresCustomEndpoint) {
            const label = document.createElement('label'); label.setAttribute('for', 'llm-custom-endpoint'); label.textContent = provider.customEndpointLabel || 'Custom Endpoint URL:';
            const input = document.createElement('input'); input.type = 'text'; input.id = 'llm-custom-endpoint'; input.name = 'llm-custom-endpoint';
            input.value = (this.currentUserLLMConfig.providerId === provider.id && this.currentUserLLMConfig.customEndpoint) ? this.currentUserLLMConfig.customEndpoint : '';
            input.placeholder = 'e.g., http://localhost:11434'; input.style.width = '90%';
            settingsContainer.appendChild(label); settingsContainer.appendChild(document.createElement('br'));
            settingsContainer.appendChild(input); settingsContainer.appendChild(document.createElement('br'));
        } else {
            if (this.currentUserLLMConfig.providerId === provider.id) this.currentUserLLMConfig.customEndpoint = null;
        }

        if (provider.models && provider.models.length > 0) {
            const modelLabel = document.createElement('label'); modelLabel.setAttribute('for', 'llm-model-select'); modelLabel.textContent = 'Select Model:';
            const modelSelect = document.createElement('select'); modelSelect.id = 'llm-model-select'; modelSelect.name = 'llm-model-select';
            modelSelect.innerHTML = '<option value="">-- Select a Model --</option>';
            provider.models.forEach(model => {
                const option = document.createElement('option'); option.value = model.id; option.textContent = model.name;
                modelSelect.appendChild(option);
            });

            if (this.currentUserLLMConfig.providerId === provider.id && this.currentUserLLMConfig.selectedModelId) {
                const modelExists = provider.models.some(m => m.id === this.currentUserLLMConfig.selectedModelId);
                if (modelExists) modelSelect.value = this.currentUserLLMConfig.selectedModelId;
                else this.currentUserLLMConfig.selectedModelId = null;
            }

            modelSelect.addEventListener('change', (event) => {
                this.currentUserLLMConfig.selectedModelId = (event.target as HTMLSelectElement).value || null;
            });
            settingsContainer.appendChild(document.createElement('br'));
            settingsContainer.appendChild(modelLabel); settingsContainer.appendChild(document.createElement('br'));
            settingsContainer.appendChild(modelSelect); settingsContainer.appendChild(document.createElement('br'));
        } else {
            this.currentUserLLMConfig.selectedModelId = null;
        }

        // Placeholders for Cost Estimation and Availability Status
        const costEstimationLabel = document.createElement('p');
        costEstimationLabel.textContent = 'Cost Estimation:';
        costEstimationLabel.style.fontWeight = 'bold';
        const costEstimationText = document.createElement('p');
        costEstimationText.id = 'llm-cost-estimation';
        costEstimationText.textContent = 'Details about cost structure for the selected provider will be shown here in a future update.';
        costEstimationText.style.fontSize = '0.9em';
        costEstimationText.style.color = '#777';

        const availabilityStatusLabel = document.createElement('p');
        availabilityStatusLabel.textContent = 'Provider Status:';
        availabilityStatusLabel.style.fontWeight = 'bold';
        const availabilityStatusText = document.createElement('p');
        availabilityStatusText.id = 'llm-availability-status';
        availabilityStatusText.textContent = 'Live availability status checking will be implemented in a future update.';
        availabilityStatusText.style.fontSize = '0.9em';
        availabilityStatusText.style.color = '#777';

        settingsContainer.appendChild(document.createElement('br'));
        settingsContainer.appendChild(costEstimationLabel);
        settingsContainer.appendChild(costEstimationText);
        settingsContainer.appendChild(document.createElement('br'));
        settingsContainer.appendChild(availabilityStatusLabel);
        settingsContainer.appendChild(availabilityStatusText);

        if (provider.helpText) helpTextContainer.textContent = provider.helpText;
    }

    // --- Template Methods ---
    public async loadTemplates(): Promise<void> {
        try { // @ts-ignore
            const result = await chrome.storage.sync.get('templates');
            this.templates = result.templates || [];
            if (this.templates.length === 0) await this.createAndLoadDefaultPresets();
            else this.renderTemplateList();
        } catch (error) { this.handleError(error, "Failed to load templates."); }
    }

    private async createAndLoadDefaultPresets(): Promise<void> {
        const defaultTemplates: Template[] = [
            { id: this.generateId(), name: "Default Feature PR", content: "## Overview\n{pr_body}\n\n## Background\n{background}\n\n## Changes Made\n{changes}\n\n## Testing\n{tests}", metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
            { id: this.generateId(), name: "Simple Bugfix PR", content: "## Issue Fixed\n{pr_title}\n\n## Description of Fix\n{changes}", metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }
        ];
        try { // @ts-ignore
            await chrome.storage.sync.set({ templates: defaultTemplates });
            this.templates = defaultTemplates; this.renderTemplateList();
            this.showFeedback("Loaded default templates.", "info");
        } catch (error) { this.handleError(error, "Failed to save default templates."); }
    }

    private generateId(): string { return `template_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`; }

    public resetTemplateForm(): void {
        const idInput = document.getElementById('template-id') as HTMLInputElement, nameInput = document.getElementById('template-name') as HTMLInputElement, contentInput = document.getElementById('template-content') as HTMLTextAreaElement;
        const saveButton = document.getElementById('save-template-button') as HTMLButtonElement, formHeading = document.getElementById('template-form-heading') as HTMLHeadingElement, previewArea = document.getElementById('template-preview-area');
        if (idInput) idInput.value = ""; if (nameInput) nameInput.value = ""; if (contentInput) contentInput.value = "";
        if (saveButton) saveButton.textContent = "Save New Template"; if (formHeading) formHeading.textContent = "Add New Template";
        if (previewArea) previewArea.innerHTML = '<p><em>Preview will appear here...</em></p>'; if (nameInput) nameInput.focus();
    }

    public async saveTemplateFromForm(): Promise<void> {
        const idInput = document.getElementById('template-id') as HTMLInputElement, nameInput = document.getElementById('template-name') as HTMLInputElement, contentInput = document.getElementById('template-content') as HTMLTextAreaElement;
        if (!nameInput || !contentInput || !idInput || !nameInput.value.trim() || !contentInput.value.trim()) { this.showFeedback("Template name and content cannot be empty.", "error"); return; }
        const name = nameInput.value.trim(), content = contentInput.value.trim(), id = idInput.value;
        let templateToSave: Template, isUpdate = false;
        if (id) {
            const existingTemplate = this.templates.find(t => t.id === id);
            if (!existingTemplate) { this.showFeedback("Template not found for update.", "error"); this.resetTemplateForm(); return; }
            templateToSave = { ...existingTemplate, name, content, metadata: { ...(existingTemplate.metadata || { createdAt: new Date().toISOString() }), updatedAt: new Date().toISOString() } };
            isUpdate = true;
        } else templateToSave = { id: this.generateId(), name, content, metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
        try {
            if (isUpdate) this.templates = this.templates.map(t => t.id === id ? templateToSave : t); else this.templates.push(templateToSave);
            // @ts-ignore
            await chrome.storage.sync.set({ templates: this.templates });
            this.renderTemplateList(); this.showFeedback(`Template "${name}" ${isUpdate ? 'updated' : 'saved'}.`, "success"); this.resetTemplateForm();
        } catch (error) { this.handleError(error, `Failed to save template "${name}".`); await this.loadTemplates(); }
    }

    public async deleteTemplate(templateId: string): Promise<void> {
        const templateToDelete = this.templates.find(t => t.id === templateId);
        if (!templateToDelete) { this.showFeedback(`Template with ID ${templateId} not found.`, "error"); return; }
        if (!window.confirm(`Delete template "${templateToDelete.name}"?`)) return;
        try {
            this.templates = this.templates.filter(t => t.id !== templateId); // @ts-ignore
            await chrome.storage.sync.set({ templates: this.templates });
            this.renderTemplateList(); this.showFeedback(`Template "${templateToDelete.name}" deleted.`, "success");
            if ((document.getElementById('template-id') as HTMLInputElement)?.value === templateId) this.resetTemplateForm();
        } catch (error) { this.handleError(error, `Failed to delete template "${templateToDelete.name}".`); await this.loadTemplates(); }
    }

    public populateFormForEdit(templateId: string): void {
        const template = this.templates.find(t => t.id === templateId);
        if (template) {
            const nameInput = document.getElementById('template-name') as HTMLInputElement, contentInput = document.getElementById('template-content') as HTMLTextAreaElement, idInput = document.getElementById('template-id') as HTMLInputElement;
            const saveButton = document.getElementById('save-template-button') as HTMLButtonElement, formHeading = document.getElementById('template-form-heading') as HTMLHeadingElement;
            if (nameInput && contentInput && idInput && saveButton && formHeading) {
                nameInput.value = template.name; contentInput.value = template.content; idInput.value = template.id;
                saveButton.textContent = "Update Template"; formHeading.textContent = `Edit Template: ${template.name}`;
                nameInput.focus(); this.previewTemplate(); this.showFeedback(`Editing: "${template.name}".`, "info");
            }
        } else { this.showFeedback(`Template ID ${templateId} not found.`, "error"); this.resetTemplateForm(); }
    }

    public previewTemplate(): void {
        const contentInput = document.getElementById('template-content') as HTMLTextAreaElement, previewArea = document.getElementById('template-preview-area');
        if (!contentInput || !previewArea) { this.showFeedback("Preview elements missing.", "error"); return; }
        let content = contentInput.value;
        const placeholders = { '{branch_name}': 'feature/xyz', '{pr_title}': 'Feat: XYZ', '{pr_body}': 'Body...', '{diff_summary}': '- a\n- b', '{commit_messages}': '- c\n- d', '{file_changes}': 'e.ts, f.ts', '{background}': 'Info...', '{changes}': 'Changes...', '{tests}': 'Tests...' };
        for (const [p, ex] of Object.entries(placeholders)) content = content.split(p).join(ex);
        previewArea.textContent = content; this.showFeedback("Preview updated.", "info");
    }

    public exportTemplates(): void {
        if (this.templates.length === 0) { this.showFeedback("No templates to export.", "info"); return; }
        try {
            const jsonData = JSON.stringify(this.templates, null, 2), blob = new Blob([jsonData],{type:'application/json'});
            const url = URL.createObjectURL(blob), a = document.createElement('a');
            a.href = url; a.download = 'templates_export.json'; document.body.appendChild(a); a.click();
            document.body.removeChild(a); URL.revokeObjectURL(url); this.showFeedback("Templates exported.", "success");
        } catch (error) { this.handleError(error, "Failed to export templates."); }
    }

    public async importTemplates(event: Event): Promise<void> {
        const fileInput = event.target as HTMLInputElement;
        if (!fileInput.files || fileInput.files.length === 0) { this.showFeedback("No file selected.", "info"); return; }
        const file = fileInput.files[0];
        if (file.type !== "application/json") { this.showFeedback("Please select JSON.", "error"); fileInput.value = ""; return; }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string, importedData = JSON.parse(content);
                if (!Array.isArray(importedData) || !importedData.every(t => t.id && t.name && t.content)) {
                    this.showFeedback("Invalid template data.", "error"); return;
                } // @ts-ignore
                this.templates = importedData as Template[]; await chrome.storage.sync.set({ templates: this.templates });
                this.renderTemplateList(); this.resetTemplateForm(); this.showFeedback("Templates imported.", "success");
            } catch (error) { this.handleError(error, "Failed to import."); } finally { fileInput.value = ""; }
        };
        reader.onerror = () => { this.handleError(reader.error, "File read failed."); fileInput.value = ""; };
        reader.readAsText(file);
    }

    private renderTemplateList(): void {
        const el = document.getElementById('template-list'); if (!el) return;
        if (this.templates.length === 0) { el.innerHTML = '<li>No templates.</li>'; return; }
        el.innerHTML = this.templates.map(t => `<li><span>${t.name} (ID: ${t.id.substring(0,8)}...)</span> <button class="edit-template-button" data-id="${t.id}">Edit</button> <button class="delete-template-button" data-id="${t.id}">Delete</button></li>`).join('');
        el.querySelectorAll('.edit-template-button').forEach(b => b.addEventListener('click', e => this.populateFormForEdit((e.target as HTMLElement).dataset.id!)));
        el.querySelectorAll('.delete-template-button').forEach(b => b.addEventListener('click', e => this.deleteTemplate((e.target as HTMLElement).dataset.id!)));
    }

    public handleEvent(event: Event): void { console.log("Generic event:", event); }
    public renderSection(section: string): void { console.log("Render section:", section); }
    public handleError(error: any, message: string): void { console.error("Error:", message, error); this.showFeedback(`${message} ${error?.message || ''}`, 'error'); }
    public showLoading(section: string, isLoading: boolean): void { const el = document.getElementById(`${section}-loading`); if (el) el.style.display = isLoading ? 'block' : 'none'; }
    public showFeedback(message: string, type: 'info' | 'success' | 'error' = 'info'): void { alert(`[${type.toUpperCase()}] ${message}`); }
}

document.addEventListener('DOMContentLoaded', () => { // @ts-ignore
    const controller = new OptionsController(); controller.init();
});
