#!strict
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Root Commands (Monorepo)
- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both frontend and backend for production
- `npm run lint` - Run ESLint on the entire project
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run type-check` - TypeScript type checking across workspaces

### Backend Commands (`backend/`)
- `npm run dev` - Start backend with hot reload (nodemon + ts-node)
- `npm run build` - Compile TypeScript to JavaScript in `dist/`
- `npm run start` - Start production server from compiled code
- `npm run clean` - Remove `dist/` directory
- `npm test` - Run test suite (Jest + Supertest + MSW)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage reports

### Frontend Commands (`frontend/`)
- `npm run dev` - Build extension with watch mode for development
- `npm run build` - Build extension for production in `dist/`
- `npm run type-check` - TypeScript type checking only
- `npm run lint` - ESLint for frontend code
- `npm test` - Run test suite (Jest + Testing Library + Chrome extension mocks)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage reports

### Testing and Development Workflow
1. Start backend: `cd backend && npm run dev` (runs on http://localhost:3001)
2. Build frontend: `cd frontend && npm run build`
3. Load extension in Chrome: Go to chrome://extensions/, enable Developer mode, click "Load unpacked", select `frontend/dist/`
4. Test on Bitbucket PR page

## Architecture Overview

### Project Structure
- **Monorepo**: Frontend (browser extension) + Backend (Node.js API)
- **Frontend**: TypeScript Manifest v3 browser extension with content scripts, background service worker, popup UI, and options page
- **Backend**: Express.js server with TypeScript, LangChain.js for LLM integration, Bitbucket OAuth

### Key Architectural Patterns

#### Multi-LLM Provider System
- **Factory Pattern**: `ProviderFactory` creates LLM provider instances
- **Abstract Base**: `BaseLLMProvider` defines common interface
- **Supported Providers**: OpenAI, Anthropic, xAI, Ollama
- **Template Processing**: Placeholder system for `{DIFF_CONTENT}`, `{BRANCH_NAME}`, etc.

#### Browser Extension Architecture
- **Service Worker** (`background/background.ts`): OAuth handling, API communication
- **Content Script** (`content/content.ts`): Bitbucket page DOM injection and interaction
- **Popup UI** (`popup/popup.html` + `popup/popup.ts`): Main user interface for extension
- **Communication**: `chrome.runtime.sendMessage` between components
- **Storage**: `chrome.storage.local` for settings, templates, tokens

#### API Design
- **RESTful endpoints**: `/api/v1` (MVP), `/api/v2` (multi-LLM)
- **Type safety**: Shared types in `backend/src/types/api.ts`
- **OAuth 2.0**: Bitbucket authentication with token refresh

### Core Data Flows

#### Flow 1: Popup-Initiated Generation
1. User clicks extension icon, popup UI opens (`popup.ts`)
2. Popup checks authentication status via background service
3. User selects template, LLM provider, and model in popup
4. Popup validates user is on Bitbucket PR page
5. Background service handles OAuth authentication and API calls
6. Backend fetches PR data from Bitbucket API
7. LLM provider generates description using template
8. Popup displays generated description with action buttons
9. Content script injects result into Bitbucket editor when user clicks "Fill into Page"

#### Flow 2: Content Script Direct Integration
1. Content script detects Bitbucket PR page
2. Content script observes editor presence and injects AI button into Bitbucket editor
3. User clicks AI button in the editor
4. Backend fetches PR data from Bitbucket API
5. LLM provider generates description using template
6. Content script directly injects description into Bitbucket editor

### Critical Files and Locations

#### Backend Key Files
- `backend/src/index.ts` - Main Express server entry point
- `backend/src/services/providers/` - LLM provider implementations
- `backend/src/services/llm-provider.ts` - Provider factory and registry
- `backend/src/services/bitbucket.ts` - Bitbucket API integration
- `backend/src/types/api.ts` - Shared API type definitions

#### Frontend Key Files
- `frontend/src/manifest.json` - Extension manifest and permissions
- `frontend/src/background/background.ts` - Service worker main logic
- `frontend/src/content/content.ts` - Bitbucket page interaction
- `frontend/src/popup/popup.html` - Main extension popup UI
- `frontend/src/popup/popup.ts` - Popup controller and business logic
- `frontend/src/common/storage_schema.ts` - Extension storage data structures

### Webpack Configuration (Critical)
When adding new components to frontend:

1. **New TypeScript files**: Add entry points to `webpack.config.js`
   ```javascript
   entry: {
     'newfile': './src/path/newfile.ts'
   }
   ```

2. **New HTML/CSS files**: Add to `CopyWebpackPlugin` patterns
   ```javascript
   { from: 'src/newdir/', to: 'newdir/' }
   ```

3. **Always run** `npm run build` in `frontend/` after webpack changes

### Popup UI Component (Critical Feature)

The popup is the primary user interface for the extension, accessible via the extension icon in the browser toolbar.

#### Popup Architecture (`frontend/src/popup/`)
- **popup.html** - UI layout with template/provider selectors, authentication status, generate button, and results area
- **popup.ts** - `PopupController` class managing all popup logic and state
- **popup.css** - Styling for the popup interface

#### Key Popup Features
- **Authentication Management** - OAuth login/logout with Bitbucket, displays user status
- **Multi-LLM Provider Selection** - Dropdown for OpenAI, Anthropic, Ollama with model selection
- **Template Management** - Load and select from saved templates, auto-selection for UX
- **Real-time Validation** - Checks authentication, page URL, template, and LLM config before enabling generation
- **Results Handling** - Displays generated descriptions with copy-to-clipboard and fill-into-page actions
- **Storage Listeners** - Automatically updates UI when settings change in options page

#### Popup State Management
- Maintains authentication state and user info
- Syncs with Chrome storage for templates and LLM configurations
- Communicates with background service worker via `chrome.runtime.sendMessage`
- Sends fill commands to content script via `chrome.tabs.sendMessage`

#### Development Notes
- Always test popup UI after modifying `popup.html`, `popup.ts`, or webpack config
- Popup requires webpack entry point: `'popup': './src/popup/popup.ts'`
- Auto-selects first available template/provider for better user experience
- Implements comprehensive error handling with user-friendly messages

### Storage Management
- Use `saveToStorage()` function with quota checking enabled
- Call `updateTemplateUsageStats()` when templates are used
- Follow schema defined in `frontend/src/common/storage_schema.ts`

### LLM Provider Development
To add new LLM providers:
1. Extend `BaseLLMProvider` class
2. Implement required methods: `generateDescription()`, `processTemplate()`
3. Add to `ProviderFactory.createProvider()`
4. Update `ProviderType` enum in types

### Environment Setup
- Backend requires `.env` file with API keys and OAuth credentials
- Frontend requires no additional environment setup
- Use `backend/src/utils/env-validation.ts` for environment validation

## Development Guidelines

### Code Standards
- **TypeScript**: Strict typing, avoid `any`
- **Interfaces**: Prefix with `I` (e.g., `IStorageSchema`)
- **Error Handling**: Consistent error responses across API
- **Logging**: Use `backend/src/middleware/logging.ts`

### Browser Extension Specific
- Follow Manifest v3 principles (service workers, not background pages)
- Handle Chrome extension API errors gracefully
- Test extension loading after any manifest or webpack changes
- Use Range API for precise content insertion in Bitbucket

### Security Considerations
- Never store API keys in frontend extension storage
- Use OAuth 2.0 for Bitbucket authentication
- Validate all inputs and sanitize data before LLM processing
- HTTPS-only communication for all external APIs

## Testing Infrastructure

### Backend Testing Setup
The backend uses a comprehensive testing stack:

**Testing Framework:**
- **Jest** - Main testing framework with TypeScript support
- **Supertest** - HTTP endpoint testing for Express APIs
- **MSW** (Mock Service Worker) - External API mocking (OpenAI, Anthropic, Bitbucket, Ollama)
- **ts-jest** - TypeScript integration for Jest

**Test Structure:**
```
backend/src/test/
├── setup.ts              # Global test setup and MSW configuration
├── mocks/
│   ├── server.ts         # MSW server setup
│   └── handlers.ts       # API mock handlers for external services
├── unit/                 # Unit tests for individual components
│   ├── llm-provider.test.ts    # LLM provider factory tests
│   └── bitbucket.test.ts       # Bitbucket service tests
└── integration/          # API endpoint integration tests
    └── api.test.ts       # Express app integration tests
