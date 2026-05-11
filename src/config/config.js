module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',

  payment: {
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    initialBackoffMs: parseInt(process.env.INITIAL_BACKOFF_MS || '1000'),
    maxBackoffMs: parseInt(process.env.MAX_BACKOFF_MS || '30000'),
    backoffMultiplier: parseFloat(process.env.BACKOFF_MULTIPLIER || '2'),
    jitterFactor: parseFloat(process.env.JITTER_FACTOR || '0.1'),

    gatewayTimeoutMs: parseInt(process.env.GATEWAY_TIMEOUT_MS || '5000'),
    webhookTimeoutMs: parseInt(process.env.WEBHOOK_TIMEOUT_MS || '10000'),

    states: {
      PENDING: 'PENDING',
      PROCESSING: 'PROCESSING',
      SUCCESS: 'SUCCESS',
      FAILED: 'FAILED',
      CANCELLED: 'CANCELLED',
    },
  },

  circuitBreaker: {
    failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5'),
    resetTimeoutMs: parseInt(process.env.CIRCUIT_BREAKER_RESET_MS || '60000'),
    monitoringWindowMs: parseInt(process.env.CIRCUIT_BREAKER_WINDOW_MS || '10000'),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },
};
