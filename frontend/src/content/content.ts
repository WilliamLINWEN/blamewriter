// Content script for Bitbucket PR Helper extension
// This will be implemented in Phase 1 section 3.6
import {
  GetInitialDataRequest,
  GetInitialDataResponse,
  GenerateDescriptionResponse,
  FillDescriptionRequest,
  GenerateDescriptionRequest,
} from '../common/message';
import { UserLLMConfig, Template } from '../common/storage_schema';

console.log('Content script loaded');

// Content script for Bitbucket PR Helper extension

// ================================= CONFIGURATION =================================
/**
 * 正則表達式，用於檢測當前頁面是否為 Bitbucket 的 Pull Request 頁面。
 * 匹配 .../pull-requests/數字/... 這樣的路徑。
 */
const prPageRegex = /\/pull-requests\/\d+/;

/**
 * 正則表達式，用於從 URL 中提取 PR 的詳細資訊。
 */
// const prInfoRegex =
//   /https:\/\/bitbucket\.org\/(?<workspace>[^/]+)\/(?<repoSlug>[^/]+)\/pull-requests\/(?<prId>\d+)/;

/**
 * PR 描述編輯器的 CSS 選擇器。
 * Bitbucket 使用 Atlassian Editor (ProseMirror)，其編輯區塊有這個固定的 ID。
 */
const editorSelector = '#ak-editor-textarea';

// ================================= STATE & OBSERVERS =================================

let aiButton: HTMLButtonElement | null = null;
let currentEditorElement: HTMLElement | null = null;
/**
 * 用於存放 MutationObserver 實例，以便在離開頁面時能停止它。
 * 設定為 null | MutationObserver 型別，表示它可以是 null 或一個 MutationObserver 物件。
 */
let prDescriptionObserver: MutationObserver | null = null;

// interface PrInfo {
//   workspace: string;
//   repoSlug: string;
//   prId: string;
// }

// ================================= COMMUNICATION =================================
function sendMessageToBackground<TResponse>(message: any): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// ================================= UI & DOM MANIPULATION =================================
function updateAiButtonState({
  enabled,
  text,
  title,
}: {
  enabled: boolean;
  text: string;
  title: string;
}): void {
  if (!aiButton) {
    return;
  }
  aiButton.disabled = !enabled;
  const textSpan = aiButton.querySelector('.text');
  if (textSpan) {
    textSpan.textContent = text;
  }
  aiButton.title = title;
}

function createAiButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = 'bpr-ai-button';
  button.className = 'bpr-ai-button'; // Class is provided by content.css
  button.innerHTML = '<span class="icon">✨</span><span class="text">Loading...</span>';
  button.disabled = true;
  button.title = '正在獲取設定...';
  return button;
}

