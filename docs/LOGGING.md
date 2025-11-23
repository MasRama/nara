# Logging System Documentation

## Overview

Nara menggunakan **Pino** sebagai logging system untuk performa tinggi dan structured logging. Pino adalah logger tercepat untuk Node.js (5x lebih cepat dari Winston) dan sangat cocok untuk aplikasi high-performance seperti Nara.

## Features

- ✅ **Multiple Log Levels**: trace, debug, info, warn, error, fatal
- ✅ **Structured JSON Logging**: Mudah di-parse oleh log aggregators
- ✅ **Pretty Printing**: Development-friendly colored output
- ✅ **Automatic Log Rotation**: Daily rotation dengan retention policy
- ✅ **Sensitive Data Redaction**: Otomatis redact passwords, tokens, dll
- ✅ **Request Tracking**: Log HTTP requests dengan context
- ✅ **Performance Optimized**: Minimal overhead, asynchronous writes

## Configuration

### Environment Variables

Tambahkan ke `.env`:

```env
# Log level: trace, debug, info, warn, error, fatal
LOG_LEVEL=debug

# Node environment
NODE_ENV=development
```

### Log Levels

| Level | Priority | Usage |
|-------|----------|-------|
| `trace` | 10 | Very detailed debugging (jarang digunakan) |
| `debug` | 20 | Debugging information |
| `info` | 30 | General informational messages |
| `warn` | 40 | Warning messages |
| `error` | 50 | Error messages |
| `fatal` | 60 | Fatal errors (application crash) |

**Default:**
- Development: `debug`
- Production: `info`

## Log Files

Logs disimpan di folder `logs/`:

```
logs/
├── app.log              # All logs
├── app.log.2024-01-15   # Rotated daily
├── error.log            # Error logs only
└── error.log.2024-01-15 # Rotated error logs
```

**Rotation Policy:**
- Frequency: Daily
- Max file size: 10MB
- Retention: 14 days (configure di Logger.ts)

## Usage Examples

### Basic Logging

```typescript
import Logger from 'app/services/Logger';

// Info level
Logger.info('User logged in', { userId: '123', email: 'user@example.com' });

// Error level
Logger.error('Database connection failed', new Error('Connection timeout'));

// Warning level
Logger.warn('API rate limit approaching', { currentRate: 95, limit: 100 });

// Debug level (only in development)
Logger.debug('Processing request', { requestId: 'abc-123', data: payload });
```

### Authentication Events

```typescript
// Login success
Logger.logAuth('login_success', {
  userId: user.id,
  email: user.email,
  ip: request.ip
});

// Registration
Logger.logAuth('registration_success', {
  userId: user.id,
  email: user.email,
  ip: request.ip
});

// Password change
Logger.logAuth('password_changed', {
  userId: user.id,
  email: user.email,
  ip: request.ip
});
```

### Security Events

```typescript
// Failed login attempt
Logger.logSecurity('Login failed - invalid password', {
  userId: user.id,
  email: user.email,
  ip: request.ip
});

// Unauthorized access attempt
Logger.logSecurity('Unauthorized delete attempt', {
  userId: request.user.id,
  attemptedIds: ids,
  ip: request.ip
});

// Suspicious activity
Logger.logSecurity('Multiple failed login attempts', {
  email: email,
  attempts: 5,
  ip: request.ip
});
```

### HTTP Requests

```typescript
Logger.logRequest({
  method: 'POST',
  url: '/api/users',
  statusCode: 201,
  responseTime: 45,
  userId: request.user?.id,
  ip: request.ip
});
```

### Database Queries (Development Only)

```typescript
const startTime = Date.now();
const result = await DB.from('users').where('id', userId).first();
const duration = Date.now() - startTime;

Logger.logQuery('SELECT * FROM users WHERE id = ?', duration);
```

### Error Handling

```typescript
try {
  await someOperation();
} catch (error) {
  Logger.error('Operation failed', error);
  // error object automatically serialized with stack trace
}
```

### Child Loggers (with Context)

```typescript
// Create child logger with persistent context
const userLogger = Logger.child({ userId: '123', module: 'UserService' });

userLogger.info('Processing user data');
// Output includes: { userId: '123', module: 'UserService', msg: 'Processing user data' }

userLogger.error('Failed to update profile', error);
// Output includes: { userId: '123', module: 'UserService', err: {...}, msg: 'Failed to update profile' }
```

## Best Practices

### 1. Use Appropriate Log Levels

```typescript
// ❌ Bad
Logger.info('Database query took 2000ms'); // Should be warn or error

// ✅ Good
if (duration > 1000) {
  Logger.warn('Slow database query', { query, duration });
}
```

### 2. Include Context

```typescript
// ❌ Bad
Logger.error('Update failed');

// ✅ Good
Logger.error('User update failed', {
  userId: user.id,
  error: error.message,
  attemptedFields: ['email', 'name']
});
```

