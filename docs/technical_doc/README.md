# Bitbucket PR Description Generator - Browser Extension

## 🌟 專案概述 (Project Overview)

本專案是一個瀏覽器擴充功能，旨在將 AI 能力直接嵌入 Bitbucket，自動為 Pull
Requests (PR) 生成高品質的描述。使用者在瀏覽 Bitbucket
PR 頁面時，可以一鍵觸發此功能，擴充功能會分析 PR 的程式碼變更 (diff)，並透過大型語言模型 (LLM) 生成結構化的描述文本，最終將其填入描述框。

**核心目標 (Core Goal):**
消除開發者在撰寫 PR 描述時的上下文切換和重複性工作，將整個流程無縫整合到 Bitbucket 的原生工作流中，從而顯著提升開發效率。

## 🚀 技術棧 (Tech Stack)

本專案採用現代化的 JavaScript 全棧解決方案，確保前後端技術的一致性與開發效率。

### **前端 (Browser Extension - `frontend`)**

- **語言 (Language):** TypeScript

### **後端 (Backend Service - `backend`)**

- **框架 (Framework):** Node.js + Express.js
  - _理由: 成熟、穩定且輕量的後端框架，擁有龐大的生態系統，與前端 JavaScript 技術棧無縫對接。_
- **語言 (Language):** TypeScript
  - _理由: 與前端保持一致，提供端到端的型別安全。_
- **LLM 整合 (LLM Integration):** LangChain.js
  - _理由: 標準化與多個 LLM 提供商 (OpenAI, Anthropic,
    Ollama 等) 的互動，並提供強大的工具鏈 (如文本分割、提示模板、鏈式調用) 來處理複雜的 AI 任務。_
- **API 通訊 (API Communication):** Axios
  - _理由: 強大且易於使用的 HTTP 客戶端，用於與 Bitbucket
    API 和其他外部服務進行通訊。_

## 🏛️ 專案架構 (Project Architecture)

本專案採用典型的**前後端分離架構**：

1.  **瀏覽器擴充功能 (Frontend):**

    - **職責:** 作為使用者介面層，負責與使用者互動。
    - `Content Script`: 注入到 Bitbucket 頁面，讀取頁面資訊並嵌入 UI 元素。
    - `Popup Script`: 擴充功能彈出視窗的 UI。
    - `Options Page`: 完整的設定頁面，用於使用者認證和配置。
    - `Background Script`: 作為擴充功能的大腦，處理核心邏輯和對後端 API 的請求。

2.  **後端服務 (Backend):**
    - **職責:** 作為安全的業務邏輯處理層。
    - **API 代理:** 代理所有對 Bitbucket API 和 LLM
      API 的請求，隱藏敏感的憑證 (如 App Secret, LLM API Keys)。
    - **認證處理:** 處理 Bitbucket OAuth 2.0 認證流程。
    - **核心 AI 邏輯:**
      接收前端傳來的 PR 資訊，獲取 diff，使用 LangChain.js 進行分塊、摘要 (Map-Reduce)，並調用 LLM 生成最終描述。

### **工作流程示意圖 (Workflow Diagram)**

```
[User on Bitbucket] -> [Content Script / Popup UI] -> [Background Script] -> [Backend API]
                                                                              |
                                        +-------------------------------------+
                                        | 1. Call Bitbucket API (get diff)
                                        | 2. Process diff with LangChain.js (Map-Reduce)
                                        | 3. Call LLM API (generate description)
                                        +-------------------------------------+
                                                                              |
                                        <-------------------------------------+ [Returns Description]
```

## 🛠️ 如何開始開發 (Getting Started)

1.  **進入後端目錄:** `cd backend`
    - 安裝依賴: `npm install`
    - 設定環境變數: 複製 `.env.example` 為 `.env` 並填入必要的 API 金鑰。
    - 啟動後端服務: `npm run dev`
2.  **進入前端目錄:** `cd ../frontend`
    - 安裝依賴: `npm install`
    - 啟動開發伺服器: `npm run dev`
    - 在瀏覽器中載入未封裝的擴充功能，指向 `frontend/dist` 目錄。
