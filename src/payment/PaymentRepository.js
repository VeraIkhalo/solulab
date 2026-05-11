class PaymentRepository {
  constructor() {
    this.payments = new Map();
    this.idempotencyKeys = new Map();
  }

  createPayment(paymentId, paymentData) {
    if (this.payments.has(paymentId)) {
      throw new Error(`Payment ${paymentId} already exists`);
    }

    const payment = {
      id: paymentId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      customerId: paymentData.customerId,
      orderId: paymentData.orderId,
      description: paymentData.description,
      status: 'PENDING',
      retryCount: 0,
      maxRetries: paymentData.maxRetries || 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastError: null,
      gatewayResponse: null,
      webhookReceived: false,
      webhookData: null,
    };

    this.payments.set(paymentId, payment);
    return payment;
  }

  getPayment(paymentId) {
    return this.payments.get(paymentId);
  }

  updatePaymentStatus(paymentId, status, meta = {}) {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    const oldStatus = payment.status;
    payment.status = status;
    payment.updatedAt = new Date();

    if (meta.error) {
      payment.lastError = {
        message: meta.error.message,
        code: meta.error.code,
        timestamp: new Date(),
      };
    }

    if (meta.gatewayResponse) {
      payment.gatewayResponse = meta.gatewayResponse;
    }

    if (meta.retryCount !== undefined) {
      payment.retryCount = meta.retryCount;
    }

    return payment;
  }

  recordIdempotencyKey(idempotencyKey, paymentId, result) {
    this.idempotencyKeys.set(idempotencyKey, {
      paymentId,
      result,
      timestamp: new Date(),
    });
  }

  getIdempotencyResult(idempotencyKey) {
    return this.idempotencyKeys.get(idempotencyKey);
  }

  updateWebhookStatus(paymentId, webhookData) {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    payment.webhookReceived = true;
    payment.webhookData = webhookData;
    payment.updatedAt = new Date();

    return payment;
  }

  getAllPayments() {
    return Array.from(this.payments.values());
  }

  getPaymentsByStatus(status) {
    return Array.from(this.payments.values()).filter((p) => p.status === status);
  }

  clear() {
    this.payments.clear();
    this.idempotencyKeys.clear();
  }
}

module.exports = new PaymentRepository();
