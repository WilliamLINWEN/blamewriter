# Development Guidelines

## 1. Project Overview

- **Purpose:** Browser extension for AI-powered Bitbucket PR description generation.
- **Technology Stack:**
    - Frontend: TypeScript, Manifest v3 Browser Extension
    - Backend: Node.js, Express.js, TypeScript, LangChain.js, Axios
- **Core Functionality:** Analyze PR diffs, generate structured descriptions using LLMs, and populate the Bitbucket PR description field.

## 2. Project Architecture

- **`frontend/`**: Browser extension code.
    - `src/manifest.json`: Extension manifest. **CRITICAL: Update for new permissions or components.**
    - `src/background/background.ts`: Background script for event handling and core logic.
    - `src/content/content.ts`: Content script for interacting with Bitbucket pages.
    - `src/popup/`: Popup UI (HTML, CSS, TypeScript).
    - `src/options/`: Options page (HTML, CSS, TypeScript).
    - `src/common/`: Shared utilities (storage, OAuth).
    - `webpack.config.js`: Webpack configuration. **CRITICAL: Refer to "Webpack Configuration Reminders" below.**
- **`backend/`**: Backend service code.
    - `src/index.ts`: Main application entry point.
    - `src/routes/`: API route definitions.
    - `src/services/`: Business logic (Bitbucket API interaction, LLM provider integration).
    - `src/middleware/`: Express middleware (logging, auth).
    - `src/types/`: TypeScript type definitions for API.
    - `src/utils/`: Utility functions.
- **`docs/`**: Project documentation.
    - `API_SPECIFICATIONS.md`: Details on backend API.
    - `DEVELOPMENT_SETUP.md`: Instructions for setting up the development environment.
- **`shrimp_data/`**: Data used by the Shrimp tool (ignore for general development).

## 3. Code Standards

- **Language:** TypeScript for both frontend and backend.
- **Formatting:** Adhere to Prettier and ESLint configurations (if present, otherwise maintain consistent style).
- **Naming Conventions:**
    - Use PascalCase for classes, interfaces, and type aliases (e.g., `MyClass`, `IUserOptions`).
    - Use camelCase for functions, methods, and variables (e.g., `getUserData`, `isLoading`).
    - Prefix interfaces with `I` (e.g., `IStorageSchema`).
- **Comments:**
    - Use JSDoc-style comments for functions, methods, and complex logic.
    - Explain *why* code is written, not *what* it does, if the what is obvious.
- **Type Safety:**
    - Leverage TypeScript's static typing. Avoid `any` where possible.
    - Define clear interfaces for all data structures, especially for API communication and browser storage. Refer to `frontend/src/common/storage_schema.ts` and `backend/src/types/api.ts`.

## 4. Functionality Implementation Standards

### Frontend (`frontend/`)

- **Manifest v3:** Adhere to Manifest v3 principles.
    - Service workers (`background.ts`) replace persistent background pages.
    - Use `chrome.storage.local` or `chrome.storage.sync` for extension storage.
- **Communication:**
    - Use `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage` for communication between components (popup, content, background).
    - Define clear message interfaces.
- **UI Components (Popup, Options):**
    - Keep UI logic separate from business logic.
    - Use plain TypeScript, HTML, and CSS. No complex UI frameworks unless explicitly added.
- **Content Scripts (`content/content.ts`):**
    - Inject scripts carefully to avoid conflicts with Bitbucket's page scripts.
    - Use for DOM manipulation and interaction with the Bitbucket PR page.
- **Storage (`frontend/src/common/storage_utils.ts`):**
    - **MUST** use `saveToStorage()` for saving data.
    - **MUST** enable quota checking by default with `saveToStorage()`.
    - **MUST** call `updateTemplateUsageStats()` when PR templates are used.
    - Refer to `frontend/src/common/storage_schema.ts` for data structures.

### Backend (`backend/`)

- **Framework:** Node.js + Express.js.
- **API Design:**
    - Follow RESTful principles for API endpoints.
    - Define request and response types in `backend/src/types/api.ts`.
    - Version APIs if breaking changes are introduced (e.g., `/api/v1/generate`, `/api/v2/generate`).
- **LLM Integration (`backend/src/services/llm-provider.ts`, `backend/src/services/providers/`):**
    - Use LangChain.js for interacting with LLMs.
    - Abstract LLM provider specifics within provider classes (e.g., `OpenAIProvider`).
    - Use `ProviderFactory` to instantiate providers.
- **Bitbucket API Interaction (`backend/src/services/bitbucket.ts`):**
    - Use Axios for HTTP requests.
    - Handle API errors gracefully.
    - Store sensitive credentials securely (e.g., environment variables, not in code).
- **Error Handling:**
    - Implement robust error handling in API routes and services.
    - Return appropriate HTTP status codes and error messages.
    - Log errors using the provided logging middleware (`backend/src/middleware/logging.ts`).

## 5. Webpack Configuration Reminders (`frontend/webpack.config.js`)

**🚨 CRITICAL: Always check and update `frontend/webpack.config.js` when adding new components.**

- **Adding New TypeScript Entry Points (e.g., new pages, workers):**
    - Add to `entry`: `'path/filename': './src/path/filename.ts'`
    - Example: `'settings/settings': './src/settings/settings.ts'`
- **Adding New HTML Pages:**
    - Add to `CopyWebpackPlugin` patterns.
    - Example: `{ from: 'src/newpage/newpage.html', to: 'newpage.html' }`
    - Ensure HTML references compiled `.js` files (e.g., `settings.js`), not `.ts`.
- **Adding New CSS Files (standalone, not imported by TS):**
    - Add to `CopyWebpackPlugin` patterns.
    - Example: `{ from: 'src/newpage/newpage.css', to: 'newpage.css' }`
