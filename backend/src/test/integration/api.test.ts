import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../index';

describe('API Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    app = createApp();
  });

  describe('Health Check', () => {
    it('should respond with 200 for health check', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      await request(app).options('/api/v1/generate-mvp').expect(204);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/nonexistent-route').expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});
