# Local Development Setup Guide

## Prerequisites

Before setting up the project locally, ensure you have the following installed:

- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher (comes with Node.js)
- **Chrome Browser** (for extension testing)
- **Git** (for version control)

## Quick Start

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd blamewriter
   ```

2. **Install root dependencies**:
   ```bash
   npm install
   ```

3. **Set up backend**:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env file with your API keys (see Backend Setup section)
   npm run dev
   ```

4. **Set up frontend** (in a new terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Load extension in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `frontend/dist` directory

## Detailed Setup Instructions

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   ```bash
   # Copy the example environment file
   cp .env.example .env
   ```

4. **Configure environment variables** in `.env`:
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key_here
   
   # CORS Configuration (for development)
   CORS_ORIGIN=chrome-extension://*
   ```

5. **Start the development server**:
   ```bash
   # Development mode with hot reload
   npm run dev
   
   # Or build and start production mode
   npm run build
   npm start
   ```

6. **Verify backend is running**:
   - Open browser and visit `http://localhost:3001/api/health`
   - You should see a JSON response with status "healthy"

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the extension**:
   ```bash
   # Development build with watch mode
   npm run dev
   
   # Or one-time production build
   npm run build
   ```

4. **Load extension in Chrome**:
   - Open Chrome browser
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" toggle (top right corner)
   - Click "Load unpacked" button
   - Navigate to and select the `frontend/dist` directory
   - The extension should now appear in your extensions list

### Extension Testing

1. **Test extension loading**:
   - Look for the extension icon in Chrome's toolbar
   - Click the icon to open the popup interface

2. **Test on Bitbucket**:
   - Navigate to any Bitbucket Pull Request page
   - The extension should detect the PR and enable functionality
   - You should see the "✨ AI Generate Description" button (if implemented)

## Development Workflow

### Daily Development

1. **Start backend server**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Start frontend build watcher** (in another terminal):
   ```bash
   cd frontend
   npm run dev
   ```

3. **Make changes and test**:
   - Backend changes will auto-reload with nodemon
   - Frontend changes require manual extension reload in Chrome
   - Go to `chrome://extensions/` and click the reload icon for your extension

### Code Linting and Type Checking

**Frontend**:
```bash
cd frontend
npm run type-check  # TypeScript type checking
npm run lint        # ESLint checking
npm run lint:fix    # Auto-fix ESLint issues
```

**Backend**:
```bash
cd backend
npm run build       # TypeScript compilation check
```

## API Keys and Configuration

### Required API Keys

1. **OpenAI API Key**:
   - Sign up at [OpenAI Platform](https://platform.openai.com/)
   - Generate API key from your dashboard
   - Add to `backend/.env` as `OPENAI_API_KEY`

2. **Bitbucket Access Token** (for testing):
   - Go to Bitbucket Settings > Personal access tokens
   - Create token with repository read permissions
   - Use this token when testing the extension

### Environment Variables

**Backend `.env` file**:
```env
# Required
PORT=3001
NODE_ENV=development
OPENAI_API_KEY=your_openai_api_key

# Optional
LOG_LEVEL=debug
CORS_ORIGIN=chrome-extension://*

# Future LLM providers (optional)
ANTHROPIC_API_KEY=your_anthropic_key
XAI_API_KEY=your_xai_key
```

## Troubleshooting

### Common Issues

1. **Backend server won't start**:
   ```bash
   # Check if port 3001 is in use
   lsof -i :3001
   
   # Kill process if needed
   kill -9 <PID>
   ```

2. **Extension not loading**:
   - Check that `frontend/dist` directory exists
   - Run `npm run build` in frontend directory
   - Check Chrome Developer Tools console for errors

3. **Extension not working on Bitbucket**:
   - Check that extension has permission to access Bitbucket
   - Open Chrome DevTools on the Bitbucket page
   - Check Console tab for JavaScript errors

4. **API requests failing**:
   - Verify backend is running on `http://localhost:3001`
   - Check backend logs for errors
   - Verify CORS settings in backend

### Debugging

**Backend debugging**:
```bash
# Start with debug logging
DEBUG=* npm run dev

# Or check logs
tail -f logs/app.log
```

**Frontend debugging**:
- Open Chrome DevTools on any page
- Go to Extensions tab (if available) or Console
- Check for error messages
- Use `chrome://extensions/` to check extension errors

**Extension debugging**:
- Right-click extension icon → "Inspect popup"
- Go to Bitbucket page → F12 → Console tab
- Check for content script errors

## Testing

### Manual Testing Checklist

1. **Backend API**:
   ```bash
   # Test health endpoint
   curl http://localhost:3001/api/health
   
   # Test generate endpoint (replace with real values)
   curl -X POST http://localhost:3001/api/generate \
     -H "Content-Type: application/json" \
     -d '{"prUrl":"https://bitbucket.org/workspace/repo/pull-requests/1","token":"your-token","llmProvider":"openai","model":"gpt-4"}'
   ```

2. **Extension functionality**:
   - Load extension in Chrome
   - Navigate to Bitbucket PR page
   - Click extension icon
   - Test PR description generation

### Automated Testing

Currently, automated tests are limited. Future implementations will include:
- Unit tests for backend services
- Integration tests for API endpoints
- End-to-end tests for extension functionality

## Available Scripts

### Backend Scripts
```bash
npm run dev        # Start development server with hot reload
npm run build      # Build TypeScript to JavaScript
npm run start      # Start production server
npm run clean      # Clean build artifacts
npm run test       # Run tests (placeholder)
```

### Frontend Scripts
```bash
npm run dev        # Build in development mode with watch
npm run build      # Build for production
npm run build:dev  # Build for development (one-time)
npm run clean      # Clean build artifacts
npm run type-check # TypeScript type checking
npm run lint       # Run ESLint
npm run lint:fix   # Fix ESLint issues
npm run test:load  # Show extension loading instructions
```

### Root Scripts
```bash
npm run dev        # Start both backend and frontend in development mode
npm run build      # Build both backend and frontend
npm run clean      # Clean all build artifacts
```

## Next Steps

After setting up the development environment:

1. **Familiarize with codebase**:
   - Read `docs/PRD.md` for product requirements
   - Review `docs/technical_doc/` for technical details
   - Check `docs/task/phase1_checklist.md` for current progress

2. **Start developing**:
   - Pick tasks from the phase 1 checklist
   - Make changes and test locally
   - Submit pull requests for review

3. **Join development**:
   - Follow contributing guidelines in `README.md`
   - Use feature branches for new development
   - Write tests for new functionality

## Support

If you encounter issues during setup:
1. Check this guide's troubleshooting section
2. Review error logs in terminal/console
3. Open an issue in the project repository
4. Contact the development team

---

*Last updated: June 13, 2025*
