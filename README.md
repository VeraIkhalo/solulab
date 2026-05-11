# Payment Processing System - README

## Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Server starts on `http://localhost:3000`

### Testing

```bash
npm test
npm run test:watch
```

### Production

```bash
npm start
```

---

## Features

✅ **Payment Lifecycle Management**
- States: PENDING → PROCESSING → SUCCESS/FAILED
- Complete state tracking and validation

✅ **Failure Handling & Retry Logic**
- Exponential backoff with jitter
- Configurable max retries (default: 3)
- Automatic retry on transient failures

✅ **Idempotency**
- Duplicate prevention via idempotency keys
- Safe for repeated requests
- Cached result return

✅ **Concurrency Control**
- Lock-based mechanism
- Prevents parallel processing of same payment
- Token-based lock validation

✅ **External Gateway Simulation**
- Realistic failure scenarios
- Random delays (Poisson distribution)
- Configurable success/failure rates

✅ **Webhook/Callback Handling**
- Asynchronous payment updates
- Duplicate event prevention
- State transition validation
- Conflict resolution

✅ **Data Consistency**
- ACID-like guarantees (in-memory)
- Proper error recovery
- State recovery from partial failures

✅ **Logging & Observability**
- Winston logger integration
- Event tracing
- Error tracking
- Performance monitoring

✅ **Resilience Patterns**
- Circuit breaker (prevents cascading failures)
- Exponential backoff (prevents resource exhaustion)
- Jitter (prevents thundering herd)

---

## Project Structure

```
src/
├── app.js                    # Express app setup
├── config/
│   └── config.js             # Configuration
├── logger/
│   └── Logger.js             # Winston logger
├── payment/
│   ├── PaymentService.js     # Main orchestrator
│   └── PaymentRepository.js  # Data store
├── concurrency/
│   └── LockManager.js        # Concurrency control
├── retry/
│   └── RetryHandler.js       # Retry logic
├── circuit-breaker/
│   └── CircuitBreaker.js     # Circuit breaker
├── gateway/
│   └── GatewaySimulator.js   # External gateway
├── webhook/
│   └── WebhookHandler.js     # Webhook processing
├── middleware/
│   └── errorHandler.js       # Error handling
└── routes/
    └── paymentRoutes.js      # API routes

tests/
├── payment.test.js           # Core flow tests
├── concurrency.test.js       # Concurrency tests
├── retry.test.js             # Retry logic tests
├── idempotency.test.js       # Idempotency tests
├── webhook.test.js           # Webhook tests
└── jest.config.js            # Jest configuration

docs/
├── API.md                    # API documentation
├── DESIGN.md                 # System design
└── README.md                 # This file
```

---

## Configuration

All configuration via environment variables:

```bash
# Server
PORT=3000
NODE_ENV=development

# Payment Processing
MAX_RETRIES=3
INITIAL_BACKOFF_MS=1000
MAX_BACKOFF_MS=30000
BACKOFF_MULTIPLIER=2
JITTER_FACTOR=0.1

# Timeout
GATEWAY_TIMEOUT_MS=5000
WEBHOOK_TIMEOUT_MS=10000

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_RESET_MS=60000
CIRCUIT_BREAKER_WINDOW_MS=10000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

---

## API Examples

### 1. Initiate Payment

```bash
curl -X POST http://localhost:3000/payments \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "currency": "USD",
    "customerId": "cust_123",
    "orderId": "order_456",
    "description": "Test payment",
    "idempotencyKey": "unique-key-1"
  }'
```

### 2. Process Payment

```bash
curl -X POST http://localhost:3000/payments/{paymentId}/process
```

### 3. Check Status

```bash
curl http://localhost:3000/payments/{paymentId}
```

### 4. System Health

```bash
curl http://localhost:3000/health
```

### 5. System Metrics

```bash
curl http://localhost:3000/metrics
```

### 6. Simulate Webhook

```bash
curl -X POST http://localhost:3000/webhooks/payment \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "{paymentId}",
    "eventId": "evt_123",
    "status": "SUCCESS",
    "transactionId": "txn_123",
    "timestamp": "2024-01-01T12:00:00Z"
  }'
```

### 7. Configure Gateway (Testing)

```bash
curl -X POST http://localhost:3000/admin/gateway/configure \
  -H "Content-Type: application/json" \
  -d '{
    "failureRate": 0.1,
    "averageDelayMs": 300,
    "timeoutRate": 0.05
  }'
```

---

## Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Suite

```bash
npm test -- payment.test.js
npm test -- concurrency.test.js
npm test -- retry.test.js
npm test -- idempotency.test.js
npm test -- webhook.test.js
```

### Test Coverage

```bash
npm test -- --coverage
```

### Watch Mode

```bash
npm run test:watch
```

---

## Core Concepts

### Idempotency

Prevents duplicate payment processing:

```javascript
// Request 1
POST /payments
{
  "amount": 100,
  "currency": "USD",
  "idempotencyKey": "order_123_payment"
}
// Response: { id: "payment_abc", status: "PENDING" }

