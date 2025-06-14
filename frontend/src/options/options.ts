console.log("Options script loaded.");

import {
    Template,
    UserLLMConfig,
    AppSettings,
    CURRENT_SCHEMA_VERSION,
    LLMProvider,
    ModelDetail,
    ExtensionStorage // Added for export/import all
} from '../common/storage_schema';

import { getFromStorage, saveToStorage } from '../common/storage_utils';

interface IOptionsController {
    init(): Promise<void>;
    loadTemplates(): Promise<void>;
    saveTemplateFromForm(): Promise<void>;
    deleteTemplate(templateId: string): Promise<void>;
    populateFormForEdit(templateId: string): void;
    resetTemplateForm(): void;
    previewTemplate(): void;
    exportAllSettings(): Promise<void>; // Renamed
    importAllSettings(event: Event): Promise<void>; // Renamed

    loadLLMConfiguration(): Promise<void>;
    saveLLMConfiguration(): Promise<void>;
    renderLLMProviderSelection(): void;
    handleProviderSelectionChanged(): void;
    setupStorageListeners(): void;

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
        providerId: null, apiKey: null, selectedModelId: null, customEndpoint: null,
    };

    constructor() {
        console.log("OptionsController initialized.");
    }

    public async init(): Promise<void> {
        console.log("OptionsController init method called.");
        await this.initializeAppSettings();

        this.loadTemplates();
        const saveButton = document.getElementById('save-template-button');
        if (saveButton) saveButton.addEventListener('click', () => this.saveTemplateFromForm());
        const clearFormButton = document.getElementById('clear-template-form-button');
        if (clearFormButton) clearFormButton.addEventListener('click', () => this.resetTemplateForm());
        const previewButton = document.getElementById('preview-template-button');
        if (previewButton) previewButton.addEventListener('click', () => this.previewTemplate());

        // Updated event listeners for new function names
        const exportButton = document.getElementById('export-templates-button');
        if (exportButton) exportButton.addEventListener('click', () => this.exportAllSettings());
        const importButton = document.getElementById('import-templates-button');
        const importFileInput = document.getElementById('import-file-input') as HTMLInputElement;
        if (importButton && importFileInput) {
            importButton.addEventListener('click', () => importFileInput.click());
            importFileInput.addEventListener('change', (event) => this.importAllSettings(event));
        }
        this.resetTemplateForm();

        this.initializeLLMProviders();
        await this.loadLLMConfiguration();

        const providerSelect = document.getElementById('llm-provider-select') as HTMLSelectElement;
        if (providerSelect) providerSelect.addEventListener('change', () => this.handleProviderSelectionChanged());

        const saveLLMButton = document.getElementById('save-llm-config-button');
        if (saveLLMButton) saveLLMButton.addEventListener('click', () => this.saveLLMConfiguration());

        this.setupStorageListeners();
    }

    private setupStorageListeners(): void {
        // @ts-ignore
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'sync') return;
            console.log("Options: Storage changed:", changes);
            if (changes.userLLMConfig) this.loadLLMConfiguration().catch(e=>console.error("Error reloading LLM config on change",e));
            if (changes.templates) this.loadTemplates().catch(e=>console.error("Error reloading templates on change",e));
            if (changes.appSettings) this.initializeAppSettings().catch(e=>console.error("Error reloading app settings on change",e));
        });
    }

    private async initializeAppSettings(): Promise<void> {
        console.log("Initializing app settings...");
        try {
            let settings = await getFromStorage('appSettings', { schemaVersion: 0, lastSeenVersion: '0.0.0' });
             if (!settings || typeof settings.schemaVersion !== 'number' || settings.schemaVersion < CURRENT_SCHEMA_VERSION) {
                console.log(`Old schema (${settings?.schemaVersion}) or no settings. Current: ${CURRENT_SCHEMA_VERSION}.`);
                settings = { schemaVersion: CURRENT_SCHEMA_VERSION,
                    // @ts-ignore
                    lastSeenVersion: chrome.runtime.getManifest().version };
                await saveToStorage({ appSettings: settings });
                this.showFeedback(`App settings initialized/updated to schema v${CURRENT_SCHEMA_VERSION}.`, "info");
            } else console.log(`App settings loaded. Schema v: ${settings.schemaVersion}`);
        } catch (error) { this.handleError(error, "Failed to initialize app settings."); }
    }

    private initializeLLMProviders(): void {
        this.llmProviders = [
            { id: 'openai', name: 'OpenAI', apiKeyLabel: 'OpenAI API Key', requiresApiKey: true, models: [ {id: 'gpt-4o', name: 'GPT-4o'}, {id: 'gpt-4-turbo', name: 'GPT-4 Turbo'}, { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' } ], requiresCustomEndpoint: false, helpText: 'Get API key from platform.openai.com.' },
            { id: 'anthropic', name: 'Anthropic (Claude)', apiKeyLabel: 'Anthropic API Key', requiresApiKey: true, models: [ {id: 'claude-3-opus-20240229', name: 'Claude 3 Opus'}, {id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet'}, { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' } ], requiresCustomEndpoint: false, helpText: 'Get API key from console.anthropic.com.' },
            { id: 'ollama', name: 'Ollama (Local)', requiresApiKey: false, models: [ {id: 'llama3', name: 'Llama 3 (default)'}, {id: 'codellama', name: 'CodeLlama'}, {id: 'phi3', name: 'Phi-3'} ], requiresCustomEndpoint: true, customEndpointLabel: 'Ollama Server URL', helpText: 'Ensure Ollama server is running.' },
        ];
    }

    public async loadLLMConfiguration(): Promise<void> {
        try {
            this.currentUserLLMConfig = await getFromStorage('userLLMConfig', { providerId: null, apiKey: null, selectedModelId: null, customEndpoint: null });
        } catch (error) {
            this.handleError(error, "Failed to load LLM config.");
            this.currentUserLLMConfig = { providerId: null, apiKey: null, selectedModelId: null, customEndpoint: null };
        }
        this.renderLLMProviderSelection();
    }

    public async saveLLMConfiguration(): Promise<void> {
        const selProvId = (document.getElementById('llm-provider-select') as HTMLSelectElement)?.value;
        const provider = this.llmProviders.find(p => p.id === selProvId);
        if (provider && provider.requiresApiKey) {
            const apiKeyInput = document.getElementById('llm-api-key') as HTMLInputElement;
            if (!apiKeyInput || !apiKeyInput.value.trim()) { this.showFeedback(`API Key for ${provider.name} cannot be empty.`, "error"); return; }
        }
        let cfgToSave: UserLLMConfig;
        if(!provider){ cfgToSave = {providerId:null,apiKey:null,selectedModelId:null,customEndpoint:null}; }
        else {
            const apiKeyInput = document.getElementById('llm-api-key') as HTMLInputElement;
            const endpointInput = document.getElementById('llm-custom-endpoint') as HTMLInputElement;
            const modelSelect = document.getElementById('llm-model-select') as HTMLSelectElement;
            cfgToSave = {
                providerId: provider.id,
                apiKey: (provider.requiresApiKey && apiKeyInput) ? (apiKeyInput.value.trim() || null) : null,
                customEndpoint: (provider.requiresCustomEndpoint && endpointInput) ? (endpointInput.value.trim() || null) : null,
                selectedModelId: (modelSelect && modelSelect.value) ? modelSelect.value : null
            };
            if (provider && (!provider.models || provider.models.length === 0)) cfgToSave.selectedModelId = null;
        }
        this.currentUserLLMConfig = cfgToSave;
        try { await saveToStorage({ userLLMConfig: this.currentUserLLMConfig }); this.showFeedback("LLM config saved.", "success");
        } catch (e) { this.handleError(e, "Failed to save LLM config."); }
    }

    public renderLLMProviderSelection(): void {
        const ps = document.getElementById('llm-provider-select') as HTMLSelectElement; if(!ps)return;
        ps.innerHTML='<option value="">-- Select Provider --</option>';
        this.llmProviders.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;ps.appendChild(o);});
        ps.value = this.currentUserLLMConfig?.providerId || "";
        this.handleProviderSelectionChanged();
    }

    public handleProviderSelectionChanged(): void {
        const ps = document.getElementById('llm-provider-select') as HTMLSelectElement; const selProvId=ps.value;
        const prov = this.llmProviders.find(p=>p.id===selProvId);
        const sc = document.getElementById('llm-provider-settings-container'); const htc = document.getElementById('llm-provider-helptext-container');
        if(!sc || !htc)return; sc.innerHTML='';htc.innerHTML='';
        let cfg = this.currentUserLLMConfig || {providerId:null,apiKey:null,selectedModelId:null,customEndpoint:null};

        if(!prov){sc.innerHTML='<p><em>Select provider to see settings.</em></p>'; if(cfg.providerId!==null)cfg.selectedModelId=null; cfg.providerId=null; this.currentUserLLMConfig=cfg; return;}
        if(cfg.providerId !== prov.id) cfg.selectedModelId=null; cfg.providerId=prov.id;

        if(prov.requiresApiKey){
            const l=document.createElement('label');l.htmlFor='llm-api-key';l.textContent=prov.apiKeyLabel||'API Key:';
            const i=document.createElement('input');i.type='password';i.id='llm-api-key';i.name='llm-api-key'; i.value=(cfg.providerId===prov.id&&cfg.apiKey)?cfg.apiKey:''; i.placeholder='Enter API key';i.style.width='calc(90% - 100px)';
            const b=document.createElement('button');b.id='verify-api-key-button';b.textContent='Verify';b.disabled=true;b.title='Not implemented';b.style.marginLeft='10px';
            sc.append(l,document.createElement('br'),i,b,document.createElement('br'));
        } else if(cfg.providerId===prov.id)cfg.apiKey=null;

        if(prov.requiresCustomEndpoint){
            const l=document.createElement('label');l.htmlFor='llm-custom-endpoint';l.textContent=prov.customEndpointLabel||'Endpoint URL:';
            const i=document.createElement('input');i.type='text';i.id='llm-custom-endpoint';i.name='llm-custom-endpoint'; i.value=(cfg.providerId===prov.id&&cfg.customEndpoint)?cfg.customEndpoint:''; i.placeholder='e.g., http://localhost:11434';i.style.width='90%';
            sc.append(l,document.createElement('br'),i,document.createElement('br'));
        } else if(cfg.providerId===prov.id)cfg.customEndpoint=null;

        if(prov.models && prov.models.length>0){
            const l=document.createElement('label');l.htmlFor='llm-model-select';l.textContent='Select Model:';
            const s=document.createElement('select');s.id='llm-model-select';s.name='llm-model-select'; s.innerHTML='<option value="">-- Select Model --</option>';
            prov.models.forEach(m=>{const o=document.createElement('option');o.value=m.id;o.textContent=m.name;s.appendChild(o);});
            if(cfg.providerId===prov.id&&cfg.selectedModelId){if(prov.models.some(m=>m.id===cfg.selectedModelId))s.value=cfg.selectedModelId; else cfg.selectedModelId=null;}
            s.addEventListener('change',e=>{if(this.currentUserLLMConfig)this.currentUserLLMConfig.selectedModelId=(e.target as HTMLSelectElement).value||null;});
            sc.append(document.createElement('br'),l,document.createElement('br'),s,document.createElement('br'));
        } else if(cfg)cfg.selectedModelId=null;

        const cl=document.createElement('p');cl.textContent='Cost:';cl.style.fontWeight='bold'; const ct=document.createElement('p');ct.id='llm-cost';ct.textContent='Details later.';ct.style.fontSize='0.9em';ct.style.color='#777';
        const al=document.createElement('p');al.textContent='Status:';al.style.fontWeight='bold'; const at=document.createElement('p');at.id='llm-availability';at.textContent='Checking later.';at.style.fontSize='0.9em';at.style.color='#777';
        sc.append(document.createElement('br'),cl,ct,document.createElement('br'),al,at);
        if(prov.helpText)htc.textContent=prov.helpText;
        this.currentUserLLMConfig = cfg;
    }

    public async loadTemplates(): Promise<void> {
        try { this.templates = await getFromStorage('templates', []);
            if (this.templates.length === 0) await this.createAndLoadDefaultPresets(); else this.renderTemplateList();
        } catch (e) { this.handleError(e, "Failed to load templates."); }
    }
    private async createAndLoadDefaultPresets(): Promise<void> {
        const d:Template[]=[{id:this.generateId(),name:"Default Feature PR",content:"## Overview\n{pr_body}\n\n## Background\n{background}\n\n## Changes Made\n{changes}\n\n## Testing\n{tests}",metadata:{createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}},{id:this.generateId(),name:"Simple Bugfix PR",content:"## Issue Fixed\n{pr_title}\n\n## Description of Fix\n{changes}",metadata:{createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}}];
        try { await saveToStorage({templates:d}); this.templates=d; this.renderTemplateList(); this.showFeedback("Loaded default templates.","info");
        } catch (e) { this.handleError(e, "Failed to save default templates."); }
    }
    private generateId(): string { return `template_${Date.now()}_${Math.random().toString(36).substring(2,9)}`; }
    public resetTemplateForm(): void {
        const id=document.getElementById('template-id')as HTMLInputElement,nm=document.getElementById('template-name')as HTMLInputElement,ct=document.getElementById('template-content')as HTMLTextAreaElement,sb=document.getElementById('save-template-button')as HTMLButtonElement,fh=document.getElementById('template-form-heading')as HTMLHeadingElement,pa=document.getElementById('template-preview-area');
        if(id)id.value="";if(nm)nm.value="";if(ct)ct.value=""; if(sb)sb.textContent="Save New Template";if(fh)fh.textContent="Add New Template";if(pa)pa.innerHTML='<p><em>Preview...</em></p>';if(nm)nm.focus();
    }
    public async saveTemplateFromForm(): Promise<void> {
        const idIn=document.getElementById('template-id')as HTMLInputElement,nmIn=document.getElementById('template-name')as HTMLInputElement,cnIn=document.getElementById('template-content')as HTMLTextAreaElement;
        if(!nmIn||!cnIn||!idIn||!nmIn.value.trim()||!cnIn.value.trim()){this.showFeedback("Name/content empty.","error");return;}
        const n=nmIn.value.trim(),c=cnIn.value.trim(),id=idIn.value; let ts:Template,iu=false; const now=new Date().toISOString();
        if(id){const et=this.templates.find(t=>t.id===id); if(!et){this.showFeedback("Not found.","error");this.resetTemplateForm();return;} ts={...et,name:n,content:c,metadata:{...(et.metadata||{createdAt:now}),updatedAt:now}}; iu=true;}
        else ts={id:this.generateId(),name:n,content:c,metadata:{createdAt:now,updatedAt:now}};
        try{const ut=iu?this.templates.map(t=>t.id===id?ts:t):[...this.templates,ts]; await saveToStorage({templates:ut}); this.templates=ut; this.renderTemplateList();this.showFeedback(`Template "${n}" ${iu?'updated':'saved'}.`,"success");this.resetTemplateForm();
        }catch(e){this.handleError(e,`Failed to save "${n}".`);}
    }
    public async deleteTemplate(templateId:string):Promise<void>{
        const td=this.templates.find(t=>t.id===templateId); if(!td){this.showFeedback(`ID ${templateId} not found.`,"error");return;}
        if(!window.confirm(`Delete "${td.name}"?`))return;
        try{this.templates=this.templates.filter(t=>t.id!==templateId); await saveToStorage({templates:this.templates}); this.renderTemplateList();this.showFeedback(`"${td.name}" deleted.`,"success"); if((document.getElementById('template-id')as HTMLInputElement)?.value===templateId)this.resetTemplateForm();
        }catch(e){this.handleError(e,`Failed to delete "${td.name}".`);await this.loadTemplates();}
    }
    public populateFormForEdit(templateId:string):void{
        const t=this.templates.find(x=>x.id===templateId); if(!t){this.showFeedback(`ID ${templateId} not found.`,"error");this.resetTemplateForm();return;}
        const n=document.getElementById('template-name')as HTMLInputElement,c=document.getElementById('template-content')as HTMLTextAreaElement,i=document.getElementById('template-id')as HTMLInputElement,s=document.getElementById('save-template-button')as HTMLButtonElement,f=document.getElementById('template-form-heading')as HTMLHeadingElement;
        if(n&&c&&i&&s&&f){n.value=t.name;c.value=t.content;i.value=t.id;s.textContent="Update Template";f.textContent=`Edit: ${t.name}`;n.focus();this.previewTemplate();this.showFeedback(`Editing: "${t.name}".`,"info");}
    }
    public previewTemplate():void{
        const ci=document.getElementById('template-content')as HTMLTextAreaElement,pa=document.getElementById('template-preview-area'); if(!ci||!pa){this.showFeedback("Preview elements missing.","error");return;} let c=ci.value;
        const p={'{branch_name}':'dev/branch','{pr_title}':'Title','{pr_body}':'Body','{diff_summary}':'Diff','{commit_messages}':'Commits','{file_changes}':'Files','{background}':'BG','{changes}':'Changes','{tests}':'Tests'};
        for(const[k,v]of Object.entries(p))c=c.split(k).join(v); pa.textContent=c;this.showFeedback("Preview updated.","info");
    }

    public async exportAllSettings(): Promise<void> {
        this.showFeedback("Exporting all settings...", "info");
        try {
            const templates = await getFromStorage('templates', []);
            const userLLMConfig = await getFromStorage('userLLMConfig', { providerId: null, apiKey: null, selectedModelId: null, customEndpoint: null });
            const appSettings = await getFromStorage('appSettings', { schemaVersion: CURRENT_SCHEMA_VERSION, lastSeenVersion: '' });
            const allSettings: ExtensionStorage = { templates, userLLMConfig, appSettings };
            const jsonData = JSON.stringify(allSettings, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'bitbucket_pr_helper_settings_backup.json';
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            this.showFeedback("All settings exported successfully.", "success");
        } catch (error) { this.handleError(error, "Failed to export all settings."); }
    }

    public async importAllSettings(event: Event): Promise<void> {
        const fileInput = event.target as HTMLInputElement;
        if (!fileInput.files || fileInput.files.length === 0) { this.showFeedback("No file selected.", "info"); return; }
        const file = fileInput.files[0];
        if (file.type !== "application/json") { this.showFeedback("Please select a valid JSON file.", "error"); fileInput.value = ""; return; }
        if (!window.confirm("Import settings? This will OVERWRITE ALL current settings. Export first?")) { fileInput.value = ""; return; }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const importedData = JSON.parse(content) as Partial<ExtensionStorage>;
                if (typeof importedData.templates === 'undefined' || typeof importedData.userLLMConfig === 'undefined' || typeof importedData.appSettings === 'undefined') {
                    this.showFeedback("Invalid file structure. Missing main keys.", "error"); return;
                }
                const settingsToSave: ExtensionStorage = {
                    templates: importedData.templates || [],
                    userLLMConfig: importedData.userLLMConfig || { providerId: null, apiKey: null, selectedModelId: null, customEndpoint: null },
                    appSettings: importedData.appSettings || { schemaVersion: CURRENT_SCHEMA_VERSION, lastSeenVersion: '' }
                };
                await saveToStorage(settingsToSave);
                this.showFeedback("All settings imported! Reloading...", "success");
                await this.initializeAppSettings();
                await this.loadTemplates();
                await this.loadLLMConfiguration();
            } catch (error) { this.handleError(error, "Failed to import settings."); }
            finally { fileInput.value = ""; }
        };
        reader.onerror = () => { this.handleError(reader.error, "Failed to read file."); fileInput.value = ""; };
        reader.readAsText(file);
    }

    private renderTemplateList(): void {
        const el=document.getElementById('template-list');if(!el)return;
        if(this.templates.length===0){el.innerHTML='<li>No templates.</li>';return;}
        el.innerHTML=this.templates.map(t=>`<li><span>${t.name} (ID: ${t.id.substring(0,8)}...)</span> <button class="edit-template-button" data-id="${t.id}">Edit</button> <button class="delete-template-button" data-id="${t.id}">Delete</button></li>`).join('');
        el.querySelectorAll('.edit-template-button').forEach(b=>b.addEventListener('click',e=>this.populateFormForEdit((e.target as HTMLElement).dataset.id!)));
        el.querySelectorAll('.delete-template-button').forEach(b=>b.addEventListener('click',e=>this.deleteTemplate((e.target as HTMLElement).dataset.id!)));
    }
    public handleEvent(event: Event): void { console.log("Generic event:", event); }
    public renderSection(section: string): void { console.log("Render section:", section); }
    public handleError(error: any, message: string): void { console.error("Error:", message, error); this.showFeedback(`${message} ${error?.message || ''}`, 'error'); }
    public showLoading(section: string, isLoading: boolean): void { const el = document.getElementById(`${section}-loading`); if (el) el.style.display = isLoading ? 'block' : 'none'; }
    public showFeedback(message: string, type: 'info' | 'success' | 'error' = 'info'): void { alert(`[${type.toUpperCase()}] ${message}`); }
}

document.addEventListener('DOMContentLoaded', () => {
    const controller = new OptionsController();
    controller.init();
});
