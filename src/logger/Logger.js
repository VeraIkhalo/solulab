const winston = require('winston');
const config = require('../config/config');

class Logger {
  constructor() {
    this.logger = winston.createLogger({
      level: config.logging.level,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'payment-system' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              let metaStr = '';
              if (Object.keys(meta).length > 0) {
                metaStr = ` ${JSON.stringify(meta)}`;
              }
              return `[${timestamp}] ${level}: ${message}${metaStr}`;
            })
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: winston.format.json(),
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: winston.format.json(),
        }),
      ],
    });


    const fs = require('fs');
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs');
    }
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  error(message, error, meta = {}) {
    const errorMeta = {
      ...meta,
      error: {
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
      },
    };
    this.logger.error(message, errorMeta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  logPaymentEvent(paymentId, event, details = {}) {
    this.info(`Payment Event: ${event}`, {
      paymentId,
      event,
      ...details,
    });
  }

  logRetryAttempt(paymentId, attempt, maxAttempts, error) {
    this.warn(`Retry Attempt for Payment`, {
      paymentId,
      attempt,
      maxAttempts,
      error: error?.message,
    });
  }

  logConcurrencyLock(paymentId, action) {
    this.debug(`Concurrency Lock: ${action}`, { paymentId });
  }

  logCircuitBreakerChange(state, meta = {}) {
    this.warn(`Circuit Breaker State Changed: ${state}`, meta);
  }
}

module.exports = new Logger();
