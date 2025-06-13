# Phase 1 MVP Task Checklist - Bitbucket PR Description Generator

## Overview

This checklist covers the implementation of Phase 1 MVP for the Bitbucket PR
Description Generator browser extension. The goal is to establish a working
end-to-end workflow with manual Bitbucket token input, demonstrating the core
concept feasibility.

**MVP Goal**: End-to-end workflow with manual Bitbucket token input, fixed LLM
(OpenAI), and fixed template for PR description generation.

---

## 1. Project Setup & Architecture Tasks

### 1.1 Repository Structure Setup

- [v] Create main project directory structure with [`frontend/`](frontend/) and
  [`backend/`](backend/) folders
- [v] Initialize Git repository with appropriate [`.gitignore`](.gitignore) for
  Node.js and browser extension files
- [v] Create [`README.md`](README.md) with project overview and setup
  instructions
- [v] Set up [`docs/`](docs/) directory structure for documentation

### 1.2 Development Environment Configuration

- [v] Set up Node.js development environment (v18+ recommended)
- [v] Configure TypeScript for both frontend and backend projects
- [v] Set up ESLint and Prettier for code formatting consistency
- [v] Create development scripts for both frontend and backend in
  [`package.json`](package.json)

### 1.3 Backend Project Initialization

- [v] Initialize Node.js project in [`backend/`](backend/) directory using
  `npm init`
- [v] Install core dependencies: [`express`](backend/package.json),
  [`axios`](backend/package.json), [`openai`](backend/package.json),
  [`dotenv`](backend/package.json)
- [v] Install development dependencies: [`typescript`](backend/package.json),
  [`@types/node`](backend/package.json),
  [`@types/express`](backend/package.json), [`nodemon`](backend/package.json),
  [`ts-node`](backend/package.json)
- [v] Create [`tsconfig.json`](backend/tsconfig.json) for TypeScript
  configuration
- [v] Set up [`backend/.env.example`](backend/.env.example) template file
- [v] Create [`backend/.env`](backend/.env) file for local development (add to
  .gitignore)

### 1.4 Frontend Extension Project Initialization

- [v] Initialize frontend project in [`frontend/`](frontend/) directory
- [v] Set up build system for browser extension (webpack or similar)
- [v] Create TypeScript configuration for extension development
- [v] Set up development and build scripts for extension packaging

---

## 2. Backend Development Tasks

### 2.1 Core Backend Structure

- [v] Create main application file
  [`backend/src/index.ts`](backend/src/index.ts)
- [v] Set up Express server with CORS configuration for extension communication
- [v] Implement environment variable loading using
  [`dotenv`](backend/src/index.ts)
- [v] Configure server to listen on port 3001 for development
- [v] Add basic error handling middleware

### 2.2 Environment Variables Management

- [v] Define [`BITBUCKET_APP_SECRET`](backend/.env.example) in environment
  template
- [v] Define [`OPENAI_API_KEY`](backend/.env.example) in environment template
- [v] Add [`PORT`](backend/.env.example) configuration variable
- [v] Implement environment validation to ensure required variables are present

### 2.3 API Endpoint Implementation

- [v] Create [`POST /api/v1/generate-mvp`](backend/src/routes/generate.ts)
  endpoint
- [v] Implement request body validation for
  [`prUrl`](backend/src/routes/generate.ts) and
  [`bitbucketToken`](backend/src/routes/generate.ts) fields
- [v] Add request/response logging for debugging
- [v] Implement proper HTTP status codes and error responses

### 2.4 Bitbucket API Integration

- [v] Create utility function to parse PR URL and extract
  [`workspace`](backend/src/utils/bitbucket.ts),
  [`repo`](backend/src/utils/bitbucket.ts), and
  [`prId`](backend/src/utils/bitbucket.ts)
- [v] Implement Bitbucket API client using
  [`axios`](backend/src/services/bitbucket.ts)
- [v] Create function to fetch PR diff using
  [`/2.0/repositories/{workspace}/{repo}/pullrequests/{prId}/diff`](backend/src/services/bitbucket.ts)
  endpoint
- [v] Add Bearer token authentication for Bitbucket API requests
- [v] Implement error handling for Bitbucket API failures (401, 404, rate
  limits)

### 2.5 OpenAI API Integration

