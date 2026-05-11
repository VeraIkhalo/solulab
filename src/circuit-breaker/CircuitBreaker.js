
class CircuitBreaker {
  constructor(config) {
    this.config = config;
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.monitoringWindowStart = Date.now();
  }

  recordSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.setState('CLOSED');
    }
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.setState('OPEN');
    }
  }

  canMakeRequest() {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure >= this.config.resetTimeoutMs) {
        this.setState('HALF_OPEN');
        return true;
      }
      return false;
    }

    if (this.state === 'HALF_OPEN') {
      return true;
    }

    return false;
  }

  getState() {
    return this.state;
  }

  setState(newState) {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'CLOSED') {
      this.failureCount = 0;
    } else if (newState === 'OPEN') {
      this.lastFailureTime = Date.now();
    }

    if (oldState !== newState) {
      console.log(
        `[CircuitBreaker] State changed: ${oldState} -> ${newState}`
      );
    }
  }

  reset() {
    this.setState('CLOSED');
    this.failureCount = 0;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      failureThreshold: this.config.failureThreshold,
    };
  }
}

module.exports = CircuitBreaker;
