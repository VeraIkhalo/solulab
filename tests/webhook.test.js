const WebhookHandler = require('../src/webhook/WebhookHandler');
const paymentRepository = require('../src/payment/PaymentRepository');

describe('Webhook Handler', () => {
  let webhookHandler;

  beforeEach(() => {
    paymentRepository.clear();
    webhookHandler = new WebhookHandler(paymentRepository);
  });

  describe('Webhook Processing', () => {
    test('should process valid webhook', () => {
      // Create a payment first
      paymentRepository.createPayment('payment-123', {
        amount: 100,
        currency: 'USD',
        customerId: 'customer-123',
      });

      const webhookData = {
        paymentId: 'payment-123',
        eventId: 'event-123',
        status: 'SUCCESS',
        transactionId: 'txn-123',
        timestamp: new Date().toISOString(),
      };

      const result = webhookHandler.handleWebhook(webhookData);

      expect(result.processed).toBe(true);
      expect(result.result.status).toBe('SUCCESS');
    });

    test('should reject webhook for non-existent payment', () => {
      const webhookData = {
        paymentId: 'non-existent',
        eventId: 'event-123',
        status: 'SUCCESS',
        transactionId: 'txn-123',
        timestamp: new Date().toISOString(),
      };

      const result = webhookHandler.handleWebhook(webhookData);

      expect(result.processed).toBe(false);
      expect(result.code).toBe('PAYMENT_NOT_FOUND');
    });
  });

  describe('Duplicate Webhook Prevention', () => {
    test('should handle duplicate webhooks with same event ID', () => {
      paymentRepository.createPayment('payment-123', {
        amount: 100,
        currency: 'USD',
        customerId: 'customer-123',
      });

      const webhookData = {
        paymentId: 'payment-123',
        eventId: 'event-123',
        status: 'SUCCESS',
        transactionId: 'txn-123',
        timestamp: new Date().toISOString(),
      };

      const result1 = webhookHandler.handleWebhook(webhookData);
      const result2 = webhookHandler.handleWebhook(webhookData);

      expect(result1.processed).toBe(true);
      expect(result1.cached).toBe(false);
      expect(result2.processed).toBe(true);
      expect(result2.cached).toBe(true);
    });
  });

  describe('Webhook Validation', () => {
    test('should validate required webhook fields', () => {
      const webhookData = {
        paymentId: 'payment-123',
        // Missing eventId
        status: 'SUCCESS',
        transactionId: 'txn-123',
        timestamp: new Date().toISOString(),
      };

      const result = webhookHandler.handleWebhook(webhookData);

      expect(result.processed).toBe(false);
      expect(result.code).toBe('INVALID_WEBHOOK');
    });

    test('should validate webhook status', () => {
      paymentRepository.createPayment('payment-123', {
        amount: 100,
        currency: 'USD',
        customerId: 'customer-123',
      });

      const webhookData = {
        paymentId: 'payment-123',
        eventId: 'event-123',
        status: 'INVALID_STATUS',
        transactionId: 'txn-123',
        timestamp: new Date().toISOString(),
      };

      const result = webhookHandler.handleWebhook(webhookData);

      expect(result.processed).toBe(false);
    });
  });

  describe('State Transitions', () => {
    test('should handle valid state transitions', () => {
      paymentRepository.createPayment('payment-123', {
        amount: 100,
        currency: 'USD',
        customerId: 'customer-123',
      });

      // PENDING -> PROCESSING
      const webhook1 = {
        paymentId: 'payment-123',
        eventId: 'event-1',
        status: 'PROCESSING',
        transactionId: 'txn-123',
        timestamp: new Date().toISOString(),
      };

      const result1 = webhookHandler.handleWebhook(webhook1);
      expect(result1.processed).toBe(true);

      // PROCESSING -> SUCCESS
      const webhook2 = {
        paymentId: 'payment-123',
        eventId: 'event-2',
        status: 'SUCCESS',
        transactionId: 'txn-123',
        timestamp: new Date().toISOString(),
      };

      const result2 = webhookHandler.handleWebhook(webhook2);
      expect(result2.processed).toBe(true);
    });

    test('should handle conflicting state transitions gracefully', () => {
      paymentRepository.createPayment('payment-123', {
        amount: 100,
        currency: 'USD',
        customerId: 'customer-123',
      });

      // Update to SUCCESS
      paymentRepository.updatePaymentStatus('payment-123', 'SUCCESS');

      // Try to transition to FAILED (invalid)
      const webhookData = {
        paymentId: 'payment-123',
        eventId: 'event-123',
        status: 'FAILED',
        transactionId: 'txn-123',
        timestamp: new Date().toISOString(),
      };

      const result = webhookHandler.handleWebhook(webhookData);

      // Should handle gracefully without failing
      expect(result.processed).toBe(true);
      expect(result.result.conflict).toBe(true);
    });
  });

  describe('Early Webhooks', () => {
    test('should handle early webhook gracefully', () => {
      const result = webhookHandler.handleEarlyWebhook({
        paymentId: 'payment-123',
        eventId: 'event-123',
        status: 'SUCCESS',
      });

      expect(result.handled).toBe(true);
      expect(result.reason).toBe('EARLY_WEBHOOK');
    });
  });
});