function fillDescriptionIntoEditor(description: string): void {
  if (!currentEditorElement) {
    console.error('[BPR-Helper] Editor element not found when trying to fill description.');
    return;
  }
  currentEditorElement.focus();
  currentEditorElement.innerHTML = '';
  // Using insertHTML is a robust way to add formatted content to a contenteditable div
  document.execCommand(
    'insertHTML',
    false,
    `<p>${description.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
  );
  console.log('[BPR-Helper] Description successfully filled into the editor.');
}

// ================================= CORE LOGIC =================================

/**
 * 從當前 URL 解析出 PR 資訊。
 * @returns {PrInfo | null} 如果成功解析則返回 PrInfo 物件，否則返回 null。
 */
// function getPrInfoFromUrl(): PrInfo | null {
//   const match = window.location.href.match(prInfoRegex);
//   if (match && match.groups) {
//     const { workspace, repoSlug, prId } = match.groups;
//     if (workspace && repoSlug && prId) {
//       return { workspace, repoSlug, prId };
//     }
//   }
//   return null;
// }

/**
 * 停止並清理 MutationObserver。
 * 這是為了在使用者離開 PR 頁面時，避免不必要的效能損耗。
 */
function stopDescriptionObserver(): void {
  if (prDescriptionObserver) {
    prDescriptionObserver.disconnect();
    prDescriptionObserver = null;
    console.log('[BPR-Helper] 已停止監聽描述編輯器。');
  }
}

/**
 * 啟動 MutationObserver 來等待並操作 PR 描述編輯器。
 */
function startDescriptionObserver(): void {
  // 如果已經在監聽中，則不再重複啟動。
  if (prDescriptionObserver) {
    return;
  }

  // 檢查編輯器是否已存在
  const existingElement = document.querySelector(editorSelector);
  if (existingElement) {
    console.log('[BPR-Helper] 描述編輯器已存在，直接操作。');
    handleEditorAppearance(existingElement as HTMLElement);
    return; // 已存在，無需設定監聽器
  }

  console.log('[BPR-Helper] 等待描述編輯器出現...');

  const observerConfig: MutationObserverInit = {
    childList: true,
    subtree: true,
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const callback: MutationCallback = (mutationsList, observer) => {
    const element = document.querySelector(editorSelector);
    if (element) {
      handleEditorAppearance(element as HTMLElement);
      // 找到後就停止監聽，任務完成
      // stopDescriptionObserver();
    }
  };

  prDescriptionObserver = new MutationObserver(callback);
  prDescriptionObserver.observe(document.body, observerConfig);
}

// ================================= EVENT HANDLERS & INITIALIZATION =================================
/**
 * 當描述編輯器出現時要執行的操作。
 * @param {HTMLElement} editorElement - 出現的編輯器元素。
 */
async function handleEditorAppearance(editorElement: HTMLElement): Promise<void> {
  console.log('[BPR-Helper] Editor has appeared.');
  currentEditorElement = editorElement;

  const toolbar = document.querySelector('[data-testid="ak-editor-secondary-toolbar"]');
  if (!toolbar) {
    return;
  }
  if (document.getElementById('bpr-ai-button')) {
    return;
  } // Already injected

  aiButton = createAiButton();
  const saveButton = toolbar.querySelector<HTMLButtonElement>(
    '[data-testid="comment-save-button"]',
  );
  if (saveButton?.parentNode) {
    saveButton.parentNode.insertBefore(aiButton, saveButton);
  } else {
    toolbar.prepend(aiButton);
  }

  try {
    const request: GetInitialDataRequest = { action: 'get_initial_data_for_content_script' };
    const response = await sendMessageToBackground<GetInitialDataResponse>(request);

    if (response.error) {
      throw new Error(response.error);
    }

    if (!response.isAuthenticated) {
      updateAiButtonState({
        enabled: false,
        text: 'AI 生成描述',
        title: '請點擊擴充功能圖示登入 Bitbucket',
      });
      return;
    }
    if (!response.firstTemplate) {
      updateAiButtonState({
        enabled: false,
        text: 'AI 生成描述',
        title: '找不到模板，請在選項頁面新增一個',
      });
      return;
    }
    const { userLLMConfig } = response;
    if (!userLLMConfig?.providerId || !userLLMConfig.selectedModelId) {
      updateAiButtonState({
        enabled: false,
        text: 'AI 生成描述',
        title: '請在選項頁面設定 LLM Provider 和 Model',
      });
      return;
    }

    // All checks passed, enable the button and set its click handler
    updateAiButtonState({ enabled: true, text: 'AI 生成描述', title: '點擊以生成 PR 描述' });
    aiButton.onclick = createGenerateClickHandler(response.firstTemplate, userLLMConfig);
  } catch (error) {
    console.error('[BPR-Helper] Failed to initialize AI button:', error);
    updateAiButtonState({
      enabled: false,
      text: '錯誤',
      title: `初始化失敗: ${error instanceof Error ? error.message : 'Unknown'}`,
    });
  }
}

function createGenerateClickHandler(template: Template, llmConfig: UserLLMConfig) {
  return async () => {
    if (!aiButton) {
      return;
    }

    const originalContent = aiButton.innerHTML;
    updateAiButtonState({ enabled: false, text: '生成中...', title: 'AI 正在處理您的請求...' });

    try {
      const request: GenerateDescriptionRequest = {
        action: 'generate_description',
        prUrl: window.location.href,
        templateContent: template.content,
        llmConfig: llmConfig,
      };

      const response = await sendMessageToBackground<GenerateDescriptionResponse>(request);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.description) {
        fillDescriptionIntoEditor(response.description);
      } else {
        throw new Error('AI 未返回任何描述內容。');
      }
    } catch (error) {
      console.error('[BPR-Helper] Generation failed:', error);
      alert(`生成描述失敗：\n${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      aiButton.innerHTML = originalContent;
      updateAiButtonState({ enabled: true, text: 'AI 生成描述', title: '點擊以生成 PR 描述' });
    }
  };
}