- [v] Set up OpenAI client with API key from environment variables
- [v] Create function to generate PR description using
  [`openai`](backend/src/services/openai.ts) library
- [v] Implement hardcoded prompt template:
  "請根據以下 diff 為這個 PR 撰寫描述..."
- [v] Add diff content truncation (limit to 4000 characters) to prevent token
  limits
- [v] Configure OpenAI model parameters (model: gpt-3.5-turbo or gpt-4)
- [v] Implement error handling for OpenAI API failures

### 2.6 Core Business Logic

- [v] Create main handler function in
  [`/api/v1/generate-mvp`](backend/src/routes/generate.ts) endpoint
- [v] Implement workflow: Parse URL → Fetch diff → Generate description → Return
  response
- [v] Add comprehensive error handling and logging throughout the pipeline
- [v] Implement response formatting to match expected JSON structure
- [v] Add request timeout handling for external API calls

### 2.7 Development and Testing Setup

- [v] Create [`npm run dev`](backend/package.json) script using
  [`nodemon`](backend/package.json) for development
- [v] Create [`npm run build`](backend/package.json) script for TypeScript
  compilation
- [v] Set up basic health check endpoint [`GET /health`](backend/src/index.ts)
- [v] Test backend API using curl or Postman with sample data
- [v] Verify Bitbucket API integration with real PR URLs

---

## 3. Frontend Extension Tasks

### 3.1 Manifest v3 Configuration

- [v] Create [`frontend/manifest.json`](frontend/manifest.json) with
  manifest_version 3
- [v] Set extension name: "Bitbucket PR Helper (MVP)"
- [v] Set version: "0.1.0"
- [v] Configure permissions: [`"activeTab"`](frontend/manifest.json)
- [v] Add host_permissions:
  [`"http://localhost:3001/*"`](frontend/manifest.json) for development
- [v] Configure action with
  [`default_popup: "popup.html"`](frontend/manifest.json)
- [v] Set up service worker:
  [`"service_worker": "background.js"`](frontend/manifest.json)

### 3.2 Popup UI Development

- [v] Create [`frontend/popup.html`](frontend/popup.html) with basic structure
- [v] Add input field for Bitbucket token with placeholder text
- [v] Create "Generate Description" button with appropriate styling
- [v] Add textarea for displaying generated results
- [v] Include loading state indicator for API requests
- [v] Add basic CSS styling for professional appearance
- [v] Ensure responsive design for popup window constraints

### 3.3 Popup Script Implementation

- [v] Create [`frontend/popup.js`](frontend/popup.js) (or TypeScript equivalent)
- [v] Implement button click event handler
- [v] Add function to get current tab URL using
  [`chrome.tabs.query`](frontend/popup.js)
- [v] Validate that current page is a Bitbucket PR page
- [v] Read token value from input field with validation
- [v] Send message to background script using
  [`chrome.runtime.sendMessage`](frontend/popup.js)
- [v] Handle response from background script and display results
- [v] Implement error handling and user feedback

### 3.4 Background Script Development

- [v] Create [`frontend/background.js`](frontend/background.js) service worker
- [v] Implement [`chrome.runtime.onMessage.addListener`](frontend/background.js)
  for popup communication
- [v] Create function to make HTTP request to backend API endpoint
- [v] Use [`fetch`](frontend/background.js) API to call
  [`http://localhost:3001/api/v1/generate-mvp`](frontend/background.js)
- [v] Implement proper request headers:
  [`Content-Type: application/json`](frontend/background.js)
- [v] Handle API response and error cases
- [v] Send response back to popup using [`sendResponse`](frontend/background.js)
- [v] Add logging for debugging purposes

### 3.5 Extension Build and Packaging

- [v] Set up build process to compile TypeScript to JavaScript
- [v] Create [`frontend/dist/`](frontend/dist/) directory for built extension
- [v] Configure build to copy [`manifest.json`](frontend/dist/manifest.json),
  [`popup.html`](frontend/dist/popup.html), and assets
- [v] Create [`npm run build`](frontend/package.json) script for production
  build
- [v] Create [`npm run dev`](frontend/package.json) script for development with
  watch mode
- [v] Test extension loading in Chrome developer mode

### 3.6 Content Script Preparation (Basic)

- [ ] Create placeholder [`frontend/content.js`](frontend/content.js) for future
      page integration
