# Tiikii Festival API - Security Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing enterprise-grade security features in the Tiikii Festival API, based on industry standards from Spotify, Ticketmaster, and other leading platforms.

## Current Security Status

### ✅ Implemented Features
- Basic JWT authentication
- Helmet.js security headers
- CORS configuration
- Basic rate limiting
- Input validation with express-validator
- Custom error handling
- SQL injection prevention

### 🔧 Enhanced Features Added
- Multi-tier rate limiting
- Speed limiting with progressive delays
- Request ID tracking
- Enhanced security headers
- Input sanitization
- API versioning
- Request size limiting
- Enhanced logging

## Implementation Steps

### Step 1: Enhanced Security Middleware

The enhanced security middleware has been created in `src/middleware/security.js` with the following features:

#### Rate Limiting Configuration
```javascript
// General API: 50 requests per 15 minutes
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    keyGenerator: (req) => req.user?.id || req.ip,
    skip: (req) => req.path === '/health'
});

// Authentication: 5 attempts per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.ip
});
```

#### Speed Limiting
```javascript
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 25,
    delayMs: 500,
    maxDelayMs: 20000
});
```

#### Security Headers
```javascript
const securityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
};
```

### Step 2: API Versioning

Implement API versioning to ensure backward compatibility:

```javascript
// Versioned routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/festivals', festivalRoutes);

// Legacy route support
app.use('/api/auth', (req, res) => {
    res.redirect(301, `/api/v1${req.path}`);
});
```

### Step 3: Request Tracking

Implement request ID tracking for monitoring and debugging:

```javascript
const requestId = (req, res, next) => {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
};
```

### Step 4: Input Sanitization

Add comprehensive input sanitization:

```javascript
const sanitizeInput = (req, res, next) => {
    // Sanitize query parameters
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = req.query[key].trim();
            }
        });
    }

    // Sanitize body parameters
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key].trim();
            }
        });
    }

    next();
};
```

### Step 5: Enhanced Logging

Implement structured logging with security considerations:

```javascript
const enhancedLogging = (req, res, next) => {
    const start = Date.now();
    
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.id} - ${req.ip}`);
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${req.id}`);
    });
    
    next();
};
```

## Deployment Configuration

### Environment Variables

Create a `.env` file with the following security-related variables:

```env
# Security Configuration
NODE_ENV=production
JWT_SECRET=your-super-secure-jwt-secret-key-here
CLIENT_URL=https://your-frontend-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=50
AUTH_RATE_LIMIT_MAX=5

# CORS
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com

# Database
DATABASE_URL=your-database-connection-string
DATABASE_POOL_SIZE=10

# Monitoring
LOG_LEVEL=info
ENABLE_SECURITY_LOGGING=true
```

### Production Security Checklist

1. **Environment Variables**
   - [ ] Set strong JWT_SECRET
   - [ ] Configure CLIENT_URL
   - [ ] Set NODE_ENV=production
   - [ ] Use secure database credentials

2. **HTTPS Configuration**
   - [ ] Enable HTTPS in production
   - [ ] Configure SSL/TLS certificates
   - [ ] Set up HSTS headers
   - [ ] Redirect HTTP to HTTPS

3. **Database Security**
   - [ ] Use connection pooling
   - [ ] Enable query logging
   - [ ] Set up database backups
   - [ ] Configure database firewall

4. **Monitoring & Alerting**
   - [ ] Set up security event monitoring
   - [ ] Configure rate limit alerts
   - [ ] Monitor failed authentication attempts
   - [ ] Set up error tracking

## Security Testing

### Automated Security Tests

Run the comprehensive security test suite:

```bash
# Run all security tests
npm test -- tests/security.test.js

# Run specific security test categories
npm test -- tests/security.test.js --testNamePattern="Rate Limiting"
npm test -- tests/security.test.js --testNamePattern="Authentication"
```

### Manual Security Testing

