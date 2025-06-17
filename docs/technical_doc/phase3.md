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
  2.  `launchWebAuthFlow` 的 URL 指向後端的 `/api/auth/bitbucket`，包含隨機生成的 `state` 
      參數和 PKCE （Proof Key for Code Exchange）的 `code_challenge` 參數以增強安全性。
  3.  後端 `/api/auth/bitbucket` 將使用者重定向到 Bitbucket 的授權頁面，並帶上
      `redirect_uri` 指向後端的 `/api/auth/callback`、`state` 參數以及必要的 PKCE 參數。
  4.  使用者授權後，Bitbucket 將帶著 `code` 和原始的 `state` 重定向回 `/api/auth/callback`。
  5.  後端驗證 `state` 參數一致性，然後使用 `code` 和存儲的 `code_verifier` 換取 
      `access_token` 和 `refresh_token`，以支持無縫刷新機制。
  6.  後端將 `access_token` 和 `refresh_token`（可選）重定向到擴充功能提供的特殊回調 URL
      (`https://<extension-id>.chromiumapp.org/callback`)。
  7.  `launchWebAuthFlow` 的回調函數捕獲這個包含 tokens 的 URL，驗證 `state` 參數，
      解析出 tokens 並安全地儲存在 `chrome.storage.local` 中，包括過期時間。
  8.  實現 token 刷新機制，當 access token 過期時，使用 refresh token 靜默獲取新的 access token，
      確保用戶體驗無縫連貫。
- **API Key 處理**:
  - API Key 不再儲存在瀏覽器中。每次生成請求，使用者在 Popup
    UI 中輸入（或從 session
    storage 讀取），直接傳遞給後端。後端在記憶體中使用它，絕不寫入磁碟或資料庫。
- **安全性最佳實踐**:
  - 實現 PKCE 流程防止授權碼攔截攻擊。
  - 使用 `state` 參數防止 CSRF 攻擊。
  - 設置合適的 CSP (Content Security Policy) 策略。
  - 實現適當的異常處理，包含授權錯誤、網絡問題、用戶取消等情況。

#### **2. 擴充功能實作 (Content Script)**

- **`manifest.json`**: 註冊 `content_scripts` 和必要的 OAuth 相關配置。
  ```json
  "content_scripts": [
    {
      "matches": ["https://bitbucket.org/*/*/pull-requests/*"],
      "js": ["content.js"],
      "css": ["content.css"]
    }
  ],
  "permissions": ["activeTab", "storage", "identity"],
  "oauth2": {
    "client_id": "${BITBUCKET_CLIENT_ID}",
    "scopes": ["pullrequest", "repository", "account"]
  }
  ```
- **核心配置文件**: 
  - 建立 `oauth_config.ts`，包含所有 OAuth 相關配置：
    ```typescript
    export const OAUTH_CONFIG = {
      CLIENT_ID: '${BITBUCKET_CLIENT_ID}', // 透過環境變量或構建過程注入
      AUTH_URL: 'https://bitbucket.org/site/oauth2/authorize',
      TOKEN_URL: 'https://bitbucket.org/site/oauth2/access_token',
      REDIRECT_URL: 'https://${EXTENSION_ID}.chromiumapp.org/callback',
      SCOPES: ['pullrequest', 'repository', 'account'],
      TOKEN_STORAGE_KEY: 'bitbucket_auth',
    };
    ```
  - Chrome擴展的EXTENSION_ID獲取方式
    可以在 `manifest.json` 中定義，或在構建過程中動態注入。
    1. 開發階段獲取： 當您在Chrome中載入未打包的擴展程式時，Chrome會為您的擴展分配一個唯一的ID。您可以通過以下方式獲取：
    `const extensionId = chrome.runtime.id;`
    然後您可以在代碼中動態構建重定向URL：
    `const REDIRECT_URL = `https://${chrome.runtime.id}.chromiumapp.org/callback`;`
    2. 開發階段設置固定ID（可選）： 如果您希望在開發過程中使用固定的擴展ID，可以在manifest.json中添加key字段：

    ```json
    {
      "name": "BlameWriter",
      "version": "1.0",
      "manifest_version": 3,
      "key": "YOUR_DEVELOPMENT_KEY"
    }
    ```

- **`content.js`**:
  1.  使用 `MutationObserver` 來監聽頁面 DOM 變化，等待 PR 描述的 `textarea` 出現。
  2.  一旦目標元素出現，就在其附近動態創建並插入一個「✨ AI 生成描述」按鈕。
  3.  為該按鈕添加點擊事件監聽器。點擊時，先檢查授權狀態，若未授權則先觸發授權流程。
  4.  授權完成後，通過 `chrome.runtime.sendMessage` 向 `background.js` 發送生成請求，
      行為與 Popup UI 完全一致，並顯示適當的加載指示器。
  5.  添加錯誤處理邏輯，在授權失敗或API調用失敗時提供清晰的用戶提示。

