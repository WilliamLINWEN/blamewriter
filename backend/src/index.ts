import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { validateEnvironmentOrExit } from './utils/env-validation';
import generateRouter from './routes/generate-v2';
import multiLLMRouter from './routes/generate-v2-multi-llm';
import authRouter from './routes/auth';
import { requestLoggingMiddleware, auditMiddleware } from './middleware/logging';

// Load environment variables
dotenv.config();

// Validate environment variables before starting server
console.log('🔍 Validating environment configuration...');
const envConfig = validateEnvironmentOrExit();

const app = express();
const PORT = envConfig.PORT;

// CORS configuration for extension communication
app.use(
  cors({
    origin: ['chrome-extension://*', 'moz-extension://*', 'http://localhost:*'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// JSON body parsing middleware
app.use(express.json({ limit: '10mb' }));

// Enhanced request logging and audit middleware
app.use(requestLoggingMiddleware());
app.use(auditMiddleware());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: envConfig.NODE_ENV,
    port: envConfig.PORT,
    environmentValidated: true,
  });
});

// API Routes
app.use('/api/v1', generateRouter);
app.use('/api/v2', multiLLMRouter); // Enhanced multi-LLM provider route
app.use('/api/auth', authRouter); // OAuth authentication routes

// Basic error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error occurred:', err);

  // Don't expose internal error details in production
  const isDevelopment = envConfig.NODE_ENV !== 'production';

  res.status(500).json({
    error: 'Internal Server Error',
    message: isDevelopment ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${envConfig.NODE_ENV}`);
  console.log(`✅ All environment variables validated and loaded successfully`);
});

export default app;