1. **Rate Limiting Tests**
   ```bash
   # Test general rate limiting
   for i in {1..60}; do curl -X GET http://localhost:3001/api/v1/festivals; done
   
   # Test authentication rate limiting
   for i in {1..10}; do curl -X POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"wrong"}'; done
   ```

2. **Security Headers Test**
   ```bash
   curl -I http://localhost:3001/api/v1/festivals
   ```

3. **CORS Test**
   ```bash
   curl -H "Origin: https://malicious-site.com" -X GET http://localhost:3001/api/v1/festivals
   ```

## Monitoring & Alerting

### Security Metrics to Monitor

1. **Rate Limiting Metrics**
   - Number of rate limit violations
   - IP addresses hitting rate limits
   - Endpoints most frequently rate limited

2. **Authentication Metrics**
   - Failed login attempts
   - Invalid token attempts
   - Account lockouts

3. **Request Metrics**
   - Request volume by endpoint
   - Response times
   - Error rates

4. **Security Events**
   - Suspicious IP addresses
   - Unusual request patterns
   - Failed security validations

### Alerting Configuration

Set up alerts for the following events:

```javascript
// Example alerting configuration
const securityAlerts = {
    rateLimitExceeded: {
        threshold: 10,
        timeWindow: '5 minutes',
        action: 'blockIP'
    },
    failedLogins: {
        threshold: 5,
        timeWindow: '15 minutes',
        action: 'notifyAdmin'
    },
    suspiciousActivity: {
        threshold: 1,
        timeWindow: '1 minute',
        action: 'investigate'
    }
};
```

## Incident Response

### Security Incident Response Plan

1. **Detection**
   - Monitor security logs
   - Review rate limiting alerts
   - Check for unusual patterns

2. **Assessment**
   - Determine incident severity
   - Identify affected systems
   - Assess potential impact

3. **Response**
   - Block malicious IP addresses
   - Reset compromised accounts
   - Update security configurations

4. **Recovery**
   - Restore normal operations
   - Update security measures
   - Document lessons learned

## Compliance Considerations

### GDPR Compliance

1. **Data Protection**
   - Implement data encryption
   - Set up data retention policies
   - Provide data portability

2. **User Rights**
   - Right to be forgotten
   - Right to data access
   - Right to rectification

### PCI DSS Compliance (for payments)

1. **Data Security**
   - Encrypt payment data
   - Secure payment processing
   - Regular security assessments

2. **Access Control**
   - Restrict payment data access
   - Implement strong authentication
   - Monitor access logs

## Maintenance & Updates

### Regular Security Tasks

1. **Weekly**
   - Review security logs
   - Update security configurations
   - Monitor for new threats

2. **Monthly**
   - Update dependencies
   - Review access controls
   - Conduct security assessments

3. **Quarterly**
   - Penetration testing
   - Security policy review
   - Incident response drills

### Security Updates

1. **Dependency Updates**
   ```bash
   # Check for security vulnerabilities
   npm audit
   
   # Update dependencies
   npm update
   
   # Fix security issues
   npm audit fix
   ```

2. **Configuration Updates**
   - Review and update rate limits
   - Update CORS policies
   - Refresh security headers

## Conclusion

This enhanced security implementation brings the Tiikii Festival API up to industry standards. The combination of multi-tier rate limiting, comprehensive input validation, request tracking, and enhanced monitoring provides robust protection against common attack vectors.

### Key Benefits

1. **Protection Against Abuse**: Multi-tier rate limiting prevents API abuse
2. **Request Tracking**: Request ID tracking enables better monitoring and debugging
3. **Input Security**: Comprehensive sanitization prevents injection attacks
4. **API Stability**: Versioning ensures backward compatibility
5. **Monitoring**: Enhanced logging provides visibility into security events

### Next Steps

1. Deploy the enhanced security middleware
2. Set up monitoring and alerting
3. Conduct security testing
4. Establish incident response procedures
5. Regular security reviews and updates

For additional security guidance, refer to:
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practices-security.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

