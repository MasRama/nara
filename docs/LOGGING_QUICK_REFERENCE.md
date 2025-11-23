# Logging Quick Reference

## Import

```typescript
import Logger from 'app/services/Logger';
```

## Basic Usage

```typescript
// Info
Logger.info('Message', { key: 'value' });

// Error
Logger.error('Error message', error);

// Warning
Logger.warn('Warning message', { data });

// Debug (development only)
Logger.debug('Debug info', { details });
```

## Common Patterns

### Authentication
```typescript
Logger.logAuth('login_success', { userId, email, ip });
Logger.logAuth('registration_success', { userId, email, ip });
Logger.logAuth('password_changed', { userId, email, ip });
```

### Security
```typescript
Logger.logSecurity('Login failed - invalid password', { userId, ip });
Logger.logSecurity('Unauthorized access attempt', { userId, resource, ip });
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

### Database
```typescript
Logger.logQuery('SELECT * FROM users WHERE id = ?', duration);
```

## Log Levels

| Level | When to Use |
|-------|-------------|
| `trace` | Very detailed debugging |
| `debug` | Development debugging |
| `info` | General information |
| `warn` | Warnings, potential issues |
| `error` | Errors that need attention |
| `fatal` | Critical errors, app crash |

## Environment Variables

```env
LOG_LEVEL=debug  # trace, debug, info, warn, error, fatal
NODE_ENV=development
```

## Log Files

- `logs/app.log` - All logs
- `logs/error.log` - Errors only
- Rotated daily, max 10MB per file

## Auto-Redacted Fields

- `password`
- `token`
- `authorization`
- `cookie`

## Best Practices

✅ **DO:**
- Include context: `{ userId, action, ip }`
- Use appropriate log levels
- Log at entry/exit points
- Use structured data

❌ **DON'T:**
- Log sensitive data (passwords, tokens)
- Use string concatenation
- Log in tight loops (use sampling)
- Use `console.log` (use Logger instead)

## Quick Examples

```typescript
// Controller method
async function createUser(request, response) {
  Logger.info('Creating user', { email: request.body.email });
  
  try {
    const user = await DB.table('users').insert(data);
    Logger.info('User created successfully', { userId: user.id });
    return response.json(user);
  } catch (error) {
    Logger.error('User creation failed', error);
    return response.status(500).json({ error: 'Failed to create user' });
  }
}

// Service method
async function processPayment(orderId) {
  const logger = Logger.child({ orderId, service: 'PaymentService' });
  
  logger.info('Processing payment');
  
  try {
    const result = await gateway.charge(orderId);
    logger.info('Payment successful', { transactionId: result.id });
    return result;
  } catch (error) {
    logger.error('Payment failed', error);
    throw error;
  }
}
```
