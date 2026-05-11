const paymentService = require('../src/payment/PaymentService');
const paymentRepository = require('../src/payment/PaymentRepository');
const lockManager = require('../src/concurrency/LockManager');
const WebhookHandler = require('../src/webhook/WebhookHandler');

describe('Payment Service - Core Flow', () => {
  beforeEach(() => {
    paymentRepository.clear();
    lockManager.clear();
  });

  describe('Payment Initiation', () => {
    test('should initiate a payment successfully', async () => {
      const result = await paymentService.initiatePayment({
        amount: 100,
        currency: 'USD',
        customerId: 'customer123',
        orderId: 'order123',
        description: 'Test payment',
      });

      expect(result).toHaveProperty('id');
      expect(result.status).toBe('PENDING');
      expect(result).toHaveProperty('createdAt');
    });

    test('should reject invalid payment request', async () => {
      await expect(
        paymentService.initiatePayment({
          amount: 0,
          currency: 'USD',
          customerId: 'customer123',
        })
      ).rejects.toThrow('Invalid amount');
    });

    test('should reject payment without currency', async () => {
      await expect(
        paymentService.initiatePayment({
          amount: 100,
          customerId: 'customer123',
        })
      ).rejects.toThrow('Currency is required');
    });

    test('should reject payment without customer ID', async () => {
      await expect(
        paymentService.initiatePayment({
          amount: 100,
          currency: 'USD',
        })
      ).rejects.toThrow('Customer ID is required');
    });
  });

  describe('Idempotency', () => {
    test('should handle idempotent requests correctly', async () => {
      const idempotencyKey = 'idempotency-key-12345';

      const result1 = await paymentService.initiatePayment({
        amount: 100,
        currency: 'USD',
        customerId: 'customer123',
        orderId: 'order123',
        idempotencyKey,
      });

      const result2 = await paymentService.initiatePayment({
        amount: 100,
        currency: 'USD',
        customerId: 'customer123',
        orderId: 'order123',
        idempotencyKey,
      });

      // Both should return the same payment ID
      expect(result1.id).toBe(result2.id);
    });

    test('should differentiate between different idempotency keys', async () => {
      const result1 = await paymentService.initiatePayment({
        amount: 100,
        currency: 'USD',
        customerId: 'customer123',
        idempotencyKey: 'key-1',
      });

      const result2 = await paymentService.initiatePayment({
        amount: 100,
        currency: 'USD',
        customerId: 'customer123',
        idempotencyKey: 'key-2',
      });

      // Different keys should create different payments
      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('Payment Status Retrieval', () => {
    test('should retrieve payment status', async () => {
      const payment = await paymentService.initiatePayment({
        amount: 100,
        currency: 'USD',
        customerId: 'customer123',
      });

      const status = paymentService.getPaymentStatus(payment.id);

      expect(status.id).toBe(payment.id);
      expect(status.status).toBe('PENDING');
      expect(status.amount).toBe(100);
    });

    test('should throw error for non-existent payment', () => {
      expect(() => {
        paymentService.getPaymentStatus('non-existent-id');
      }).toThrow('not found');
    });
  });

  describe('Health Metrics', () => {
    test('should provide system health metrics', () => {
      const metrics = paymentService.getHealthMetrics();

      expect(metrics).toHaveProperty('circuitBreaker');
      expect(metrics).toHaveProperty('retryStrategy');
      expect(metrics).toHaveProperty('gatewayConfig');
      expect(metrics).toHaveProperty('paymentStats');
      expect(metrics.paymentStats.total).toBeGreaterThanOrEqual(0);
    });
  });
});
