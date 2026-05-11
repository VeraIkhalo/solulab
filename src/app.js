const express = require('express');
const config = require('./config/config');
const logger = require('./logger/Logger');
const {
  ErrorHandler,
  requestIdMiddleware,
  loggingMiddleware,
} = require('./middleware/errorHandler');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

app.use(express.json());
app.use(requestIdMiddleware);
app.use(loggingMiddleware);
app.use(express.json({ limit: '10mb' }));

app.use('/', paymentRoutes);

app.get('/', (req, res) => {
  res.json({
    service: 'Payment Processing System',
    version: '1.0.0',
    endpoints: {
      initiate_payment: 'POST /payments',
      process_payment: 'POST /payments/:paymentId/process',
      get_payment: 'GET /payments/:paymentId',
      webhook: 'POST /webhooks/payment',
      health: 'GET /health',
      metrics: 'GET /metrics',
      admin_payments: 'GET /admin/payments',
      admin_configure_gateway: 'POST /admin/gateway/configure',
    },
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Not Found',
      code: 'NOT_FOUND',
      path: req.path,
    },
  });
});

app.use(ErrorHandler.validateJson);
app.use(ErrorHandler.handle);

const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Payment Processing System started on port ${PORT}`, {
    env: config.env,
  });
});

module.exports = app;
