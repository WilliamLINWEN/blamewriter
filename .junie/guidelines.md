# Blamewriter Development Guidelines

This document provides essential information for developers working on the Blamewriter project, a browser extension that generates PR descriptions for Bitbucket using AI.

## Build and Configuration Instructions

### Prerequisites

- Node.js v18+ recommended
- npm or yarn package manager
- Chrome browser for extension development

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file to include necessary API keys and configuration values.

4. Development server:
   ```bash
   npm run dev
   ```
   
   This starts the backend service on `http://localhost:3001` with hot reloading.

5. Production build:
   ```bash
   npm run build
   npm run start
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Development build with watch mode:
   ```bash
   npm run dev
   ```
   
   This builds the extension in development mode and watches for changes.

4. Production build:
   ```bash
   npm run build
   ```
   
   This builds the extension for production in the `dist` directory.

5. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `frontend/dist` directory

## Testing Information

### Backend Testing

The backend uses Jest for testing. Tests are located in `__tests__` directories or named with `.test.ts` or `.spec.ts` extensions.

1. Install testing dependencies (if not already installed):
   ```bash
   cd backend
   npm install --save-dev jest @types/jest ts-jest
   ```

2. Configure Jest:
   Create a `jest.config.js` file in the backend directory:
   ```javascript
   module.exports = {
     preset: 'ts-jest',
     testEnvironment: 'node',
     roots: ['<rootDir>/src'],
     testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
     transform: {
       '^.+\\.ts$': 'ts-jest',
     },
     moduleFileExtensions: ['ts', 'js', 'json', 'node'],
     collectCoverage: true,
     coverageDirectory: 'coverage',
     collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
   };
   ```

3. Add test scripts to `package.json`:
   ```json
   "scripts": {
     "test": "jest",
     "test:watch": "jest --watch",
     "test:coverage": "jest --coverage"
   }
   ```

4. Running tests:
   ```bash
   npm test           # Run all tests
   npm run test:watch # Run tests in watch mode
   npm run test:coverage # Run tests with coverage report
   ```

### Example Test

Here's an example of a utility function and its test:

**src/utils/string-utils.ts**:
```typescript
/**
 * Truncates a string to a specified length and adds an ellipsis if truncated
 * @param str - The string to truncate
 * @param maxLength - The maximum length of the string
 * @returns The truncated string with an ellipsis if truncated
 */
export function truncateString(str: string, maxLength: number): string {
  if (!str) {
    return '';
  }
  
  if (str.length <= maxLength) {
    return str;
  }
  
  return str.slice(0, maxLength) + '...';
}
```

**src/utils/__tests__/string-utils.test.ts**:
```typescript
import { truncateString } from '../string-utils';

describe('String Utilities', () => {
  describe('truncateString', () => {
    it('should return an empty string when input is empty', () => {
      expect(truncateString('', 10)).toBe('');
      expect(truncateString(null as any, 10)).toBe('');
      expect(truncateString(undefined as any, 10)).toBe('');
    });

    it('should return the original string when length is less than maxLength', () => {
      const input = 'Hello, world!';
      expect(truncateString(input, 20)).toBe(input);
    });

    it('should truncate the string and add ellipsis when length exceeds maxLength', () => {
      const input = 'This is a long string that needs to be truncated';
      const maxLength = 20;
      const expected = 'This is a long strin...';
      expect(truncateString(input, maxLength)).toBe(expected);
    });
  });
});
```

### Frontend Testing

Currently, the frontend doesn't have automated tests set up. Manual testing can be performed by:

1. Building the extension: `npm run build`
2. Loading it in Chrome developer mode
3. Testing functionality on Bitbucket PR pages

## Code Style and Development Practices

### Code Formatting

The project uses ESLint and Prettier for code formatting and linting:

- **ESLint**: Enforces code quality rules
- **Prettier**: Ensures consistent code formatting

Key formatting rules:
- Use single quotes for strings
- Use semicolons at the end of statements
- 2 spaces for indentation
- 100 character line length (80 for JSON and Markdown files)
- Use curly braces for all control statements
- Use const for variables that aren't reassigned
- No var declarations

### Running Linting

```bash
# Frontend
cd frontend
npm run lint
npm run lint:fix  # Fix linting issues automatically

# Backend (if configured)
cd backend
npm run lint
npm run lint:fix  # Fix linting issues automatically
```

### TypeScript Configuration

The project uses TypeScript for both frontend and backend. The `tsconfig.json` files in each directory configure the TypeScript compiler options.

Key TypeScript features used:
- Strict type checking
- ES2020 target
- Module resolution via Node.js

### Project Structure

```
blamewriter/
├── backend/                 # Backend Node.js service
│   ├── src/                # Source code
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic services
│   │   └── utils/          # Utility functions
│   ├── package.json        # Backend dependencies
│   └── tsconfig.json       # TypeScript configuration
├── frontend/               # Browser extension
│   ├── src/                # Extension source code
│   │   ├── background/     # Background scripts
│   │   ├── content/        # Content scripts
│   │   ├── popup/          # Popup UI
│   │   └── options/        # Options page
│   ├── dist/               # Built extension (generated)
│   ├── manifest.json       # Extension manifest
│   └── package.json        # Frontend dependencies
└── docs/                   # Project documentation
```

### Development Workflow

1. Start the backend server: `cd backend && npm run dev`
2. Build the frontend extension: `cd frontend && npm run dev`
3. Load the extension in Chrome developer mode
4. Make changes to the code
5. Test changes on Bitbucket PR pages
6. Run linting before committing: `npm run lint`

## Additional Development Information

### Environment Variables

The backend uses environment variables for configuration. Copy `.env.example` to `.env` and fill in the required values:

- `PORT`: The port for the backend server (default: 3001)
- `NODE_ENV`: The environment (development, production, test)
- `OPENAI_API_KEY`: API key for OpenAI (if using OpenAI)
- `ANTHROPIC_API_KEY`: API key for Anthropic (if using Claude)
- `OLLAMA_BASE_URL`: Base URL for Ollama (if using Ollama)

### Multi-LLM Provider Support

The backend supports multiple LLM providers through a provider factory pattern. Providers include:
- OpenAI
- Anthropic (Claude)
- Ollama
- xAI

Each provider implements a common interface defined in `src/services/llm-provider.ts`.

### API Endpoints

The backend exposes several API endpoints:
- `/api/health`: Health check endpoint
- `/api/generate`: Generate PR descriptions
- `/api/auth`: Authentication endpoints for Bitbucket

### Browser Extension

The frontend is a Manifest v3 browser extension with:
- Content scripts that inject UI into Bitbucket pages
- Popup UI for quick actions
- Options page for configuration
- Background script for handling API requests

### Documentation

Additional documentation can be found in the `docs/` directory, including:
- API specifications
- Development setup
- User guides
- Multi-LLM provider guide