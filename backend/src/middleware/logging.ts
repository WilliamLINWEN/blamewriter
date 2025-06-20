// backend/src/middleware/logging.ts

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ApiMetadata } from '../types/api';

/**
 * Extended Express Request with API metadata
 */
export interface ApiRequest extends Request {
  apiMetadata: ApiMetadata;
  startTime: number;
  audit: (
    entry: Omit<AuditLogEntry, 'timestamp' | 'requestId' | 'ipAddress' | 'userAgent'>,
  ) => void;
}

/**
 * Fields that should be sanitized in logs (contain sensitive data)
 */
const SENSITIVE_FIELDS = [
  'bitbucketToken',
  'apiKey',
  'token',
  'password',
  'secret',
  'key',
  'authorization',
  'bearer',
];

/**
 * Sanitizes an object by replacing sensitive fields with redacted values
 */
function sanitizeObject(obj: any, depth = 0): any {
  if (depth > 5 || obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()));

      if (isSensitive) {
        if (typeof value === 'string' && value.length > 0) {
          sanitized[key] = `[REDACTED-${value.length}chars]`;
        } else {
          sanitized[key] = '[REDACTED]';
        }
      } else {
        sanitized[key] = sanitizeObject(value, depth + 1);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitizes Express headers
 */
function sanitizeHeaders(headers: any): any {
  const sanitized: any = {};
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Request logging middleware with sensitive data sanitization
 */
export function requestLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiReq = req as ApiRequest;
    apiReq.startTime = Date.now();

    // Generate unique request ID
    const requestId = uuidv4();
    apiReq.apiMetadata = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      requestId,
    };

    // Log request with sanitized data
    const sanitizedHeaders = sanitizeHeaders(req.headers);
    const sanitizedBody = sanitizeObject(req.body);
    const sanitizedQuery = sanitizeObject(req.query);

    console.log(`🚀 [${apiReq.apiMetadata.timestamp}] ${req.method} ${req.path}`, {
      requestId,
      headers: sanitizedHeaders,
      query: sanitizedQuery,
      body: Object.keys(req.body).length > 0 ? sanitizedBody : undefined,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.socket.remoteAddress,
    });

    // Override res.json to log responses
    const originalJson = res.json.bind(res);
    res.json = function (data: any) {
      const processingTime = Date.now() - apiReq.startTime;
      apiReq.apiMetadata.processingTime = processingTime;

      // Add metadata to successful responses
      if (data && typeof data === 'object' && !data.error) {
        if (!data.metadata) {
          data.metadata = apiReq.apiMetadata;
        } else {
          data.metadata = { ...apiReq.apiMetadata, ...data.metadata };
        }
      }

      // Log response (sanitize if needed)
      const sanitizedResponse = data && typeof data === 'object' ? sanitizeObject(data) : data;

      console.log(
        `✅ [${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode}`,
        {
          requestId,
          processingTime: `${processingTime}ms`,
          statusCode: res.statusCode,
          responseSize: JSON.stringify(data).length,
          response: res.statusCode >= 400 ? sanitizedResponse : undefined, // Only log error responses
        },
      );

      return originalJson(data);
    };

    next();
  };
}

/**
 * Audit logging for sensitive operations
 */
export interface AuditLogEntry {
  timestamp: string;
  requestId: string;
  userId?: string;
  action: string;
  resource: string;
  outcome: 'success' | 'failure' | 'error';
  details?: Record<string, any>;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * Audit logger for security-sensitive operations
 */
export class AuditLogger {
  private static logs: AuditLogEntry[] = [];

  static log(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    const auditEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
      // Ensure optional fields are properly handled
      ipAddress: entry.ipAddress || undefined,
      userAgent: entry.userAgent || undefined,
    };

    // In production, this should go to a secure audit log system
    this.logs.push(auditEntry);

    console.log(`🔍 [AUDIT] ${auditEntry.timestamp}`, {
      requestId: auditEntry.requestId,
      action: auditEntry.action,
      resource: auditEntry.resource,
      outcome: auditEntry.outcome,
      userId: auditEntry.userId,
      details: sanitizeObject(auditEntry.details),
    });
  }
}

/**
 * Middleware to add audit logging capability to requests
 */
export function auditMiddleware() {
  return (req: Request, _: Response, next: NextFunction) => {
    const apiReq = req as ApiRequest & { audit: typeof AuditLogger.log };

    apiReq.audit = (
      entry: Omit<AuditLogEntry, 'timestamp' | 'requestId' | 'ipAddress' | 'userAgent'>,
    ) => {
      AuditLogger.log({
        ...entry,
        requestId: apiReq.apiMetadata.requestId,
        ipAddress: req.ip || req.connection.remoteAddress || undefined,
        userAgent: req.get('User-Agent') || undefined,
      });
    };

    next();
  };
}