### 3. Don't Log Sensitive Data

```typescript
// ❌ Bad
Logger.info('User login', { email, password }); // Password exposed!

// ✅ Good
Logger.info('User login', { email }); // Password automatically redacted
```

**Automatically Redacted Fields:**
- `password`
- `token`
- `authorization`
- `cookie`
- `req.headers.authorization`
- `req.headers.cookie`

### 4. Use Structured Data

```typescript
// ❌ Bad
Logger.info(`User ${userId} updated profile with email ${email}`);

// ✅ Good
Logger.info('User updated profile', { userId, email });
```

### 5. Log at Entry and Exit Points

```typescript
async function processPayment(orderId: string) {
  Logger.info('Processing payment started', { orderId });
  
  try {
    const result = await paymentGateway.charge(orderId);
    Logger.info('Payment processed successfully', { orderId, transactionId: result.id });
    return result;
  } catch (error) {
    Logger.error('Payment processing failed', { orderId, error });
    throw error;
  }
}
```

## Log Format

### Development (Pretty Print)

```
[14:30:45] INFO - User logged in
  userId: "123"
  email: "user@example.com"
  ip: "192.168.1.1"
```

### Production (JSON)

```json
{
  "level": 30,
  "time": "2024-01-15T14:30:45.123Z",
  "pid": 12345,
  "env": "production",
  "msg": "User logged in",
  "userId": "123",
  "email": "user@example.com",
  "ip": "192.168.1.1"
}
```

## Integration with Monitoring Tools

### Datadog

```typescript
// Install datadog transport
npm install pino-datadog

// Update Logger.ts transport
{
  target: 'pino-datadog',
  options: {
    apiKey: process.env.DATADOG_API_KEY,
    service: 'nara-app',
    hostname: process.env.HOSTNAME
  }
}
```

### Elasticsearch

```typescript
// Install elasticsearch transport
npm install pino-elasticsearch

// Update Logger.ts transport
{
  target: 'pino-elasticsearch',
  options: {
    node: process.env.ELASTICSEARCH_URL,
    index: 'nara-logs'
  }
}
```

### CloudWatch

```typescript
// Install cloudwatch transport
npm install pino-cloudwatch

// Update Logger.ts transport
{
  target: 'pino-cloudwatch',
  options: {
    logGroupName: '/aws/nara',
    logStreamName: process.env.HOSTNAME,
    awsRegion: 'ap-southeast-1'
  }
}
```

## Performance Considerations

### Pino vs Winston

| Feature | Pino | Winston |
|---------|------|---------|
| Speed | **5x faster** | Baseline |
| Async | ✅ Yes | ❌ No |
| JSON Output | ✅ Native | ⚠️ Via formatter |
| Memory | Low | Higher |
| CPU Usage | Minimal | Higher |

### Benchmarks

```
Logging 10,000 messages:
- Pino: 45ms
- Winston: 230ms
- Console.log: 180ms
```

### Tips for Production

1. **Set appropriate log level**: Use `info` or `warn` in production
2. **Avoid debug logs in hot paths**: Debug logs add overhead
3. **Use child loggers**: Reuse context instead of passing repeatedly
4. **Monitor log volume**: High log volume can impact performance
5. **Use log sampling**: For high-traffic endpoints, sample logs

## Troubleshooting

### Logs not appearing

1. Check `LOG_LEVEL` environment variable
2. Verify `logs/` directory exists and is writable
3. Check file permissions
4. Ensure logger is imported correctly

### Log files too large

1. Adjust rotation frequency in `Logger.ts`
2. Reduce log level in production
3. Implement log sampling for high-volume endpoints
4. Set up log archival/cleanup

### Performance issues

1. Check log level (avoid `trace` or `debug` in production)
2. Reduce log volume in hot paths
3. Use asynchronous logging (already default in Pino)
4. Consider log sampling

## Migration from console.log

```typescript
// Before
console.log('User logged in:', userId);
console.error('Error:', error);

// After
Logger.info('User logged in', { userId });
Logger.error('Operation failed', error);
```

## Examples from Codebase

See these files for real-world examples:

- `server.ts` - Server startup, shutdown, error handling
- `app/controllers/AuthController.ts` - Authentication events, security logging
- `app/services/Logger.ts` - Logger implementation and configuration

## Additional Resources

- [Pino Documentation](https://getpino.io/)
- [Pino Best Practices](https://getpino.io/#/docs/best-practices)
- [Structured Logging Guide](https://www.honeycomb.io/blog/structured-logging-and-your-team)

## Support

For questions or issues with logging:
1. Check this documentation
2. Review `app/services/Logger.ts` implementation
3. Consult Pino documentation
4. Open an issue in the project repository
