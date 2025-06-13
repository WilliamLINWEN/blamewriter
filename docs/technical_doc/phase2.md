## Phase 2: 功能擴展與使用者體驗 - 技術執行文件

### **目標 (Goals)**

基於 MVP，開發完整的設定頁面，實現自訂模板管理、多 LLM 提供商支援和穩健的大型 diff 處理機制。

### **主要任務 (Key Tasks)**

- **前端 (擴充功能)**:
  1.  創建一個 `options.html` 頁面，作為所有設定的中心。
  2.  在 Options 頁面實現自訂模板的 CRUD（創建/讀取/更新/刪除），並使用
      `chrome.storage.sync` 儲存。
  3.  在 Options 頁面實現 LLM 提供商選擇和 API 金鑰輸入介面。
  4.  改造 Popup UI，加入模板和 LLM 模型選擇器。
- **後端 (Node.js/Express)**:
  1.  重構 API 端點為
      `/api/v1/generate`，使其能接收更多參數（模板、LLM 提供商、API Key）。
  2.  實現大型 diff 的 Map-Reduce 處理邏輯。
  3.  增加對 Anthropic, xAI, Ollama 等 API 的支援。
  4.  以非持久化方式處理使用者傳來的 API Key，用完即棄。

### **技術執行文件 (Implementation Document)**

#### **1. 擴充功能實作**

- **`manifest.json`**: 新增 `options_page` 和 `storage` 權限。
  ```json
  "options_page": "options.html",
  "permissions": ["activeTab", "storage"]
  ```
- **`options.js`**:
  - **模板管理**: 使用 `chrome.storage.sync.get('templates', ...)`
    讀取模板，使用 `chrome.storage.sync.set(...)`
    儲存。UI 上提供新增、編輯、刪除按鈕。
  - **API 金鑰**: 當使用者輸入 API Key 並儲存時，將其儲存在
    `chrome.storage.sync`
    中。**（注意：這是為了 Beta 階段的便利性，最終會在 Phase
    3 移除，改為後端處理）。**
- **`popup.js`**:
  - 從 `chrome.storage.sync` 讀取模板列表和 LLM 設定，填充下拉選單。
  - 發送給 `background.js` 的訊息中，包含選擇的模板內容、LLM 提供商和對應的 API
    Key。

#### **2. 後端 API 設計**

- **Endpoint**: `POST /api/v1/generate`
- **Request Body**:
  ```json
  {
    "prUrl": "...",
    "bitbucketToken": "...",
    "llmConfig": {
      "provider": "openai", // "anthropic", "ollama"
      "model": "gpt-4-turbo",
      "apiKey": "user_provided_key" // Ollama 則為 null
    },
    "template": "## 背景\n{background}\n## 變更\n{changes}"
  }
  ```

#### **3. 核心邏輯與演算法**

- **大型 Diff 處理 (Map-Reduce)**:
  1.  **獲取 Diff**: 像 Phase 1 一樣獲取完整 diff。
  2.  **檔案過濾**: 根據使用者設定（未來加入）或預設規則，過濾掉
      `package-lock.json` 等檔案的 diff。
  3.  **分塊 (Split)**: 使用 `langchain/text_splitter`
      或自訂邏輯，將 diff 文本按檔案或固定大小（如 4000 字元）分割成多個塊 (chunks)。
  4.  **映射 (Map)**: 對每一個 chunk 並行發起 LLM 調用，使用一個簡潔的提示，如「請總結以下程式碼變更：\n{chunk_content}」。收集所有摘要。
  5.  **歸約 (Reduce)**: 將所有摘要合併成一份「變更總結」。
  6.  **最終生成**: 將「變更總結」和 PR 標題等元數據，填入使用者選擇的模板中，作為最終提示，調用 LLM 生成完整的 PR 描述。

#### **4. 測試與驗收標準**

- **驗收標準**:
  - 使用者可以在 Options 頁面成功創建和儲存自訂模板。
  - 使用者可以選擇不同的 LLM 提供商（如 OpenAI, Ollama），並使用自己的 API
    Key 成功生成描述。
  - 即使 PR 包含非常大的 diff，系統也能在合理時間內成功生成描述，而不會因超出上下文視窗而失敗。