- [ ] Add basic page detection to verify we're on a Bitbucket PR page
- [ ] Implement URL parsing to extract PR information
- [ ] Add console logging for debugging page context
- [ ] Prepare foundation for future in-page UI injection

---

## 4. Integration & Testing Tasks

### 4.1 Local Development Setup

- [ ] Start backend server on [`http://localhost:3001`](http://localhost:3001)
- [ ] Load unpacked extension in Chrome from [`frontend/dist/`](frontend/dist/)
      directory
- [ ] Verify extension appears in browser toolbar
- [ ] Test popup opens correctly when clicking extension icon
- [ ] Confirm backend health endpoint is accessible

### 4.2 End-to-End Workflow Testing

- [ ] Navigate to a real Bitbucket PR page
- [ ] Open extension popup and verify UI elements are present
- [ ] Obtain valid Bitbucket OAuth token for testing
- [ ] Input token into extension popup
- [ ] Click "Generate Description" button and verify loading state
- [ ] Confirm API request reaches backend with correct data
- [ ] Verify backend successfully fetches PR diff from Bitbucket API
- [ ] Confirm OpenAI API generates description successfully
- [ ] Check that generated description appears in popup textarea

### 4.3 Error Handling Testing

- [ ] Test with invalid Bitbucket token (should show appropriate error)
- [ ] Test with non-existent PR URL (should handle 404 gracefully)
- [ ] Test with malformed PR URL (should validate and reject)
- [ ] Test backend offline scenario (should show connection error)
- [ ] Test OpenAI API failure (should handle and display error)
- [ ] Verify all error messages are user-friendly

### 4.4 Cross-Browser Compatibility

- [ ] Test extension in Chrome (primary target)
- [ ] Verify manifest v3 compatibility
- [ ] Test popup functionality across different screen sizes
- [ ] Ensure API calls work correctly in extension context
- [ ] Validate service worker functionality

### 4.5 Performance and Reliability Testing

- [ ] Test with large PR diffs (verify 4000 character truncation)
- [ ] Measure API response times for typical requests
- [ ] Test concurrent requests handling
- [ ] Verify memory usage is reasonable
- [ ] Test extension behavior after browser restart

### 4.6 Security Validation

- [ ] Verify tokens are not logged or stored permanently
- [ ] Confirm HTTPS is used for all external API calls
- [ ] Validate input sanitization for PR URLs and tokens
- [ ] Check that sensitive data is not exposed in error messages
- [ ] Ensure backend environment variables are properly secured

### 4.7 Documentation and Deployment Preparation

- [ ] Document API endpoint specifications
- [ ] Create setup instructions for local development
- [ ] Document testing procedures and test cases
- [ ] Prepare deployment configuration for backend service
- [ ] Create user guide for MVP functionality
- [ ] Document known limitations and future improvements

---

## Acceptance Criteria

**Primary Success Criteria:**

- [ ] Developer can navigate to any Bitbucket PR page
- [ ] Extension popup opens and displays clean, functional UI
- [ ] Manual token input works correctly with validation
- [ ] "Generate Description" button triggers complete workflow
- [ ] Backend successfully fetches PR diff from Bitbucket API
- [ ] OpenAI generates relevant PR description based on diff
- [ ] Generated description appears in popup result area
- [ ] Error cases are handled gracefully with user feedback

**Technical Requirements:**

- [ ] All TypeScript code compiles without errors
- [ ] Extension loads successfully in Chrome developer mode
- [ ] Backend API responds correctly to all test scenarios
- [ ] No console errors in browser or server logs during normal operation
- [ ] Code follows established formatting and linting rules

**Quality Standards:**

- [ ] Code is well-documented with clear comments
- [ ] Error messages are informative and user-friendly
- [ ] UI is responsive and professional-looking
- [ ] API responses are properly structured and validated
- [ ] Security best practices are followed throughout

---

## Notes

- This Phase 1 MVP focuses on proving the core technical concept
- Manual token input is acceptable for this phase (OAuth will be added in
  Phase 2)
- Fixed OpenAI integration is sufficient (multi-LLM support comes in Phase 2)
- Basic UI is acceptable (advanced UX improvements planned for Phase 3)
- Local development setup is prioritized over production deployment
- Comprehensive error handling is essential for debugging and user experience
