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

interface IOptionsController {
    init(): void;
    loadTemplates(): Promise<void>;
    saveTemplateFromForm(): Promise<void>;
    deleteTemplate(templateId: string): Promise<void>;
    populateFormForEdit(templateId: string): void;
    resetTemplateForm(): void;
    previewTemplate(): void;
    exportTemplates(): void;
    importTemplates(event: Event): Promise<void>;
    handleEvent(event: Event): void;
    renderSection(section: string): void;
    handleError(error: any, message: string): void;
    showLoading(section: string, isLoading: boolean): void;
    showFeedback(message: string, type: 'info' | 'success' | 'error'): void;
}

class OptionsController implements IOptionsController {
    private templates: Template[] = [];

    constructor() {
        console.log("OptionsController initialized.");
    }

    public init(): void {
        console.log("OptionsController init method called.");
        this.loadTemplates();

        const saveButton = document.getElementById('save-template-button');
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveTemplateFromForm());
        } else {
            console.error("Save template button not found!");
        }

        const clearFormButton = document.getElementById('clear-template-form-button');
        if (clearFormButton) {
            clearFormButton.addEventListener('click', () => this.resetTemplateForm());
        }

        const previewButton = document.getElementById('preview-template-button');
        if (previewButton) {
            previewButton.addEventListener('click', () => this.previewTemplate());
        }

        const exportButton = document.getElementById('export-templates-button');
        if (exportButton) {
            exportButton.addEventListener('click', () => this.exportTemplates());
        }

        const importButton = document.getElementById('import-templates-button');
        const importFileInput = document.getElementById('import-file-input') as HTMLInputElement;
        if (importButton && importFileInput) {
            importButton.addEventListener('click', () => importFileInput.click());
            importFileInput.addEventListener('change', (event) => this.importTemplates(event));
        }

        this.resetTemplateForm();
        this.renderTemplateList();
    }

    public async loadTemplates(): Promise<void> {
        console.log("Loading templates from chrome.storage.sync...");
        try {
            // @ts-ignore
            const result = await chrome.storage.sync.get('templates');
            this.templates = result.templates || [];

            if (this.templates.length === 0) {
                await this.createAndLoadDefaultPresets();
            } else {
                this.renderTemplateList();
            }
            console.log("Templates loaded:", this.templates);
        } catch (error) {
            this.handleError(error, "Failed to load templates.");
        }
    }

    private async createAndLoadDefaultPresets(): Promise<void> {
        console.log("No templates found in storage. Creating default presets.");
        const defaultTemplates: Template[] = [
            {
                id: this.generateId(),
                name: "Default Feature PR",
                content: "## Overview\n{pr_body}\n\n## Background\n{background}\n\n## Changes Made\n{changes}\n\n## Testing\n{tests}",
                metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
            },
            {
                id: this.generateId(),
                name: "Simple Bugfix PR",
                content: "## Issue Fixed\n{pr_title}\n\n## Description of Fix\n{changes}",
                metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
            }
        ];
        try {
            // @ts-ignore
            await chrome.storage.sync.set({ templates: defaultTemplates });
            this.templates = defaultTemplates;
            this.renderTemplateList();
            this.showFeedback("Loaded default templates as no existing templates were found.", "info");
        } catch (error) {
            this.handleError(error, "Failed to save default templates.");
        }
    }

    private generateId(): string {
        return `template_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    public resetTemplateForm(): void {
        const idInput = document.getElementById('template-id') as HTMLInputElement;
        const nameInput = document.getElementById('template-name') as HTMLInputElement;
        const contentInput = document.getElementById('template-content') as HTMLTextAreaElement;
        const saveButton = document.getElementById('save-template-button') as HTMLButtonElement;
        const formHeading = document.getElementById('template-form-heading') as HTMLHeadingElement;
        const previewArea = document.getElementById('template-preview-area');

        if (idInput) idInput.value = "";
        if (nameInput) nameInput.value = "";
        if (contentInput) contentInput.value = "";
        if (saveButton) saveButton.textContent = "Save New Template";
        if (formHeading) formHeading.textContent = "Add New Template";
        if (previewArea) previewArea.innerHTML = '<p><em>Preview will appear here...</em></p>';

        if (nameInput) nameInput.focus();
        console.log("Template form reset to 'Add New' mode.");
    }

    public async saveTemplateFromForm(): Promise<void> {
        const idInput = document.getElementById('template-id') as HTMLInputElement;
        const nameInput = document.getElementById('template-name') as HTMLInputElement;
        const contentInput = document.getElementById('template-content') as HTMLTextAreaElement;

        if (!nameInput || !contentInput || !idInput || !nameInput.value.trim() || !contentInput.value.trim()) {
            this.showFeedback("Template name and content cannot be empty.", "error");
            return;
        }

        const name = nameInput.value.trim();
        const content = contentInput.value.trim();
        const id = idInput.value;

        let templateToSave: Template;
        let isUpdate = false;

        if (id) {
            const existingTemplate = this.templates.find(t => t.id === id);
            if (!existingTemplate) {
                this.showFeedback("Template not found for update.", "error");
                this.resetTemplateForm();
                return;
            }
            templateToSave = {
                ...existingTemplate,
                name,
                content,
                metadata: {
                    ...(existingTemplate.metadata || { createdAt: new Date().toISOString() }),
                    updatedAt: new Date().toISOString(),
                }
            };
            isUpdate = true;
        } else {
            templateToSave = {
                id: this.generateId(),
                name,
                content,
                metadata: {
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                }
            };
        }

        try {
            if (isUpdate) {
                this.templates = this.templates.map(t => t.id === id ? templateToSave : t);
            } else {
                this.templates.push(templateToSave);
            }
            // @ts-ignore
            await chrome.storage.sync.set({ templates: this.templates });
            this.renderTemplateList();
            this.showFeedback(`Template "${name}" ${isUpdate ? 'updated' : 'saved'} successfully!`, "success");
            this.resetTemplateForm();
        } catch (error) {
            this.handleError(error, `Failed to save template "${name}".`);
            await this.loadTemplates();
        }
    }

    public async deleteTemplate(templateId: string): Promise<void> {
        const templateToDelete = this.templates.find(t => t.id === templateId);
        if (!templateToDelete) {
            this.showFeedback(`Template with ID ${templateId} not found.`, "error");
            return;
        }

        if (!window.confirm(`Are you sure you want to delete the template "${templateToDelete.name}"?`)) {
            return;
        }

        try {
            this.templates = this.templates.filter(t => t.id !== templateId);
            // @ts-ignore
            await chrome.storage.sync.set({ templates: this.templates });
            this.renderTemplateList();
            this.showFeedback(`Template "${templateToDelete.name}" deleted successfully.`, "success");
            const currentFormId = (document.getElementById('template-id') as HTMLInputElement)?.value;
            if (currentFormId === templateId) {
                this.resetTemplateForm();
            }
        } catch (error) {
            this.handleError(error, `Failed to delete template "${templateToDelete.name}".`);
            await this.loadTemplates();
        }
    }

    public populateFormForEdit(templateId: string): void {
        const template = this.templates.find(t => t.id === templateId);
        if (template) {
            const nameInput = document.getElementById('template-name') as HTMLInputElement;
            const contentInput = document.getElementById('template-content') as HTMLTextAreaElement;
            const idInput = document.getElementById('template-id') as HTMLInputElement;
            const saveButton = document.getElementById('save-template-button') as HTMLButtonElement;
            const formHeading = document.getElementById('template-form-heading') as HTMLHeadingElement;

            if (nameInput && contentInput && idInput && saveButton && formHeading) {
                nameInput.value = template.name;
                contentInput.value = template.content;
                idInput.value = template.id;
                saveButton.textContent = "Update Template";
                formHeading.textContent = `Edit Template: ${template.name}`;
                nameInput.focus();
                this.previewTemplate();
                this.showFeedback(`Editing template: "${template.name}". Modify and click "Update Template".`, "info");
            }
        } else {
            this.showFeedback(`Template with ID ${templateId} not found for editing.`, "error");
            this.resetTemplateForm();
        }
    }

    public previewTemplate(): void {
        const contentInput = document.getElementById('template-content') as HTMLTextAreaElement;
        const previewArea = document.getElementById('template-preview-area');

        if (!contentInput || !previewArea) {
            this.showFeedback("Preview elements not found.", "error");
            return;
        }

        let content = contentInput.value;
        const placeholders = {
            '{branch_name}': 'feature/example-branch',
            '{pr_title}': 'Example PR: Implement New Feature',
            '{pr_body}': 'This is the main body of the PR description, summarizing changes.',
            '{diff_summary}': '- Added X function\n- Modified Y component\n- Fixed bug Z',
            '{commit_messages}': '- feat: Add new button\n- fix: Correct typo in user guide',
            '{file_changes}': 'src/components/feature.tsx (new), src/utils/helpers.ts (modified)',
            '{background}': 'This project aims to solve problem X by implementing Y. This PR contributes by adding Z.',
            '{changes}': 'Implemented the core logic for feature A.\nAdded unit tests for B.\nUpdated documentation for C.',
            '{tests}': 'All unit tests pass. Integration tests cover critical paths.',
        };

        for (const [placeholder, exampleValue] of Object.entries(placeholders)) {
            content = content.split(placeholder).join(exampleValue);
        }

        previewArea.textContent = content;
        this.showFeedback("Template preview updated.", "info");
    }

    public exportTemplates(): void {
        if (this.templates.length === 0) {
            this.showFeedback("No templates to export.", "info");
            return;
        }
        try {
            const jsonData = JSON.stringify(this.templates, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'templates_export.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showFeedback("Templates exported successfully.", "success");
        } catch (error) {
            this.handleError(error, "Failed to export templates.");
        }
    }

    public async importTemplates(event: Event): Promise<void> {
        const fileInput = event.target as HTMLInputElement;
        if (!fileInput.files || fileInput.files.length === 0) {
            this.showFeedback("No file selected for import.", "info");
            return;
        }
        const file = fileInput.files[0];
        if (file.type !== "application/json") {
            this.showFeedback("Please select a valid JSON file.", "error");
            fileInput.value = ""; // Reset file input
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const importedData = JSON.parse(content);

                if (!Array.isArray(importedData) || !importedData.every(t => t.id && t.name && t.content)) {
                    this.showFeedback("Invalid template data structure in JSON file. Ensure it's an array of templates with id, name, and content.", "error");
                    return;
                }

                this.templates = importedData as Template[];
                // @ts-ignore
                await chrome.storage.sync.set({ templates: this.templates });
                this.renderTemplateList();
                this.resetTemplateForm();
                this.showFeedback("Templates imported successfully (all existing templates were replaced).", "success");

            } catch (error) {
                this.handleError(error, "Failed to import templates. Ensure the file is valid JSON.");
            } finally {
                fileInput.value = "";
            }
        };
        reader.onerror = () => {
            this.handleError(reader.error, "Failed to read the selected file.");
            fileInput.value = "";
        };
        reader.readAsText(file);
    }

    private renderTemplateList(): void {
        const templateListElement = document.getElementById('template-list');
        if (templateListElement) {
            if (this.templates.length === 0) {
                templateListElement.innerHTML = '<li>No templates configured yet.</li>';
                return;
            }
            templateListElement.innerHTML = this.templates.map(t => `
                <li>
                    <span>${t.name} (ID: ${t.id.substring(0,8)}...)</span>
                    <button class="edit-template-button" data-id="${t.id}">Edit</button>
                    <button class="delete-template-button" data-id="${t.id}">Delete</button>
                </li>
            `).join('');

            document.querySelectorAll('.delete-template-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    const target = event.target as HTMLButtonElement;
                    const templateId = target.dataset.id;
                    if (templateId) this.deleteTemplate(templateId);
                });
            });

            document.querySelectorAll('.edit-template-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    const target = event.target as HTMLButtonElement;
                    const templateId = target.dataset.id;
                    if (templateId) this.populateFormForEdit(templateId);
                });
            });
        }
    }

    public handleEvent(event: Event): void { console.log("Generic event handled:", event); }
    public renderSection(section: string): void { console.log("Rendering section:", section); }
    public handleError(error: any, message: string): void {
        console.error("Error:", message, error);
        this.showFeedback(`${message} Details: ${error.message || error}`, 'error');
    }
    public showLoading(section: string, isLoading: boolean): void {
        const el = document.getElementById(`${section}-loading`);
        if (el) el.style.display = isLoading ? 'block' : 'none';
    }
    public showFeedback(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
        console.log(`Feedback (${type}):`, message);
        alert(`[${type.toUpperCase()}] ${message}`);
    }
    public async loadSettings(): Promise<void> { console.log("loadSettings (global) called"); }
    public async saveSettings(): Promise<void> { console.log("saveSettings (global) called"); }
}

document.addEventListener('DOMContentLoaded', () => {
    const controller = new OptionsController();
    controller.init();
});
