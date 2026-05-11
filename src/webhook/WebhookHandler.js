class WebhookHandler {
  constructor(paymentRepository) {
    this.paymentRepository = paymentRepository;
    this.processedWebhookEvents = new Map();
  }

  handleWebhook(webhookData) {
    const {
      paymentId,
      eventId,
      status,
      transactionId,
      timestamp,
    } = webhookData;

    if (this.processedWebhookEvents.has(eventId)) {
      return {
        processed: true,
        cached: true,
        result: this.processedWebhookEvents.get(eventId),
      };
    }

    try {
      this.validateWebhookData(webhookData);

      const payment = this.paymentRepository.getPayment(paymentId);
      if (!payment) {
        throw new WebhookError(
          `Payment ${paymentId} not found`,
          'PAYMENT_NOT_FOUND'
        );
      }

      const result = this.processWebhookStatus(payment, status, webhookData);

      this.processedWebhookEvents.set(eventId, {
        paymentId,
        status,
        timestamp: new Date(),
      });

      return {
        processed: true,
        cached: false,
        result,
      };
    } catch (error) {
      return {
        processed: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  processWebhookStatus(payment, webhookStatus, webhookData) {
    const validTransitions = {
      PENDING: ['PROCESSING', 'SUCCESS', 'FAILED'],
      PROCESSING: ['SUCCESS', 'FAILED'],
      SUCCESS: [],
      FAILED: ['PROCESSING'],
    };


    const allowedTransitions = validTransitions[payment.status] || [];
    if (!allowedTransitions.includes(webhookStatus)) {
      console.warn(
        `Invalid state transition for payment ${payment.id}: ${payment.status} -> ${webhookStatus}`
      );

      if (payment.status === 'SUCCESS' && webhookStatus === 'SUCCESS') {
        return { status: 'SUCCESS', updated: false };
      }

      if (['SUCCESS', 'FAILED'].includes(payment.status)) {
        return {
          status: payment.status,
          updated: false,
          conflict: true,
        };
      }
    }

    const updatedPayment = this.paymentRepository.updatePaymentStatus(
      payment.id,
      webhookStatus,
      {
        gatewayResponse: {
          transactionId: webhookData.transactionId,
          ...webhookData,
        },
      }
    );

    return {
      status: webhookStatus,
      updated: true,
      payment: updatedPayment,
    };
  }

  validateWebhookData(webhookData) {
    const requiredFields = ['paymentId', 'eventId', 'status', 'timestamp'];

    for (const field of requiredFields) {
      if (!webhookData[field]) {
        throw new WebhookError(
          `Missing required field: ${field}`,
          'INVALID_WEBHOOK'
        );
      }
    }

    const validStatuses = ['PROCESSING', 'SUCCESS', 'FAILED'];
    if (!validStatuses.includes(webhookData.status)) {
      throw new WebhookError(
        `Invalid webhook status: ${webhookData.status}`,
        'INVALID_STATUS'
      );
    }
  }

  handleEarlyWebhook(webhookData) {
    return {
      handled: true,
      reason: 'EARLY_WEBHOOK',
      details: 'Webhook received before payment reached expected state',
    };
  }

  getProcessedWebhooks() {
    return Array.from(this.processedWebhookEvents.entries()).map(
      ([eventId, data]) => ({
        eventId,
        ...data,
      })
    );
  }

  clearProcessedWebhooks() {
    this.processedWebhookEvents.clear();
  }
}

class WebhookError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'WebhookError';
    this.code = code;
  }
}

module.exports = WebhookHandler;
