# Bitbucket PR Description Generator - Browser Extension

## 🌟 Project Overview

This project is a browser extension that integrates AI capabilities directly
into Bitbucket, automatically generating high-quality descriptions for Pull
Requests (PRs). When users browse Bitbucket PR pages, they can trigger this
functionality with one click. The extension analyzes the PR's code changes
(diff) and uses Large Language Models (LLMs) to generate structured description
text, ultimately filling it into the description box.

**Core Goal:** Eliminate context switching and repetitive work for developers
when writing PR descriptions, seamlessly integrating the entire process into
Bitbucket's native workflow to significantly improve development efficiency.

## 🚀 Tech Stack

This project adopts a modern JavaScript full-stack solution, ensuring
consistency and development efficiency between frontend and backend
technologies.

### **Frontend (Browser Extension - `frontend/`)**

- **Language:** TypeScript
- **Architecture:** Manifest v3 Browser Extension
- **Components:** Content Script, Popup UI, Background Script, Options Page

### **Backend (Backend Service - `backend/`)**

- **Framework:** Node.js + Express.js
  - _Reason: Mature, stable, and lightweight backend framework with a vast
    ecosystem, seamlessly integrating with frontend JavaScript tech stack._
- **Language:** TypeScript
  - _Reason: Maintains consistency with frontend, providing end-to-end type
    safety._
- **LLM Integration:** LangChain.js
  - _Reason: Standardizes interaction with multiple LLM providers (OpenAI,
    Anthropic, Ollama, etc.) and provides powerful toolchain (text splitting,
    prompt templates, chain calls) for handling complex AI tasks._
- **API Communication:** Axios
  - _Reason: Powerful and easy-to-use HTTP client for communicating with
    Bitbucket API and other external services._

## 🏛️ Project Architecture

This project adopts a typical **frontend-backend separation architecture**:

1. **Browser Extension (Frontend):**

   - **Responsibility:** Serves as the user interface layer, handling user
     interactions.
   - `Content Script`: Injected into Bitbucket pages, reads page information and
     embeds UI elements.
   - `Popup Script`: Extension popup window UI.
   - `Options Page`: Complete settings page for user authentication and
     configuration.
   - `Background Script`: Acts as the extension's brain, handling core logic and
     backend API requests.

2. **Backend Service (Backend):**
   - **Responsibility:** Serves as a secure business logic processing layer.
   - **API Proxy:** Proxies all requests to Bitbucket API and LLM APIs, hiding
     sensitive credentials (App Secret, LLM API Keys).
   - **Authentication Handling:** Handles Bitbucket OAuth 2.0 authentication
     flow.
   - **Core AI Logic:** Receives PR information from frontend, fetches diff,
     uses LangChain.js for chunking and summarization (Map-Reduce), and calls
     LLM to generate final descriptions.

### **Workflow Diagram**

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

## 🛠️ Getting Started

### Prerequisites

- Node.js v18+ recommended
- npm or yarn package manager
- Chrome browser for extension development

### Backend Setup

1. **Navigate to backend directory:** `cd backend`
2. **Install dependencies:** `npm install`
3. **Set up environment variables:** Copy `.env.example` to `.env` and fill in
   necessary API keys
4. **Start backend service:** `npm run dev`

### Frontend Setup

1. **Navigate to frontend directory:** `cd frontend`
2. **Install dependencies:** `npm install`
3. **Start development server:** `npm run dev`
4. **Load unpacked extension in browser:** Point to `frontend/dist` directory

### Development Workflow

1. Start the backend server on `http://localhost:3001`
2. Build the frontend extension
3. Load the unpacked extension in Chrome developer mode
4. Navigate to a Bitbucket PR page to test functionality

## 📁 Project Structure

```
blamewriter/
├── backend/                 # Backend Node.js service
│   ├── src/                # Source code
│   ├── package.json        # Backend dependencies
│   ├── tsconfig.json       # TypeScript configuration
│   └── .env.example        # Environment variables template
├── frontend/               # Browser extension
│   ├── src/                # Extension source code
│   ├── dist/               # Built extension (generated)
│   ├── manifest.json       # Extension manifest
│   └── package.json        # Frontend dependencies
├── docs/                   # Project documentation
│   ├── PRD.md             # Product Requirements Document
│   ├── technical_doc/      # Technical documentation
│   └── task/              # Task checklists
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## 🔧 Development Scripts

### Backend

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server

### Frontend

- `npm run dev` - Build extension in development mode with watch
- `npm run build` - Build extension for production
- `npm run package` - Package extension for distribution

## 🚀 Features

### Phase 1 MVP Features

- Manual Bitbucket token input
- Fixed OpenAI LLM integration
- Basic PR description generation
- Simple popup UI
- Core backend API functionality

### Future Phases

- OAuth 2.0 authentication
- Multiple LLM provider support
- Custom template management
- Advanced UI/UX improvements
- Team collaboration features

## 🔐 Security

- All sensitive credentials are handled by the backend service
- API keys are never stored in browser extension storage
- Secure OAuth 2.0 flow for Bitbucket authentication
- HTTPS-only communication for all external APIs

## 🧪 Testing

### Manual Testing

1. Load extension in Chrome developer mode
2. Navigate to a Bitbucket PR page
3. Click extension icon to open popup
4. Enter Bitbucket token and generate description
5. Verify generated content appears correctly

### API Testing

- Use curl or Postman to test backend endpoints
- Verify Bitbucket API integration with real PR URLs
- Test error handling scenarios

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for
details.

## 🤝 Support

For support, please open an issue in the GitHub repository or contact the
development team.

## 🗺️ Roadmap

- [x] Phase 1: MVP with manual token input
- [x] Phase 2: Multi-LLM provider support and template system *(In Progress)*
  - [x] Template Processing System with placeholder support
  - [x] OpenAI, Anthropic, Ollama, and xAI provider integration
  - [x] Unified provider architecture with consistent APIs
  - [ ] Large diff processing (Map-Reduce)
  - [ ] Enhanced Options Page UI
- [ ] Phase 3: Advanced UI/UX and team features  
- [ ] Phase 4: Multi-platform support (GitHub, GitLab)

## 📈 Recent Updates

**June 15, 2025** - Template Processing System Complete
- ✅ Implemented unified template processing across all LLM providers
- ✅ Added comprehensive template validation and placeholder support
- ✅ Fixed architectural inconsistencies in provider implementations
- ✅ All providers (OpenAI, Anthropic, Ollama, xAI) now use consistent API
- ✅ Zero TypeScript compilation errors, production-ready code

---

**Note:** This is currently in Phase 1 MVP development. The focus is on
establishing a working end-to-end workflow with manual Bitbucket token input to
demonstrate core concept feasibility.