// Request 2 (identical)
POST /payments
{
  "amount": 100,
  "currency": "USD",
  "idempotencyKey": "order_123_payment"
}
// Response: { id: "payment_abc", status: "PENDING" } // Same payment!
```

### Concurrency Control

Prevents race conditions:

```
Timeline:
t1: Thread A acquires lock for payment_123 ✓
t2: Thread B tries lock for payment_123 ✗ (fails)
t3: Thread A processes payment
t4: Thread A releases lock
t5: Thread B retries lock ✓
```

### Retry Logic

Intelligent backoff strategy:

```
Attempt 1: Fails immediately
           → Wait 1000ms + jitter
Attempt 2: Fails again
           → Wait 2000ms + jitter
Attempt 3: Fails again
           → Wait 4000ms + jitter
Attempt 4: Max retries reached
           → Payment marked as FAILED
```

### Circuit Breaker

Protects against cascading failures:

```
CLOSED (Normal)
  ↓ (5 failures)
OPEN (Reject all)
  ↓ (60s timeout)
HALF_OPEN (Test recovery)
  ↓ (success)
CLOSED (Recovered)
```

### Webhook Handling

Async updates with duplicate prevention:

```
Gateway sends: { eventId: "evt_123", status: "SUCCESS" }
  ↓
Check if event already processed
  ↓
If yes: Return cached result
If no:  Process and cache
  ↓
Update payment status
```

---

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Initiate Payment | ~1ms | In-memory creation |
| Process Payment (success) | ~500-2000ms | Includes gateway delay |
| Process Payment (with retries) | ~5-10s | Depends on backoff |
| Get Payment Status | ~0.1ms | In-memory lookup |
| Webhook Processing | ~1-5ms | Validation + update |

---

## Error Scenarios Handled

✅ Invalid payment data
✅ Payment not found
✅ Concurrent processing attempt
✅ Gateway timeout
✅ Gateway failure
✅ Partial failures (recovery)
✅ Duplicate webhooks
✅ Invalid webhook status
✅ State transition conflicts
✅ Circuit breaker open
✅ Idempotency key collision handling

---

## Logging

### Log Levels

- **DEBUG**: Detailed concurrency locks
- **INFO**: Payment events, API calls
- **WARN**: Retry attempts, circuit breaker changes
- **ERROR**: Processing failures, exceptions

### Log Output

Console (colored):
```
[2024-01-01 12:00:00] info: Payment Event: INITIATED {paymentId:"...", amount:100}
[2024-01-01 12:00:01] warn: Retry Attempt for Payment {paymentId:"...", attempt:1}
[2024-01-01 12:00:05] info: Payment Event: SUCCESS {paymentId:"...", transactionId:"..."}
```

Files:
- `logs/combined.log` - All logs
- `logs/error.log` - Errors only

---

## Production Roadmap

### Phase 1: Database Integration
- [ ] Replace in-memory Map with PostgreSQL
- [ ] Add database transactions
- [ ] Implement connection pooling

### Phase 2: Distributed Systems
- [ ] Redis-based distributed locks
- [ ] Message queue for retries (RabbitMQ/SQS)
- [ ] Distributed circuit breaker

### Phase 3: Scalability
- [ ] Multi-process clustering
- [ ] Load balancing
- [ ] API gateway integration

### Phase 4: Observability
- [ ] Prometheus metrics export
- [ ] Distributed tracing (Jaeger)
- [ ] Real-time alerting

### Phase 5: Security
- [ ] API key authentication
- [ ] Webhook signature verification
- [ ] Rate limiting per customer
- [ ] Data encryption

---

## Troubleshooting

### Payment stuck in PROCESSING

1. Check active locks: `GET /metrics`
2. Force release lock (recovery): `POST /admin/force-release`
3. Check logs for errors

### Circuit breaker stuck in OPEN

1. Wait 60 seconds for automatic reset
2. Or: Configure lower failure threshold for testing
3. Check gateway configuration: `GET /metrics`

### High retry rate

1. Check gateway configuration: `GET /metrics`
2. Increase success rate: `POST /admin/gateway/configure`
3. Check network latency

### Webhook not being processed

1. Verify eventId is unique
2. Check webhook payload format
3. Verify paymentId exists
4. Check logs for validation errors

---

## Contributing

To add new features:

1. Add tests first
2. Implement feature
3. Update documentation
4. Run full test suite

---

## License

ISC

---

## Support

For issues or questions, check:
- [API Documentation](./API.md)
- [System Design](./DESIGN.md)
- [Test Files](./tests/)
- [Code Comments](./src/)
