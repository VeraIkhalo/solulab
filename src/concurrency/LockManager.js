class LockManager {
  constructor() {
    this.locks = new Map();
  }

  acquire(paymentId) {
    if (this.locks.has(paymentId)) {
      return null;
    }

    const lockToken = `${paymentId}-${Date.now()}-${Math.random()}`;
    this.locks.set(paymentId, {
      token: lockToken,
      acquiredAt: new Date(),
    });

    return lockToken;
  }

  release(paymentId, lockToken) {
    const lock = this.locks.get(paymentId);
    if (!lock) {
      return false;
    }

    if (lock.token !== lockToken) {
      return false;
    }

    this.locks.delete(paymentId);
    return true;
  }

  isLocked(paymentId) {
    return this.locks.has(paymentId);
  }

  forceRelease(paymentId) {
    return this.locks.delete(paymentId);
  }

  getAllLocks() {
    return Array.from(this.locks.entries()).map(([paymentId, lock]) => ({
      paymentId,
      acquiredAt: lock.acquiredAt,
    }));
  }

  clear() {
    this.locks.clear();
  }
}

module.exports = new LockManager();
