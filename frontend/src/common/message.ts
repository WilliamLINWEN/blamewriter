import { Template, UserLLMConfig } from './storage_schema';

// --- 從 Content Script 發送到 Background Script ---
// 請求初始化頁面按鈕所需的數據
export interface GetInitialDataRequest {
  action: 'get_initial_data_for_content_script';
}

// --- 從 Popup 或 Content Script 發送到 Background ---
// 這是【統一後】的生成請求
export interface GenerateDescriptionRequest {
  action: 'generate_description'; // <--- 使用一個統一的 action 名稱
  prUrl: string;
  templateContent: string;
  llmConfig: UserLLMConfig;
}

// 請求生成描述
export interface GenerateFromContentScriptRequest {
  action: 'generate_from_content_script';
  prUrl: string;
  templateContent: string;
  llmConfig: UserLLMConfig;
}

// --- 從 Background Script 回應給 Content Script ---
// 回應初始化數據
export interface GetInitialDataResponse {
  isAuthenticated: boolean;
  firstTemplate: Template | null;
  userLLMConfig: UserLLMConfig | null;
  error?: string;
}

// 回應生成的描述
export interface GenerateDescriptionResponse {
  description?: string;
  error?: string;
}

// --- 從 Popup 發送給 Content Script ---
// 請求將文字填入頁面
export interface FillDescriptionRequest {
  action: 'fillDescription';
  description: string;
}
