const lockManager = require('../src/concurrency/LockManager');

describe('Concurrency Control - Lock Manager', () => {
  beforeEach(() => {
    lockManager.clear();
  });

  describe('Lock Acquisition and Release', () => {
    test('should acquire lock successfully', () => {
      const paymentId = 'payment-123';
      const token = lockManager.acquire(paymentId);

      expect(token).toBeTruthy();
      expect(lockManager.isLocked(paymentId)).toBe(true);
    });

    test('should prevent concurrent locks on same payment', () => {
      const paymentId = 'payment-123';

      const token1 = lockManager.acquire(paymentId);
      const token2 = lockManager.acquire(paymentId);

      expect(token1).toBeTruthy();
      expect(token2).toBeNull(); // Should fail to acquire second lock
    });

    test('should release lock with correct token', () => {
      const paymentId = 'payment-123';
      const token = lockManager.acquire(paymentId);

      expect(lockManager.isLocked(paymentId)).toBe(true);

      const released = lockManager.release(paymentId, token);
      expect(released).toBe(true);
      expect(lockManager.isLocked(paymentId)).toBe(false);
    });

    test('should not release lock with incorrect token', () => {
      const paymentId = 'payment-123';
      const token1 = lockManager.acquire(paymentId);

      const released = lockManager.release(paymentId, 'wrong-token');
      expect(released).toBe(false);
      expect(lockManager.isLocked(paymentId)).toBe(true);
    });

    test('should allow reacquiring after release', () => {
      const paymentId = 'payment-123';

      const token1 = lockManager.acquire(paymentId);
      lockManager.release(paymentId, token1);

      const token2 = lockManager.acquire(paymentId);
      expect(token2).toBeTruthy();
      expect(lockManager.isLocked(paymentId)).toBe(true);
    });
  });

  describe('Lock Management', () => {
    test('should track active locks', () => {
      lockManager.acquire('payment-1');
      lockManager.acquire('payment-2');

      const locks = lockManager.getAllLocks();
      expect(locks.length).toBe(2);
    });

    test('should force release lock for recovery', () => {
      const paymentId = 'payment-123';
      lockManager.acquire(paymentId);

      expect(lockManager.isLocked(paymentId)).toBe(true);

      lockManager.forceRelease(paymentId);
      expect(lockManager.isLocked(paymentId)).toBe(false);
    });
  });

  describe('Race Condition Prevention', () => {
    test('should handle concurrent payment processing attempts', (done) => {
      const paymentId = 'payment-123';
      let successCount = 0;

      const processingAttempts = [];

      for (let i = 0; i < 5; i++) {
        processingAttempts.push(
          Promise.resolve().then(() => {
            const token = lockManager.acquire(paymentId);
            if (token) {
              successCount++;
              lockManager.release(paymentId, token);
            }
          })
        );
      }

      Promise.all(processingAttempts).then(() => {
        // Only one should succeed
        expect(successCount).toBe(1);
        done();
      });
    });
  });
});
