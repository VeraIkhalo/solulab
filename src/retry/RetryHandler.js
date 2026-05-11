class RetryHandler {
  constructor(config) {
    this.config = config;
  }

  calculateBackoffTime(attemptNumber) {
    let backoff =
      this.config.initialBackoffMs *
      Math.pow(this.config.backoffMultiplier, attemptNumber - 1);


    backoff = Math.min(backoff, this.config.maxBackoffMs);

    const jitter =
      Math.random() *
      backoff *
      this.config.jitterFactor;

    return Math.floor(backoff + jitter);
  }

  shouldRetry(attemptNumber, maxRetries) {
    return attemptNumber < maxRetries;
  }

  async executeWithRetry(
    fn,
    context = {},
    onRetry = null
  ) {
    const maxRetries = this.config.maxRetries;
    let lastError = null;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        attempt++;

        if (!this.shouldRetry(attempt, maxRetries)) {
          throw error;
        }

        const backoffTime = this.calculateBackoffTime(attempt);

        if (onRetry) {
          onRetry({
            attempt,
            maxRetries,
            error,
            backoffTime,
            context,
          });
        }

        await new Promise((resolve) => setTimeout(resolve, backoffTime));
      }
    }

    throw lastError;
  }

  getStrategyInfo() {
    return {
      name: 'Exponential Backoff with Jitter',
      maxRetries: this.config.maxRetries,
      initialBackoffMs: this.config.initialBackoffMs,
      maxBackoffMs: this.config.maxBackoffMs,
      backoffMultiplier: this.config.backoffMultiplier,
      jitterFactor: this.config.jitterFactor,
    };
  }

  getBackoffSchedule() {
    const schedule = [];
    for (let i = 1; i < this.config.maxRetries; i++) {
      schedule.push({
        attempt: i,
        backoffMs: this.calculateBackoffTime(i),
      });
    }
    return schedule;
  }
}

module.exports = RetryHandler;