- **Adding New Static Asset Directories (images, icons):**
    - Add directory copy pattern.
    - Example: `{ from: 'src/assets/', to: 'assets/' }`
- **Current Entry Points (DO NOT REMOVE unless intentionally refactoring):**
    - `popup`: `./src/popup/popup.ts`
    - `background`: `./src/background/background.ts`
    - `content`: `./src/content/content.ts`
    - `options/options`: `./src/options/options.ts`
- **Current Copy Patterns (Review before adding new ones):**
    - `src/manifest.json` → `dist/manifest.json`
    - `src/popup/popup.html` → `dist/popup.html`
    - `src/popup/popup.css` → `dist/popup.css`
    - `src/icons/` → `dist/icons/`
    - `src/options/` (excluding `.ts`) → `dist/options/`
- **Avoid:**
    - Missing entry points for new `.ts` files needing compilation.
    - Missing copy patterns for static files.
    - Copying `.ts` files that are also entry points (Webpack handles compilation).
    - Incorrect paths in HTML file references.
- **Build Process:**
    - **ALWAYS** run `npm run build` in the `frontend/` directory after Webpack config changes.
    - **ALWAYS** test the extension in Chrome by loading the `frontend/dist/` directory.

## 6. Workflow Standards

1.  **Frontend Development:**
    *   Modify files in `frontend/src/`.
    *   Run `npm run build` in `frontend/` to compile and copy assets to `frontend/dist/`.
    *   Load/reload the extension in Chrome from `frontend/dist/`.
2.  **Backend Development:**
    *   Modify files in `backend/src/`.
    *   Run `npm run dev` or `npm start` in `backend/` to start the server.
    *   Test API endpoints using a tool like Postman or curl.
3.  **Full Stack Feature Development:**
    *   Define API contracts in `backend/src/types/api.ts` first.
    *   Implement backend logic and API endpoints.
    -   Implement frontend components to consume backend APIs.
    *   Ensure consistent error handling and data validation across both frontend and backend.

## 7. Key File Interaction Standards

- **Modifying `frontend/src/common/storage_schema.ts`:**
    - If adding new storage items or changing existing ones, ensure all usages in `frontend/src/background/background.ts`, `frontend/src/popup/popup.ts`, `frontend/src/options/options.ts`, and `frontend/src/content/content.ts` are updated.
    - Consider data migration if schema changes are not backward compatible.
- **Modifying `backend/src/types/api.ts`:**
    - If API request/response structures change, update:
        - Backend route handlers in `backend/src/routes/`.
        - Backend service logic in `backend/src/services/`.
        - Frontend API calling code (typically in `frontend/src/background/background.ts` or service modules if created).
- **Modifying `frontend/src/manifest.json`:**
    - If adding new permissions (e.g., for new APIs), ensure they are justified and minimal.
    - If adding new content scripts, background scripts, or action pages, ensure corresponding files and Webpack entries are created.
- **Modifying `frontend/webpack.config.js`:**
    - **MUST** follow guidelines in "Webpack Configuration Reminders".
    - Incorrect changes can break the build or lead to a non-functional extension.

## 8. AI Decision-making Standards

- **When asked to add a new frontend page (e.g., "settings page"):**
    1.  Create a new directory under `frontend/src/` (e.g., `frontend/src/settings/`).
    2.  Create `settings.html`, `settings.css`, and `settings.ts` in this directory.
    3.  Update `frontend/webpack.config.js`:
        *   Add a new entry point for `settings.ts`.
        *   Add a new `CopyWebpackPlugin` pattern to copy the `settings/` directory (excluding `.ts`).
    4.  Update `frontend/src/manifest.json` if the page needs to be accessible (e.g., via options_page, action popup, or new browser action).
    5.  Ensure any JavaScript in `settings.html` references the compiled `settings.js`.
- **When asked to add a new API endpoint in the backend:**
    1.  Define request/response types in `backend/src/types/api.ts`.
    2.  Create a new route handler file in `backend/src/routes/` (e.g., `new_feature.ts`).
    3.  Implement the service logic in `backend/src/services/`.
    4.  Register the new route in `backend/src/index.ts` or the main router file.
- **When modifying shared code (`frontend/src/common/` or `backend/src/utils/`):**
    - Carefully assess the impact on all dependent modules.
    - Prioritize backward compatibility or provide clear migration paths.
- **If unsure about project-specific implementation details:**
    - First, search within the existing codebase for similar patterns or utilities.
    - Second, consult relevant files in `docs/`.
    - **DO NOT** invent new patterns or add new libraries without strong justification and checking for existing solutions.

## 9. Prohibited Actions

- **DO NOT** modify files outside the `frontend/` or `backend/` directories unless explicitly instructed for root configuration files like `package.json` or `tsconfig.json` at the project root.
- **DO NOT** introduce new major dependencies (e.g., UI frameworks, state management libraries) without prior approval or explicit instruction.
- **DO NOT** store sensitive information (API keys, secrets) directly in the codebase. Use environment variables for the backend and secure storage mechanisms for the frontend if absolutely necessary (though generally avoid storing secrets on the frontend).
- **DO NOT** write code that directly conflicts with Manifest v3 restrictions.
- **DO NOT** forget to run `npm run build` in `frontend/` after any changes to `frontend/src/` or `frontend/webpack.config.js` and test the extension.
- **DO NOT** assume general web development practices always apply directly to browser extension development; consider extension-specific constraints (permissions, execution contexts, security).
- **DO NOT** add general development knowledge or explain project functionality in this `shrimp-rules.md` file. This file is for project-specific operational rules for AI.
