class GatewaySimulator {
  constructor() {
    this.failureRate = 0.2;
    this.averageDelayMs = 500;
    this.timeoutRate = 0.1;
  }

  async processPayment(paymentData, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const delay = this.getRandomDelay();

      const timeoutHandle = setTimeout(() => {
        reject(
          new GatewayTimeoutError(
            `Payment processing timed out after ${timeout}ms`
          )
        );
      }, timeout);

      setTimeout(() => {
        clearTimeout(timeoutHandle);

        if (Math.random() < this.timeoutRate) {
          reject(
            new GatewayTimeoutError('Simulated gateway timeout')
          );
          return;
        }

        if (Math.random() < this.failureRate) {
          reject(
            new GatewayProcessingError(
              'Payment declined by gateway',
              'DECLINED',
              paymentData.id
            )
          );
          return;
        }

        const response = {
          transactionId: `TXN-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          status: 'AUTHORIZED',
          amount: paymentData.amount,
          currency: paymentData.currency,
          timestamp: new Date().toISOString(),
          gateway: 'SimulatedGateway',
        };

        resolve(response);
      }, delay);
    });
  }

  getRandomDelay() {
    const randomValue = Math.random();
    return Math.floor(
      -Math.log(randomValue) * this.averageDelayMs
    );
  }

  configure(options) {
    if (options.failureRate !== undefined) {
      this.failureRate = Math.max(0, Math.min(1, options.failureRate));
    }
    if (options.averageDelayMs !== undefined) {
      this.averageDelayMs = Math.max(0, options.averageDelayMs);
    }
    if (options.timeoutRate !== undefined) {
      this.timeoutRate = Math.max(0, Math.min(1, options.timeoutRate));
    }
  }

  getConfig() {
    return {
      failureRate: this.failureRate,
      averageDelayMs: this.averageDelayMs,
      timeoutRate: this.timeoutRate,
    };
  }

  reset() {
    this.failureRate = 0.2;
    this.averageDelayMs = 500;
    this.timeoutRate = 0.1;
  }
}

class GatewayProcessingError extends Error {
  constructor(message, code, paymentId) {
    super(message);
    this.name = 'GatewayProcessingError';
    this.code = code;
    this.paymentId = paymentId;
  }
}

class GatewayTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GatewayTimeoutError';
    this.code = 'GATEWAY_TIMEOUT';
  }
}

module.exports = {
  GatewaySimulator,
  GatewayProcessingError,
  GatewayTimeoutError,
};
