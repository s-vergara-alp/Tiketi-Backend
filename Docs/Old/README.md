# Tiikii Festival Backend

A comprehensive backend system for festival ticket management, built with Node.js, Express, and SQLite. This system provides complete ticket distribution, purchasing, validation, and management capabilities with proper API standards and programming patterns.

## Features

- **Ticket Management**: Purchase, transfer, cancel, and validate tickets
- **Payment Processing**: Integrated payment system with transaction tracking
- **QR Code Generation**: Unique QR codes for ticket validation
- **User Management**: User authentication and authorization
- **Festival Management**: Multi-festival support with templates
- **Real-time Updates**: WebSocket support for live updates
- **Comprehensive Testing**: Unit, integration, and performance tests
- **Security**: Rate limiting, input validation, and error handling

## Architecture

### Design Patterns

- **Service Layer Pattern**: Business logic separated into service classes
- **Repository Pattern**: Database operations abstracted through database layer
- **Middleware Pattern**: Request processing through middleware chain
- **Error Handling Pattern**: Centralized error handling with custom error classes
- **Transaction Pattern**: Database transactions for data consistency

### Project Structure

```
src/
├── database/
│   ├── database.js          # Database connection and operations
│   ├── schema.sql           # Database schema
│   ├── migrate.js           # Database migration
│   └── seed.js              # Seed data
├── middleware/
│   ├── auth.js              # Authentication middleware
│   └── errorHandler.js      # Error handling middleware
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── tickets.js           # Ticket management routes
│   ├── festivals.js         # Festival management routes
│   └── ...                  # Other route modules
├── services/
│   ├── TicketService.js     # Ticket business logic
│   └── PaymentService.js    # Payment processing logic
├── utils/
│   └── errors.js            # Custom error classes
├── socket/
│   └── handlers.js          # WebSocket event handlers
└── index.js                 # Main application entry point
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

### Tickets

- `GET /api/tickets` - Get user's tickets
- `GET /api/tickets/:id` - Get specific ticket
- `POST /api/tickets/purchase` - Purchase ticket with payment
- `POST /api/tickets/validate/:qrPayload` - Validate ticket for entry
- `GET /api/tickets/templates/:festivalId` - Get ticket templates
- `POST /api/tickets/:id/transfer` - Transfer ticket
- `POST /api/tickets/:id/cancel` - Cancel ticket

### Payments

- `GET /api/tickets/payments/history` - Get payment history
- `GET /api/tickets/payments/:paymentId` - Get specific payment
- `POST /api/tickets/payments/:paymentId/refund` - Refund payment

### Festivals

- `GET /api/festivals` - Get all festivals
- `GET /api/festivals/:id` - Get specific festival
- `POST /api/festivals` - Create festival (admin)
- `PUT /api/festivals/:id` - Update festival (admin)
- `DELETE /api/festivals/:id` - Delete festival (admin)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Tiikii/@Test/server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize database**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Start the server**
   ```bash
   npm run dev    # Development mode
   npm start      # Production mode
   ```

## Environment Variables

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
DB_PATH=./database/tiikii_festival.db

# JWT Configuration
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=24h

# Client URLs (for CORS)
CLIENT_URL=http://localhost:3000

# Payment Gateway (for production)
PAYMENT_GATEWAY_API_KEY=your-payment-gateway-key
PAYMENT_GATEWAY_SECRET=your-payment-gateway-secret
```

## Database Schema

The system uses SQLite with the following main tables:

- **users**: User accounts and profiles
- **festivals**: Festival information and settings
- **ticket_templates**: Ticket types and pricing
- **tickets**: Individual ticket instances
- **payments**: Payment transactions
- **refunds**: Refund records
- **chat_rooms**: Chat functionality
- **widgets**: Festival widgets and features

## Usage Examples

### Purchase a Ticket

```javascript
const response = await fetch('/api/tickets/purchase', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    festivalId: 'festival-123',
    templateId: 'template-456',
    holderName: 'John Doe',
    paymentMethod: {
      type: 'card',
      token: 'payment-token'
    },
    amount: 99.99,
    currency: 'USD'
  })
});

const result = await response.json();
console.log('Ticket purchased:', result.ticket);
```

### Validate a Ticket

```javascript
const response = await fetch(`/api/tickets/validate/${qrPayload}`, {
  method: 'POST'
});

const result = await response.json();
if (result.valid) {
  console.log('Ticket is valid for entry');
} else {
  console.log('Ticket validation failed:', result.message);
}
```

### Get User Tickets

```javascript
const response = await fetch('/api/tickets', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const tickets = await response.json();
console.log('User tickets:', tickets);
```

## Testing

The project includes comprehensive test suites:

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Performance tests
npm run test:performance
```

### Test Coverage
```bash
npm run test:coverage
```

## Security Features

- **Rate Limiting**: Prevents abuse with configurable limits
- **Input Validation**: Comprehensive validation using express-validator
- **SQL Injection Protection**: Parameterized queries
- **CORS Configuration**: Secure cross-origin requests
- **Helmet**: Security headers
- **JWT Authentication**: Secure token-based authentication
- **Error Handling**: No sensitive information leakage

## Performance Features

- **Database Indexing**: Optimized queries with proper indexes
- **Connection Pooling**: Efficient database connections
- **Caching**: Response caching for frequently accessed data
- **Compression**: Response compression for faster transfers
- **Async Operations**: Non-blocking I/O operations

## Error Handling

The system implements a comprehensive error handling strategy:

- **Custom Error Classes**: Specific error types for different scenarios
- **Centralized Error Handler**: Consistent error responses
- **Validation Errors**: Detailed validation feedback
- **Business Logic Errors**: Clear business rule violations
- **Database Errors**: Safe database error handling

## API Standards

- **RESTful Design**: Follows REST principles
- **Consistent Response Format**: Standardized JSON responses
- **HTTP Status Codes**: Proper status code usage
- **Pagination**: Support for large result sets
- **Filtering**: Query parameter filtering
- **Sorting**: Configurable result ordering

## Development

### Code Style

- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **JSDoc**: Comprehensive documentation
- **TypeScript-like**: JSDoc type annotations

### Development Workflow

1. **Feature Development**: Create feature branches
2. **Testing**: Write tests for new features
3. **Code Review**: Peer review process
4. **Integration**: Merge to main branch
5. **Deployment**: Automated deployment pipeline

## Deployment

### Production Setup

1. **Environment Configuration**
   ```bash
   NODE_ENV=production
   PORT=3001
   JWT_SECRET=strong-production-secret
   ```

2. **Database Setup**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

3. **Process Management**
   ```bash
   # Using PM2
   pm2 start ecosystem.config.js
   
   # Using Docker
   docker-compose up -d
   ```

### Monitoring

- **Health Checks**: `/health` endpoint
- **Logging**: Winston logging with different levels
- **Metrics**: Performance monitoring
- **Error Tracking**: Error reporting and alerting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## Changelog

### Version 1.0.0
- Initial release
- Complete ticket management system
- Payment processing integration
- Comprehensive test suite
- Security and performance optimizations
