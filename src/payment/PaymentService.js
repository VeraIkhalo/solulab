const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');
const logger = require('../logger/Logger');
const paymentRepository = require('./PaymentRepository');
const lockManager = require('../concurrency/LockManager');
const RetryHandler = require('../retry/RetryHandler');
const CircuitBreaker = require('../circuit-breaker/CircuitBreaker');
const { GatewaySimulator } = require('../gateway/GatewaySimulator');
const WebhookHandler = require('../webhook/WebhookHandler');

class PaymentService {
  constructor() {
    this.repository = paymentRepository;
    this.lockManager = lockManager;
    this.retryHandler = new RetryHandler(config.payment);
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    this.gateway = new GatewaySimulator();
    this.webhookHandler = new WebhookHandler(this.repository);
  }

  async initiatePayment(paymentRequest) {
    const {
      amount,
      currency,
      customerId,
      orderId,
      description,
      idempotencyKey,
    } = paymentRequest;

    this.validatePaymentRequest(paymentRequest);

    if (idempotencyKey) {
      const existingResult =
        this.repository.getIdempotencyResult(idempotencyKey);
      if (existingResult) {
        logger.info('Idempotent request - returning cached result', {
          idempotencyKey,
          paymentId: existingResult.paymentId,
        });
        return existingResult.result;
      }
    }

    const paymentId = uuidv4();

    try {
      const payment = this.repository.createPayment(paymentId, {
        amount,
        currency,
        customerId,
        orderId,
        description,
      });

      logger.logPaymentEvent(paymentId, 'INITIATED', {
        amount,
        currency,
        customerId,
      });

      if (idempotencyKey) {
        this.repository.recordIdempotencyKey(idempotencyKey, paymentId, {
          id: payment.id,
          status: payment.status,
          createdAt: payment.createdAt,
        });
      }

      return {
        id: payment.id,
        status: payment.status,
        createdAt: payment.createdAt,
      };
    } catch (error) {
      logger.error('Failed to initiate payment', error, {
        customerId,
        orderId,
      });
      throw error;
    }
  }

  async processPayment(paymentId) {
    const lockToken = this.lockManager.acquire(paymentId);
    if (!lockToken) {
      throw new Error(
        `Payment ${paymentId} is already being processed (concurrency violation)`
      );
    }

    try {
      const payment = this.repository.getPayment(paymentId);
      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`);
      }

      if (payment.status !== 'PENDING') {
        throw new Error(
          `Cannot process payment in ${payment.status} state`
        );
      }

      this.repository.updatePaymentStatus(paymentId, 'PROCESSING');
      logger.logPaymentEvent(paymentId, 'PROCESSING_STARTED');

      if (!this.circuitBreaker.canMakeRequest()) {
        logger.warn('Circuit breaker is OPEN, rejecting payment', {
          paymentId,
          state: this.circuitBreaker.getState(),
        });
        throw new Error('Payment gateway is currently unavailable');
      }

      try {
        const result = await this.retryHandler.executeWithRetry(
          async () => {
            return await this.gateway.processPayment(payment, config.payment.gatewayTimeoutMs);
          },
          { paymentId },
          (retryInfo) => {
            this.handleRetryAttempt(paymentId, retryInfo);
            this.repository.updatePaymentStatus(paymentId, 'PROCESSING', {
              retryCount: retryInfo.attempt,
            });
          }
        );

        this.circuitBreaker.recordSuccess();
        this.repository.updatePaymentStatus(paymentId, 'SUCCESS', {
          gatewayResponse: result,
        });

        logger.logPaymentEvent(paymentId, 'SUCCESS', {
          transactionId: result.transactionId,
        });

        return {
          id: paymentId,
          status: 'SUCCESS',
          transactionId: result.transactionId,
        };
      } catch (error) {
        this.circuitBreaker.recordFailure();
        this.repository.updatePaymentStatus(paymentId, 'FAILED', {
          error,
        });

        logger.error('Payment processing failed after retries', error, {
          paymentId,
          attempts: payment.retryCount + 1,
        });

        throw error;
      }
    } finally {
      this.lockManager.release(paymentId, lockToken);
      logger.logConcurrencyLock(paymentId, 'RELEASED');
    }
  }

  handleRetryAttempt(paymentId, retryInfo) {
    logger.logRetryAttempt(
      paymentId,
      retryInfo.attempt,
      retryInfo.maxRetries,
      retryInfo.error
    );
  }

  getPaymentStatus(paymentId) {
    const payment = this.repository.getPayment(paymentId);
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    return {
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      retryCount: payment.retryCount,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      lastError: payment.lastError,
    };
  }

  handleWebhookCallback(webhookData) {
    return this.webhookHandler.handleWebhook(webhookData);
  }

  validatePaymentRequest(request) {
    const { amount, currency, customerId } = request;

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }

    if (!currency) {
      throw new Error('Currency is required');
    }

    if (!customerId) {
      throw new Error('Customer ID is required');
    }
  }

  getHealthMetrics() {
    return {
      circuitBreaker: this.circuitBreaker.getMetrics(),
      activeLocks: this.lockManager.getAllLocks().length,
      retryStrategy: this.retryHandler.getStrategyInfo(),
      gatewayConfig: this.gateway.getConfig(),
      paymentStats: {
        total: this.repository.getAllPayments().length,
        pending: this.repository.getPaymentsByStatus('PENDING').length,
        processing: this.repository.getPaymentsByStatus('PROCESSING').length,
        success: this.repository.getPaymentsByStatus('SUCCESS').length,
        failed: this.repository.getPaymentsByStatus('FAILED').length,
      },
    };
  }

  configureGateway(config) {
    this.gateway.configure(config);
    logger.info('Gateway configuration updated', config);
  }

  getAllPayments() {
    return this.repository.getAllPayments();
  }
}

module.exports = new PaymentService();
