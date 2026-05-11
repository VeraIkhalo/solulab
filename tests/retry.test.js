const RetryHandler = require('../src/retry/RetryHandler');
const config = require('../src/config/config');

describe('Retry Handler', () => {
  let retryHandler;

  beforeEach(() => {
    retryHandler = new RetryHandler(config.payment);
  });

  describe('Backoff Calculation', () => {
    test('should calculate exponential backoff correctly', () => {
      const backoff1 = retryHandler.calculateBackoffTime(1);
      const backoff2 = retryHandler.calculateBackoffTime(2);
      const backoff3 = retryHandler.calculateBackoffTime(3);

      // Backoff should generally increase (accounting for jitter)
      expect(backoff2).toBeGreaterThanOrEqual(backoff1);
      expect(backoff3).toBeGreaterThanOrEqual(backoff2);
    });

    test('should respect maximum backoff limit', () => {
      const backoff = retryHandler.calculateBackoffTime(10);

      expect(backoff).toBeLessThanOrEqual(config.payment.maxBackoffMs);
    });

    test('should include jitter in backoff calculation', () => {
      const backoffs = [];
      for (let i = 0; i < 5; i++) {
        backoffs.push(retryHandler.calculateBackoffTime(2));
      }

      // With jitter, backoffs should vary
      const unique = new Set(backoffs).size;
      expect(unique).toBeGreaterThan(1);
    });
  });

  describe('Retry Logic', () => {
    test('should succeed on first attempt', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        return 'success';
      };

      const result = await retryHandler.executeWithRetry(fn);

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    test('should retry on failure', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await retryHandler.executeWithRetry(fn);

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    test('should fail after maximum retries', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        throw new Error('Permanent failure');
      };

      await expect(retryHandler.executeWithRetry(fn)).rejects.toThrow(
        'Permanent failure'
      );
      expect(attempts).toBe(config.payment.maxRetries);
    });

    test('should call retry callback on attempt', async () => {
      let attempts = 0;
      const retryAttempts = [];

      const fn = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Fail once');
        }
        return 'success';
      };

      const onRetry = (info) => {
        retryAttempts.push(info);
      };

      await retryHandler.executeWithRetry(fn, {}, onRetry);

      expect(retryAttempts.length).toBe(1);
      expect(retryAttempts[0].attempt).toBe(1);
    });
  });

  describe('Strategy Info', () => {
    test('should provide retry strategy information', () => {
      const info = retryHandler.getStrategyInfo();

      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('maxRetries');
      expect(info).toHaveProperty('initialBackoffMs');
      expect(info).toHaveProperty('maxBackoffMs');
    });

    test('should generate backoff schedule', () => {
      const schedule = retryHandler.getBackoffSchedule();

      expect(schedule.length).toBeGreaterThan(0);
      expect(schedule[0]).toHaveProperty('attempt');
      expect(schedule[0]).toHaveProperty('backoffMs');
    });
  });
});
