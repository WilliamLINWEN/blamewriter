開發過程分為三個主要階段：

1.  **Phase 1: 核心基礎與 MVP (Minimum Viable
    Product)** - 目標是快速建立一個可運作的端到端流程，證明核心概念可行。
2.  **Phase
    2: 功能擴展與使用者體驗** - 在 MVP 基礎上，加入關鍵功能，如自訂模板、多 LLM 支援，讓產品變得實用。
3.  **Phase
    3: 拋光與生產就緒** - 完善使用者體驗，增強穩定性與安全性，準備正式上線。

---

## 開發階段規劃 (Development Phasing)

### **Phase 1: 核心基礎與 MVP (Core Foundation & MVP)**

- **目標**: 建立一個最簡化的端到端工作流程。使用者可以在擴充功能中手動貼上 Bitbucket
  Token，針對當前頁面的 PR，使用固定的 LLM (OpenAI) 和固定的模板生成描述。
- **產出**: 一個內部可用的原型，證明技術路線可行。

### **Phase 2: 功能擴展與使用者體驗 (Feature Expansion & User Experience)**

- **目標**: 讓產品變得真正可用和可配置。引入完整的設定頁面，支援多個 LLM 提供商、自訂模板和大型 diff 處理。
- **產出**: 一個功能完整的 Beta 版本，可供早期使用者測試。

### **Phase 3: 拋光與生產就緒 (Polishing & Production Readiness)**

- **目標**: 提供無縫的使用體驗，並確保產品的穩定性和安全性。實現完整的 OAuth 認證流程和頁面內嵌按鈕。
- **產出**: 一個準備好在瀏覽器商店上架的 1.0 版本。

---

## Phase 1: 核心基礎與 MVP - 技術執行文件

### **目標 (Goals)**

驗證從瀏覽器擴充功能觸發，經由後端服務，調用 Bitbucket API 和 OpenAI
API，最終返回生成描述的完整流程。此階段功能極簡，重在打通技術關節。

### **主要任務 (Key Tasks)**

- **前端 (擴充功能)**:
  1.  建立基本的 `manifest.json` 和檔案結構。
  2.  開發一個簡單的 Popup UI，包含一個輸入框（用於手動貼上 Bitbucket
      Token）、一個「生成描述」按鈕和一個顯示結果的文本區。
  3.  實現 `background.js` 來處理對後端的 API 請求。
- **後端 (Node.js/Express)**:
  1.  建立一個 Express 專案。
  2.  設計一個單一的 API 端點 `/api/v1/generate-mvp`。
  3.  實現該端點的邏輯：接收 PR 資訊和 Bitbucket Token，調用 Bitbucket
      API 獲取 PR diff，然後調用 OpenAI API 生成描述。
  4.  將 Bitbucket App Secret 和 OpenAI API Key 暫時使用環境變數管理。

### **技術執行文件 (Implementation Document)**

#### **1. 專案設定與架構**

- **擴充功能**:

  - `manifest.json`:
    ```json
    {
      "manifest_version": 3,
      "name": "Bitbucket PR Helper (MVP)",
      "version": "0.1.0",
      "permissions": ["activeTab"],
      "host_permissions": ["http://localhost:3001/*"], // 開發時指向本地後端
      "action": {
        "default_popup": "popup.html"
      },
      "background": {
        "service_worker": "background.js"
      }
    }
    ```
  - `popup.html`: 包含一個 token 輸入框、按鈕和結果顯示區。
  - `popup.js`: 處理按鈕點擊事件，從 `chrome.tabs.query`
    獲取當前頁面 URL，讀取 Token，然後透過 `chrome.runtime.sendMessage`
    將任務發送給 `background.js`。
  - `background.js`: 監聽來自 `popup.js` 的訊息，使用 `fetch` API 調用後端。

- **後端**:
  - 使用 `npm init` 創建專案，安裝 `express`, `axios`, `openai`, `dotenv`。
  - `index.js`: 主應用程式文件。
  - `.env`: 儲存 `BITBUCKET_APP_SECRET` 和 `OPENAI_API_KEY`。

#### **2. 後端 API 設計**

- **Endpoint**: `POST /api/v1/generate-mvp`
- **Request Body**:
  ```json
  {
    "prUrl": "https://bitbucket.org/workspace/repo/pull-requests/123",
    "bitbucketToken": "user_pasted_oauth_token"
  }
  ```
- **Response Body**:
  ```json
  {
    "description": "AI-generated PR description text..."
  }
  ```

#### **3. 核心邏輯**

- **`background.js`**:
  ```javascript
  // 監聽訊息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'generate') {
      fetch('http://localhost:3001/api/v1/generate-mvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prUrl: request.url,
          bitbucketToken: request.token,
        }),
      })
        .then(response => response.json())
        .then(data => sendResponse(data))
        .catch(error => sendResponse({ error: error.message }));
      return true; // 保持異步響應通道開啟
    }
  });
  ```
- **後端 `index.js`**:
  1.  從 `prUrl` 中解析出 `workspace`, `repo`, `prId`。
  2.  使用 `bitbucketToken` 作為 Bearer Token，透過 `axios` 調用 Bitbucket API
      `/2.0/repositories/{workspace}/{repo}/pullrequests/{prId}/diff`。
  3.  將獲取的 diff 內容（截取前 4000 字元以防超長）和一個硬編碼的提示（"請根據以下 diff 為這個 PR 撰寫描述..."）傳遞給 OpenAI
      API。
  4.  返回 OpenAI 的生成結果。

#### **4. 測試與驗收標準**

- **驗收標準**: 開發者能夠在 Bitbucket
  PR 頁面，打開擴充功能，手動貼入一個有效的 Bitbucket
  Token，點擊生成按鈕後，在結果區看到由 OpenAI 生成的描述文本。

---
