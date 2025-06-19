## Phase 3: 拋光與生產就緒 - 技術執行文件

### **目標 (Goals)**

實現無縫的 OAuth 認證流程，加入頁面內嵌按鈕提升體驗，並為產品上線做好準備。

### **主要任務 (Key Tasks)**

- **前端 (擴充功能)**:
  1.  使用 `chrome.identity.launchWebAuthFlow` 實現完整的 Bitbucket OAuth
      2.0 認證。
  2.  開發一個 `content.js` 腳本，在 Bitbucket
      PR 頁面動態注入「AI 生成描述」按鈕。
  3.  移除將 API Key 儲存在 `chrome.storage` 的做法。
  4.  完善 UI/UX，包括加載狀態、錯誤提示等。
- **後端 (Node.js/Express)**:
  1.  新增 `/api/auth/bitbucket` 和 `/api/auth/callback` 端點來處理 OAuth 流程。
  2.  增強安全性，確保 API Key 在傳輸和使用過程中的安全。
  3.  引入日誌和監控（如 Sentry）。

### **技術執行文件 (Implementation Document)**

#### **1. 認證與安全性**

- **`manifest.json`**: 新增 `identity` 權限。
- **OAuth 流程**:
  1.  在 `background.js` 中，當需要認證時，調用
      `chrome.identity.launchWebAuthFlow`。
  2.  `launchWebAuthFlow` 的 URL 指向後端的 `/api/auth/bitbucket`。
  3.  後端 `/api/auth/bitbucket` 將使用者重定向到 Bitbucket 的授權頁面，並帶上
      `redirect_uri` 指向後端的 `/api/auth/callback`。
  4.  使用者授權後，Bitbucket 將帶著 `code` 重定向回 `/api/auth/callback`。
  5.  後端用 `code` 換取 `access_token`，然後將此 `token`
      重定向到擴充功能提供的特殊回調 URL
      (`https://<extension-id>.chromiumapp.org/...`)。
  6.  `launchWebAuthFlow`
      的回調函數捕獲這個包含 token 的 URL，解析出 token 並安全地儲存在
      `chrome.storage.local` 中。
- **API Key 處理**:
  - API Key 不再儲存在瀏覽器中。每次生成請求，使用者在 Popup
    UI 中輸入（或從 session
    storage 讀取），直接傳遞給後端。後端在記憶體中使用它，絕不寫入磁碟或資料庫。

#### **2. 擴充功能實作 (Content Script)**

- **`manifest.json`**: 註冊 `content_scripts`。
  ```json
  "content_scripts": [
    {
      "matches": ["https://bitbucket.org/*/*/pull-requests/*"],
      "js": ["content.js"],
      "css": ["content.css"]
    }
  ]
  ```
- **`content.js`**:
  1.  使用 `MutationObserver` 或 `setInterval`
      來監聽頁面 DOM 變化，等待 PR 描述的 `textarea` 出現。
  2.  一旦目標元素出現，就在其附近動態創建並插入一個「✨ AI 生成描述」按鈕。
  3.  為該按鈕添加點擊事件監聽器。點擊時，通過 `chrome.runtime.sendMessage` 向
      `background.js` 發送生成請求，行為與 Popup UI 完全一致。

#### **3. 生產準備**

- **後端**:
  - 整合 Sentry SDK，捕獲所有未處理的異常。
  - 添加基礎的日誌記錄，特別是在 API 調用和關鍵邏輯點。
- **前端**:
  - 在 Popup UI 和 Content Script 的交互中，添加明確的加載中（loading
    spinner）和錯誤狀態顯示。
  - 確保所有使用者輸入都經過適當的清理。

#### **4. 測試與驗收標準**

- **驗收標準**:
  - 新使用者可以透過點擊按鈕，在彈出的視窗中完成 Bitbucket 授權，全程無需離開瀏覽器。
  - 在 Bitbucket PR 頁面上，能看到並使用注入的「AI 生成描述」按鈕。
  - 當 API 調用失敗或發生錯誤時，使用者能看到清晰的錯誤提示。
  - 產品在 Chrome Web Store 和 Firefox Add-ons 的審核指南下是合規的。
