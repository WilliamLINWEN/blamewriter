import {
  BitbucketApiClient,
  BitbucketServiceError,
  BitbucketApiErrorCode,
} from '../../services/bitbucket';

describe('Bitbucket Service', () => {
  describe('BitbucketApiClient', () => {
    it('should create client with valid token', () => {
      const client = new BitbucketApiClient('test-token');
      expect(client).toBeInstanceOf(BitbucketApiClient);
    });

    it('should throw error for empty token', () => {
      expect(() => new BitbucketApiClient('')).toThrow(BitbucketServiceError);
    });

    it('should throw error for undefined token', () => {
      expect(() => new BitbucketApiClient(undefined as any)).toThrow(BitbucketServiceError);
    });
  });

  describe('BitbucketServiceError', () => {
    it('should create error with correct properties', () => {
      const error = new BitbucketServiceError(
        BitbucketApiErrorCode.UNAUTHORIZED,
        'Test error message',
        401,
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(BitbucketApiErrorCode.UNAUTHORIZED);
      expect(error.message).toBe('Test error message');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('BitbucketServiceError');
    });
  });
});