#### **3. 生產準備**

- **後端**:
  - 添加基礎的日誌記錄，特別是在 API 調用和關鍵邏輯點。
  - 實現 OAuth 相關的路由和控制器：
    ```typescript
    // 初始授權端點
    app.get('/api/auth/bitbucket', authController.initiateAuth);
    
    // 授權回調處理
    app.get('/api/auth/callback', authController.handleCallback);
    
    // Token 刷新端點
    app.post('/api/auth/refresh', authController.refreshToken);
    
    // Token 有效性檢查
    app.post('/api/auth/validate', authController.validateToken);
    ```
  - 實現安全的 token 處理邏輯，包括加密和敏感資料保護。
- **前端**:
  - 在 Popup UI 和 Content Script 的交互中，添加明確的加載中（loading
    spinner）和錯誤狀態顯示。
  - 確保所有使用者輸入都經過適當的清理。
  - 添加授權狀態管理:
    ```typescript
    // 檢查授權狀態
    async function checkAuthStatus() {
      const data = await chrome.storage.local.get(['bitbucket_token', 'token_expiry']);
      if (!data.bitbucket_token) {
        return { authorized: false };
      }
      
      // 檢查 token 是否過期
      if (data.token_expiry && Date.now() > data.token_expiry) {
        // 嘗試刷新 token
        const refreshed = await refreshToken();
        return { authorized: !!refreshed };
      }
      
      // 驗證 token 是否有效
      const valid = await validateToken(data.bitbucket_token);
      return { authorized: valid };
    }
    ```
  - 實現登出功能，允許用戶清除授權狀態。

#### **4. 測試與驗收標準**

- **驗收標準**:
  - 新使用者可以透過點擊按鈕，在彈出的視窗中完成 Bitbucket 授權，全程無需離開瀏覽器。
  - 授權後的使用者體驗無縫連貫，無需頻繁重新登入。
  - 當 token 過期時，系統會自動使用 refresh token 進行靜默更新，用戶無感知。
  - 在 Bitbucket PR 頁面上，能看到並使用注入的「AI 生成描述」按鈕。
  - 當 API 調用失敗或發生錯誤時，使用者能看到清晰的錯誤提示。
  - 產品在 Chrome Web Store 和 Firefox Add-ons 的審核指南下是合規的。

- **安全性測試**:
  - 驗證 PKCE 流程是否正確實現。
  - 確認 state 參數驗證機制有效防止 CSRF 攻擊。
  - 測試所有授權錯誤場景和恢復機制。
  - 檢查 token 存儲是否安全（不可在開發者工具中輕易訪問明文 token）。
  - 確保敏感信息（如 API keys）不會出現在網絡請求或日誌中。

#### **5. 核心代碼實現範例**

- **Background Script OAuth處理**:

```typescript
// background.ts
import { OAUTH_CONFIG } from '../common/oauth_config';
import { generateRandomString, generateCodeChallenge } from '../utils/auth_utils';

// OAuth流程初始化
async function initiateOAuthFlow(): Promise<string | null> {
  try {
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    // 保存狀態和驗證碼供後續使用
    await chrome.storage.local.set({ 
      oauth_state: state, 
      code_verifier: codeVerifier,
      auth_timestamp: Date.now()
    });
    
    // 構建授權URL
    const authUrl = `${OAUTH_CONFIG.AUTH_URL}?` +
      `client_id=${OAUTH_CONFIG.CLIENT_ID}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(OAUTH_CONFIG.REDIRECT_URL)}&` +
      `state=${state}&` +
      `code_challenge=${codeChallenge}&` +
      `code_challenge_method=S256&` +
      `scope=${encodeURIComponent(OAUTH_CONFIG.SCOPES.join(' '))}`;
    
    // 啟動Web Auth流程
    return new Promise((resolve) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            console.error('Auth flow error:', chrome.runtime.lastError.message);
            resolve(null);
            return;
          }
          
          handleAuthRedirect(redirectUrl, resolve);
        }
      );
    });
  } catch (error) {
    console.error('OAuth initialization error:', error);
    return null;
  }
}

// 處理授權重定向
async function handleAuthRedirect(redirectUrl: string | null, resolve: (token: string | null) => void): Promise<void> {
  if (!redirectUrl) {
    console.error('No redirect URL received');
    resolve(null);
    return;
  }
  
  try {
    const url = new URL(redirectUrl);
    const params = new URLSearchParams(url.search);
    const authCode = params.get('code');
    const returnedState = params.get('state');
    
    if (!authCode) {
      console.error('No authorization code received');
      resolve(null);
      return;
    }
    
    // 獲取之前保存的狀態和驗證碼
    const { oauth_state, code_verifier } = await chrome.storage.local.get([
      'oauth_state',
      'code_verifier'
    ]);
    
    // 驗證狀態參數，確保請求來源可信
    if (returnedState !== oauth_state) {
      console.error('State mismatch - possible CSRF attack');
      resolve(null);
      return;
    }
    
    // 使用授權碼換取訪問令牌
    const tokenData = await exchangeCodeForToken(authCode, code_verifier);
    if (tokenData && tokenData.access_token) {
      // 安全地保存令牌
      await chrome.storage.local.set({
        bitbucket_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expiry: Date.now() + (tokenData.expires_in * 1000),
        token_scope: tokenData.scope
      });
      
      resolve(tokenData.access_token);
    } else {
      resolve(null);
    }
  } catch (error) {
    console.error('Error handling auth redirect:', error);
    resolve(null);
  }
}

// 使用授權碼換取令牌
async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: codeVerifier })
    });
    
    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Token exchange error:', error);
    throw error;
  }
}

// 刷新令牌
async function refreshAccessToken(): Promise<string | null> {
  try {
    const { refresh_token } = await chrome.storage.local.get(['refresh_token']);
    
    if (!refresh_token) {
      console.warn('No refresh token available');
      return null;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token })
    });
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }
    
    const tokenData = await response.json();
    
    // 更新保存的令牌
    await chrome.storage.local.set({
      bitbucket_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refresh_token, // 某些OAuth服務不每次都返回刷新令牌
      token_expiry: Date.now() + (tokenData.expires_in * 1000)
    });
    
    return tokenData.access_token;
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

// 驗證令牌
async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}
```

