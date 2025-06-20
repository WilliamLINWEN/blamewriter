// Content script for Bitbucket PR Helper extension
// This will be implemented in Phase 1 section 3.6

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
const prInfoRegex =
  /https:\/\/bitbucket\.org\/(?<workspace>[^/]+)\/(?<repoSlug>[^/]+)\/pull-requests\/(?<prId>\d+)/;

/**
 * PR 描述編輯器的 CSS 選擇器。
 * Bitbucket 使用 Atlassian Editor (ProseMirror)，其編輯區塊有這個固定的 ID。
 */
const editorSelector = '#ak-editor-textarea';

// ================================= STATE & OBSERVERS =================================

/**
 * 用於存放 MutationObserver 實例，以便在離開頁面時能停止它。
 * 設定為 null | MutationObserver 型別，表示它可以是 null 或一個 MutationObserver 物件。
 */
let prDescriptionObserver: MutationObserver | null = null;

interface PrInfo {
  workspace: string;
  repoSlug: string;
  prId: string;
}

// ================================= CORE LOGIC =================================

/**
 * 從當前 URL 解析出 PR 資訊。
 * @returns {PrInfo | null} 如果成功解析則返回 PrInfo 物件，否則返回 null。
 */
function getPrInfoFromUrl(): PrInfo | null {
  const match = window.location.href.match(prInfoRegex);
  if (match && match.groups) {
    const { workspace, repoSlug, prId } = match.groups;
    if (workspace && repoSlug && prId) {
      return { workspace, repoSlug, prId };
    }
  }
  return null;
}

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

/**
 * 當描述編輯器出現時要執行的操作。
 * @param {HTMLElement} editorElement - 出現的編輯器元素。
 */
function handleEditorAppearance(editorElement: HTMLElement): void {
  console.log('[BPR-Helper] 描述編輯器已出現！');

  const toolbar = document.querySelector('[data-testid="ak-editor-secondary-toolbar"]');
  if (!toolbar) {
    console.warn('[BPR-Helper] 未找到編輯器工具列。');
    return;
  }

  if (document.getElementById('bpr-ai-button')) {
    // 按鈕已存在，無需重複注入
    return;
  }

  // 創建我們的 AI 按鈕
  const aiButton = document.createElement('button');
  aiButton.id = 'bpr-ai-button';
  aiButton.className = 'bpr-ai-button'; // CSS class 由 content.css 提供

  const iconSpan = document.createElement('span');
  iconSpan.className = 'icon';
  iconSpan.textContent = '✨';

  const textSpan = document.createElement('span');
  textSpan.textContent = 'AI 生成描述';

  aiButton.appendChild(iconSpan);
  aiButton.appendChild(textSpan);

  // 設定按鈕的點擊事件
  aiButton.onclick = async () => {
    console.log('[BPR-Helper] AI 生成描述按鈕被點擊！');
    const originalText = aiButton.innerHTML; // 保存原始內容
    aiButton.disabled = true;
    aiButton.textContent = '生成中...';

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const description =
        '## 🚀 功能摘要\n\n- 新增了 X 功能，解決了 Y 問題。\n\n## 🧪 測試計畫\n\n- 執行了單元測試。\n- 進行了端到端測試，確保流程無誤。';

      editorElement.focus();
      editorElement.innerHTML = '';
      document.execCommand(
        'insertHTML',
        false,
        `<p>${description.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
      );
    } catch (error) {
      console.error('[BPR-Helper] 生成描述失敗:', error);
      alert('生成描述失敗，請查看控制台日誌。');
    } finally {
      aiButton.disabled = false;
      aiButton.innerHTML = originalText; // 恢復原始的圖標和文字
    }
  };

  // 【修正點】找到 Save 按鈕，並在其父節點中進行插入
  const saveButton = toolbar.querySelector('[data-testid="comment-save-button"]');
  if (saveButton && saveButton.parentNode) {
    saveButton.parentNode.insertBefore(aiButton, saveButton);
    console.log('[BPR-Helper] AI 按鈕已成功注入。');
  } else {
    // 如果找不到 Save 按鈕，作為備用方案，將按鈕加到工具列的開頭
    toolbar.prepend(aiButton);
    console.warn('[BPR-Helper] 未找到 Save 按鈕，已將 AI 按鈕注入到工具列開頭。');
  }
}

/**
 * 主要的初始化與清理函數。
 * 根據當前是否在 PR 頁面來決定要做什麼。
 */
function initializeOrCleanup(): void {
  // 停止任何可能正在運行的舊監聽器
  stopDescriptionObserver();

  // 檢查目前是否在 PR 頁面
  if (prPageRegex.test(window.location.pathname)) {
    console.log('[BPR-Helper] Bitbucket PR 頁面已偵測。');
    const prInfo = getPrInfoFromUrl();
    if (prInfo) {
      console.log('[BPR-Helper] PR 資訊:', prInfo);
      injectCustomUI(prInfo);
      startDescriptionObserver(); // 在 PR 頁面，開始監聽編輯器
    } else {
      console.error('[BPR-Helper] 無法從 URL 中解析 PR 資訊。');
    }
  } else {
    console.log('[BPR-Helper] 目前不是 Bitbucket PR 頁面。');
  }
}

// ================================= UI INJECTION =================================
/**
 * 注入自訂 UI 到頁面上的函數。
 * @param {PrInfo} prInfo - 從 URL 解析出的 PR 資訊。
 */
function injectCustomUI(prInfo: PrInfo): void {
  console.log('[BPR-Helper] 執行 UI 注入邏輯。PR Info:', prInfo);
  // TODO: 實現實際的 UI 注入
  // 例如，可以找到頁面上的某個固定位置，並在那裡插入一個按鈕。
  const targetContainer = document.querySelector('.ak-editor-content-area');
  if (targetContainer && !document.getElementById('bpr-helper-button')) {
    const myButton = document.createElement('button');
    myButton.id = 'bpr-helper-button';
    myButton.textContent = 'PR Helper';
    myButton.style.marginLeft = '8px';
    myButton.onclick = () => alert(`Hello from PR #${prInfo.prId}`);
    targetContainer.appendChild(myButton);
  }
}

// ================================= SPA ROUTE CHANGE HANDLING =================================

/**
 * 處理 SPA 路由變化的中央函數。
 */
function handleRouteChange(): void {
  // 使用 setTimeout 確保在 DOM 更新後再執行我們的邏輯。
  // 在 SPA 中，URL 的改變和頁面內容的實際渲染可能存在微小延遲。
  setTimeout(initializeOrCleanup, 500);
}

// 攔截 history.pushState 來監聽 SPA 路由變化
const originalPushState = history.pushState;
history.pushState = function (...args) {
  originalPushState.apply(this, args);
  handleRouteChange();
};

// 攔截 history.replaceState (某些情況下也會用到)
const originalReplaceState = history.replaceState;
history.replaceState = function (...args) {
  originalReplaceState.apply(this, args);
  handleRouteChange();
};

// 監聽瀏覽器的前進/後退按鈕事件
window.addEventListener('popstate', handleRouteChange);

// ================================= INITIALIZATION =================================
console.log('[BPR-Helper] 內容腳本已載入。');

// 腳本初次載入時，立即執行一次檢查。
initializeOrCleanup();

// 匯出一個空物件以符合 TypeScript 的模組要求
export {};