/**
 * 主要的初始化與清理函數。
 * 根據當前是否在 PR 頁面來決定要做什麼。
 */
function initializeOrCleanup(): void {
  // 停止任何可能正在運行的舊監聽器
  stopDescriptionObserver();
  currentEditorElement = null;

  // 檢查目前是否在 PR 頁面
  if (prPageRegex.test(window.location.pathname)) {
    console.log('[BPR-Helper] Bitbucket PR 頁面已偵測。');
    // const prInfo = getPrInfoFromUrl();
    // if (prInfo) {
    //   console.log('[BPR-Helper] PR 資訊:', prInfo);
    //   injectCustomUI(prInfo);
    startDescriptionObserver(); // 在 PR 頁面，開始監聽編輯器
    // } else {
    //   console.error('[BPR-Helper] 無法從 URL 中解析 PR 資訊。');
    // }
  } else {
    console.log('[BPR-Helper] 目前不是 Bitbucket PR 頁面。');
  }
}

// ================================= UI INJECTION =================================
/**
 * 注入自訂 UI 到頁面上的函數。
 * @param {PrInfo} prInfo - 從 URL 解析出的 PR 資訊。
 */
// function injectCustomUI(prInfo: PrInfo): void {
//   console.log('[BPR-Helper] 執行 UI 注入邏輯。PR Info:', prInfo);
//   // TODO: 實現實際的 UI 注入
//   // 例如，可以找到頁面上的某個固定位置，並在那裡插入一個按鈕。
//   const targetContainer = document.querySelector('.ak-editor-content-area');
//   if (targetContainer && !document.getElementById('bpr-helper-button')) {
//     const myButton = document.createElement('button');
//     myButton.id = 'bpr-helper-button';
//     myButton.textContent = 'PR Helper';
//     myButton.style.marginLeft = '8px';
//     myButton.onclick = () => alert(`Hello from PR #${prInfo.prId}`);
//     targetContainer.appendChild(myButton);
//   }
// }

// ================================= SPA ROUTE CHANGE HANDLING =================================

/**
 * 處理 SPA 路由變化的中央函數。
 */
function setupSpaRouteChangeHandling(): void {
  const originalPushState = history.pushState;
  // 攔截 history.pushState 來監聽 SPA 路由變化
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    // 使用 setTimeout 確保在 DOM 更新後再執行我們的邏輯。
    // 在 SPA 中，URL 的改變和頁面內容的實際渲染可能存在微小延遲。
    setTimeout(initializeOrCleanup, 500);
  };
  const originalReplaceState = history.replaceState;
  // 攔截 history.replaceState (某些情況下也會用到)
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    setTimeout(initializeOrCleanup, 500);
  };
  // 監聽瀏覽器的前進/後退按鈕事件
  window.addEventListener('popstate', () => setTimeout(initializeOrCleanup, 500));
}

function setupMessageListenerFromPopup(): void {
  chrome.runtime.onMessage.addListener((request: FillDescriptionRequest, sender, sendResponse) => {
    if (request.action === 'fillDescription') {
      if (currentEditorElement) {
        fillDescriptionIntoEditor(request.description);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Editor not found on the page.' });
      }
    }
  });
}

// ================================= INITIALIZATION =================================
console.log('[BPR-Helper] 內容腳本已載入。');

setupSpaRouteChangeHandling();
setupMessageListenerFromPopup();
// 腳本初次載入時，立即執行一次檢查。
initializeOrCleanup();
// 匯出一個空物件以符合 TypeScript 的模組要求
export {};
