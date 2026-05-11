const express = require('express');
const paymentService = require('../payment/PaymentService');
const logger = require('../logger/Logger');

const router = express.Router();

router.post('/payments', async (req, res, next) => {
  try {
    const {
      amount,
      currency,
      customerId,
      orderId,
      description,
      idempotencyKey,
    } = req.body;

    const payment = await paymentService.initiatePayment({
      amount,
      currency,
      customerId,
      orderId,
      description,
      idempotencyKey,
    });

    res.status(201).json({
      data: payment,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to initiate payment', error);
    res.status(400).json({
      error: {
        message: error.message,
        code: 'PAYMENT_INITIATION_FAILED',
      },
    });
  }
});

router.post('/payments/:paymentId/process', async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    const result = await paymentService.processPayment(paymentId);

    res.status(200).json({
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to process payment', error, {
      paymentId: req.params.paymentId,
    });

    const statusCode =
      error.message.includes('not found') ||
      error.message.includes('already being processed')
        ? 409
        : 400;

    res.status(statusCode).json({
      error: {
        message: error.message,
        code: 'PAYMENT_PROCESSING_FAILED',
      },
    });
  }
});

router.get('/payments/:paymentId', async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    const payment = paymentService.getPaymentStatus(paymentId);

    res.status(200).json({
      data: payment,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get payment status', error);
    res.status(404).json({
      error: {
        message: error.message,
        code: 'PAYMENT_NOT_FOUND',
      },
    });
  }
});

router.post('/webhooks/payment', async (req, res, next) => {
  try {
    const webhookData = req.body;

    const result = paymentService.handleWebhookCallback(webhookData);

    if (!result.processed) {
      return res.status(400).json({
        error: {
          message: result.error,
          code: result.code,
        },
      });
    }

    res.status(200).json({
      data: {
        processed: true,
        cached: result.cached,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to process webhook', error);
    res.status(500).json({
      error: {
        message: 'Webhook processing failed',
        code: 'WEBHOOK_PROCESSING_ERROR',
      },
    });
  }
});

router.get('/health', (req, res) => {
  const metrics = paymentService.getHealthMetrics();

  res.status(200).json({
    status: 'healthy',
    circuitBreakerState: metrics.circuitBreaker.state,
    paymentStats: metrics.paymentStats,
    timestamp: new Date().toISOString(),
  });
});

router.get('/metrics', (req, res) => {
  const metrics = paymentService.getHealthMetrics();

  res.status(200).json({
    data: metrics,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

router.get('/admin/payments', (req, res) => {
  const payments = paymentService.getAllPayments();

  res.status(200).json({
    data: payments,
    meta: {
      count: payments.length,
      timestamp: new Date().toISOString(),
    },
  });
});

router.post('/admin/gateway/configure', (req, res) => {
  try {
    const config = req.body;
    paymentService.configureGateway(config);

    res.status(200).json({
      data: { configured: true },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(400).json({
      error: {
        message: error.message,
        code: 'CONFIGURATION_ERROR',
      },
    });
  }
});

module.exports = router;
