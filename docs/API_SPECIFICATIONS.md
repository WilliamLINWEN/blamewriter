# API Endpoint Specifications

## Overview

This document describes the API endpoints for the Bitbucket PR Description Generator backend service. The backend service provides RESTful APIs to support the browser extension functionality.

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: TBD (will be updated during deployment)

## API Endpoints

### 1. Generate PR Description

Generate a PR description based on the provided PR details.

**Endpoint**: `POST /api/generate`

**Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "prUrl": "string",
  "token": "string",
  "llmProvider": "openai" | "anthropic" | "xai" | "ollama",
  "model": "string",
  "template": "string (optional)",
  "fileIgnorePatterns": ["string"] (optional)
}
```

**Request Parameters**:
- `prUrl` (required): Full URL of the Bitbucket PR (e.g., `https://bitbucket.org/workspace/repo/pull-requests/123`)
- `token` (required): Bitbucket access token for API authentication
- `llmProvider` (required): LLM provider to use for generation
- `model` (required): Specific model name (e.g., "gpt-4", "claude-3-opus")
- `template` (optional): Custom template for PR description generation
- `fileIgnorePatterns` (optional): Array of file patterns to ignore during diff analysis

**Response Format**:

*Success Response (200):*
```json
{
  "success": true,
  "data": {
    "description": "Generated PR description text",
    "metadata": {
      "prId": "123",
      "workspace": "workspace-name",
      "repository": "repo-name",
      "title": "Original PR title",
      "filesAnalyzed": 15,
      "linesChanged": 245,
      "llmProvider": "openai",
      "model": "gpt-4",
      "generatedAt": "2025-06-13T10:30:00Z"
    }
  }
}
```

*Error Response (400/401/500):*
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details (optional)"
  }
}
```

**Error Codes**:
- `INVALID_PR_URL`: Invalid or malformed PR URL
- `INVALID_TOKEN`: Invalid or expired Bitbucket token
- `PR_NOT_FOUND`: PR not found or access denied
- `LLM_ERROR`: Error from LLM provider
- `RATE_LIMIT_EXCEEDED`: API rate limit exceeded
- `INTERNAL_ERROR`: Internal server error

### 2. Health Check

Check the health status of the backend service.

**Endpoint**: `GET /api/health`

**Response Format**:
```json
{
  "status": "healthy",
  "timestamp": "2025-06-13T10:30:00Z",
  "version": "1.0.0",
  "uptime": 3600
}
```

### 3. Validate Token

Validate a Bitbucket access token.

**Endpoint**: `POST /api/validate-token`

**Request Body**:
```json
{
  "token": "string"
}
```

**Response Format**:

*Success Response (200):*
```json
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "username": "user-name",
      "displayName": "User Display Name",
      "uuid": "{user-uuid}"
    }
  }
}
```

*Error Response (401):*
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired token"
  }
}
```

## Authentication

The API uses Bitbucket access tokens for authentication. Tokens should be included in the request body for relevant endpoints.

**Token Requirements**:
- Valid Bitbucket access token with repository read permissions
- Token must not be expired
- Token must have access to the specified repository

## Rate Limiting

- **Rate Limit**: 100 requests per minute per IP address
- **Burst Limit**: 10 requests per second
- Rate limit headers are included in responses:
  - `X-RateLimit-Limit`: Maximum requests per window
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Timestamp when rate limit resets

## Error Handling

All API endpoints follow consistent error response format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": "Additional context (optional)"
  }
}
```

**HTTP Status Codes**:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (invalid token)
- `404`: Not Found (PR or resource not found)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

## CORS Configuration

The API supports Cross-Origin Resource Sharing (CORS) for browser extension requests:

- **Allowed Origins**: Chrome extension origins (`chrome-extension://`)
- **Allowed Methods**: `GET`, `POST`, `OPTIONS`
- **Allowed Headers**: `Content-Type`, `Authorization`

## Security Considerations

1. **Token Security**: Bitbucket tokens are not stored on the backend; they are only used for API requests
2. **HTTPS Only**: Production deployment must use HTTPS
3. **Input Validation**: All inputs are validated and sanitized
4. **Error Disclosure**: Error messages do not expose sensitive system information

## Development Testing

**Using curl**:
```bash
# Test health endpoint
curl -X GET http://localhost:3001/api/health

# Test generate endpoint
curl -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prUrl": "https://bitbucket.org/workspace/repo/pull-requests/123",
    "token": "your-bitbucket-token",
    "llmProvider": "openai",
    "model": "gpt-4"
  }'
```

**Using JavaScript (for extension testing)**:
```javascript
// Generate PR description
const response = await fetch('http://localhost:3001/api/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prUrl: 'https://bitbucket.org/workspace/repo/pull-requests/123',
    token: 'your-token',
    llmProvider: 'openai',
    model: 'gpt-4'
  })
});

const result = await response.json();
```

## Changelog

- **v1.0.0** (2025-06-13): Initial API specification