- **後端OAuth處理**:

```typescript
// auth.controller.ts
import { Request, Response } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

// 環境變量
const {
  BITBUCKET_CLIENT_ID,
  BITBUCKET_CLIENT_SECRET,
  BACKEND_URL,
} = process.env;

// 授權初始化
export const initiateAuth = (req: Request, res: Response) => {
  try {
    // 獲取PKCE和狀態參數
    const { code_challenge, state } = req.query;
    
    if (!code_challenge || !state) {
      return res.status(400).json({ 
        error: 'Missing required parameters' 
      });
    }
    
    // 重定向到Bitbucket授權頁面
    const authUrl = `https://bitbucket.org/site/oauth2/authorize` +
      `?client_id=${BITBUCKET_CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(`${BACKEND_URL}/api/auth/callback`)}` +
      `&state=${state}` +
      `&code_challenge=${code_challenge}` +
      `&code_challenge_method=S256` +
      `&scope=pullrequest%20repository%20account`;
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating auth:', error);
    res.status(500).json({ error: 'Authorization initialization failed' });
  }
};

// 授權回調處理
export const handleCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    const { redirect_uri, code_verifier } = req.session;
    
    if (!code || !state || !code_verifier) {
      return res.status(400).json({ 
        error: 'Missing required parameters' 
      });
    }
    
    // 獲取訪問令牌
    const tokenResponse = await axios.post('https://bitbucket.org/site/oauth2/access_token', 
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code.toString(),
        redirect_uri: `${BACKEND_URL}/api/auth/callback`,
        client_id: BITBUCKET_CLIENT_ID,
        client_secret: BITBUCKET_CLIENT_SECRET,
        code_verifier: code_verifier
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const { access_token, refresh_token, expires_in, scope } = tokenResponse.data;
    
    // 清除會話數據
    delete req.session.code_verifier;
    delete req.session.redirect_uri;
    
    // 重定向回擴充功能，帶上所需參數
    const extensionRedirectUrl = `${redirect_uri}?` +
      `access_token=${access_token}&` +
      `refresh_token=${refresh_token}&` +
      `expires_in=${expires_in}&` +
      `scope=${scope}&` +
      `state=${state}`;
    
    res.redirect(extensionRedirectUrl);
  } catch (error) {
    console.error('Callback handling error:', error);
    res.status(500).json({ error: 'Failed to process authorization' });
  }
};

// 令牌刷新
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    // 使用刷新令牌獲取新訪問令牌
    const tokenResponse = await axios.post('https://bitbucket.org/site/oauth2/access_token', 
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
        client_id: BITBUCKET_CLIENT_ID,
        client_secret: BITBUCKET_CLIENT_SECRET
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    res.json(tokenResponse.data);
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};

// 令牌驗證
export const validateToken = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false });
    }
    
    const token = authHeader.split(' ')[1];
    
    // 通過調用Bitbucket API來驗證令牌
    const userResponse = await axios.get('https://api.bitbucket.org/2.0/user', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (userResponse.status === 200) {
      res.json({ valid: true });
    } else {
      res.json({ valid: false });
    }
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(401).json({ valid: false });
  }
};
```

- **工具函數**:

```typescript
// auth_utils.ts
export function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  
  return result;
}

export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  // 使用SHA-256哈希並進行base64url編碼
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  
  return base64UrlEncode(digest);
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  // Base64編碼後替換特殊字符以符合URL安全標準
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
```