```

**Running Tests:**
- `npm test` - Run all tests
- `npm run test:watch` - Watch mode for development
- `npm run test:coverage` - Generate coverage reports
- Make commands: `make test`, `make test-unit`, `make test-integration`

**Test Configuration:**
- **Jest config**: `backend/jest.config.js` with TypeScript preset
- **Coverage**: HTML, LCOV, and JSON reports in `backend/coverage/`
- **Timeout**: 10 second default timeout for async operations
- **Mocking**: All external APIs are mocked to avoid real API calls during testing

**Key Testing Patterns:**
- **Unit Tests**: Test individual classes and functions in isolation
- **Integration Tests**: Test complete API endpoints with real Express app
- **API Mocking**: External services (OpenAI, Bitbucket) are mocked with MSW
- **Error Handling**: Test error scenarios and edge cases
- **TypeScript Safety**: Full type checking in tests

### Frontend Testing Setup
The frontend uses a comprehensive testing stack for Chrome extension components:

**Testing Framework:**
- **Jest** - Main testing framework with TypeScript support and jsdom environment
- **Testing Library** - DOM testing utilities for user interaction simulation
- **Chrome Extension Mocks** - Complete API mocking for storage, runtime, tabs, and action APIs

**Test Structure:**
```
frontend/src/test/
├── setup.ts              # Global test setup and Chrome API mocking
├── mocks/
│   └── chrome.ts         # Chrome extension API mocks and utilities
├── unit/                 # Unit tests for Chrome extension utilities
│   ├── storage.test.ts   # Chrome storage utilities tests
│   └── message.test.ts   # Chrome messaging system tests
└── integration/          # Integration tests for UI components
    └── popup.test.ts     # Popup UI and user workflow tests
```

**Running Tests:**
- `npm test` - Run all tests
- `npm run test:watch` - Watch mode for development
- `npm run test:coverage` - Generate coverage reports
- Make commands: `make test-frontend`, `make test-frontend-unit`, `make test-frontend-integration`, `make test-all`

**Test Configuration:**
- **Jest config**: `frontend/jest.config.js` with jsdom environment and TypeScript preset
- **Coverage**: HTML, LCOV, and JSON reports in `frontend/coverage/`
- **Chrome API Mocking**: Comprehensive mocks for storage, runtime, tabs, action APIs
- **DOM Testing**: Testing Library for UI component testing and user interaction simulation

**Key Testing Patterns:**
- **Unit Tests**: Test Chrome extension utilities (storage, messaging) in isolation
- **Integration Tests**: Test complete popup UI workflows and user interactions
- **Chrome API Mocking**: All Chrome extension APIs are mocked to avoid browser dependencies
- **Async Handling**: Proper Promise-based testing for Chrome API calls
- **DOM Testing**: jsdom environment with Testing Library utilities for UI testing