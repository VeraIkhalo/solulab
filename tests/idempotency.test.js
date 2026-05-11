const paymentRepository = require('../src/payment/PaymentRepository');

describe('Idempotency', () => {
  beforeEach(() => {
    paymentRepository.clear();
  });

  describe('Idempotency Key Recording', () => {
    test('should record and retrieve idempotency key result', () => {
      const idempotencyKey = 'key-123';
      const paymentId = 'payment-123';
      const result = {
        id: paymentId,
        status: 'SUCCESS',
        amount: 100,
      };

      paymentRepository.recordIdempotencyKey(idempotencyKey, paymentId, result);

      const retrieved = paymentRepository.getIdempotencyResult(idempotencyKey);

      expect(retrieved).toBeTruthy();
      expect(retrieved.paymentId).toBe(paymentId);
      expect(retrieved.result).toEqual(result);
    });

    test('should return null for unknown idempotency key', () => {
      const result = paymentRepository.getIdempotencyResult('unknown-key');

      expect(result).toBeUndefined();
    });

    test('should prevent duplicate payment processing', () => {
      const idempotencyKey = 'key-123';
      const paymentId = 'payment-123';

      const result1 = {
        id: paymentId,
        status: 'PENDING',
      };

      paymentRepository.recordIdempotencyKey(idempotencyKey, paymentId, result1);

      const result2 = paymentRepository.getIdempotencyResult(idempotencyKey);

      expect(result2.paymentId).toBe(paymentId);
    });
  });

  describe('Payment Consistency', () => {
    test('should prevent duplicate payment creation', () => {
      const payment1 = paymentRepository.createPayment('payment-123', {
        amount: 100,
        currency: 'USD',
        customerId: 'customer-123',
      });

      expect(() => {
        paymentRepository.createPayment('payment-123', {
          amount: 100,
          currency: 'USD',
          customerId: 'customer-123',
        });
      }).toThrow('already exists');

      expect(payment1.id).toBe('payment-123');
    });

    test('should maintain data consistency on repeated updates', () => {
      const paymentId = 'payment-123';

      paymentRepository.createPayment(paymentId, {
        amount: 100,
        currency: 'USD',
        customerId: 'customer-123',
      });

      paymentRepository.updatePaymentStatus(paymentId, 'PROCESSING');
      const payment1 = paymentRepository.getPayment(paymentId);

      paymentRepository.updatePaymentStatus(paymentId, 'SUCCESS');
      const payment2 = paymentRepository.getPayment(paymentId);

      expect(payment1.status).toBe('PROCESSING');
      expect(payment2.status).toBe('SUCCESS');
      expect(payment1.amount).toBe(payment2.amount); // Amount should not change
    });
  });
});
