const logger = require('../logger/Logger');

class ErrorHandler {
  static handle(err, req, res, next) {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    logger.error('API Error', err, {
      path: req.path,
      method: req.method,
      status,
    });

    res.status(status).json({
      error: {
        message,
        code: err.code || 'INTERNAL_ERROR',
        status,
        timestamp: new Date().toISOString(),
        requestId: req.id,
      },
    });
  }

  static validateJson(err, req, res, next) {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({
        error: {
          message: 'Invalid JSON',
          code: 'INVALID_JSON',
          status: 400,
        },
      });
    }
    next(err);
  }
}

function requestIdMiddleware(req, res, next) {
  const { v4: uuidv4 } = require('uuid');
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
}

function loggingMiddleware(req, res, next) {
  const logger = require('../logger/Logger');

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.id,
    });
  });

  next();
}

module.exports = {
  ErrorHandler,
  requestIdMiddleware,
  loggingMiddleware,
};
