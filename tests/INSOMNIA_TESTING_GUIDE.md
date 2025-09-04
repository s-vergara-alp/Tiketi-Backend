# Insomnia Testing Guide for Tiikii Festival API

This guide explains how to set up and use Insomnia for testing the Tiikii Festival API with the complete OpenAPI specification.

## Prerequisites

1. **Insomnia Desktop App**: Download and install from [insomnia.rest](https://insomnia.rest/download)
2. **Tiikii Server**: Ensure the server is running on `http://localhost:3000`
3. **Test Data**: The server should have seeded test data

## Setup Instructions

### 1. Import OpenAPI Specification

1. Open Insomnia
2. Click **Create** → **Import From** → **File**
3. Select the `openapi.yaml` file from the tests directory
4. This will automatically generate all API endpoints with proper schemas

### 2. Import Testing Configuration

1. In Insomnia, go to **Application** → **Preferences** → **Data** → **Import Data**
2. Select the `insomnia-testing-config.json` file
3. This will create a complete testing workspace with:
   - Pre-configured requests
   - Environment variables
   - Test suites
   - Authentication flow

### 3. Environment Configuration

The testing configuration includes two environments:

#### Base Environment (Development)
- **Base URL**: `http://localhost:3000`
- **Test Credentials**: Pre-configured test user data
- **Test IDs**: Sample festival, template, and artist IDs

#### Production Environment
- **Base URL**: `https://api.tiikii.com`
- **Production Credentials**: For production testing
- **Production IDs**: Real production data IDs

## Testing Workflows

### 1. Authentication Flow

1. **Register User** → Creates a new test user
2. **Login** → Authenticates and stores JWT token
3. **Get Profile** → Validates authentication

The login response automatically extracts and stores the JWT token for subsequent requests.

### 2. Festival Management

1. **List Festivals** → Gets all active festivals
2. **Get Festival** → Retrieves specific festival details
3. **Festival Stats** → Gets festival statistics
4. **Festival Map** → Retrieves map data

### 3. Ticket Operations

1. **List User Tickets** → Gets user's tickets (requires auth)
2. **Purchase Ticket** → Processes ticket purchase
3. **Transfer Ticket** → Transfers ticket ownership
4. **Cancel Ticket** → Cancels a ticket

### 4. Artist Management

1. **List Artists** → Gets all artists with optional filters
2. **Get Artist** → Retrieves artist details
3. **Search Artists** → Searches by name, bio, or genre
4. **Artist Stats** → Gets artist statistics

### 5. Chat System

1. **List Chat Rooms** → Gets user's chat rooms
2. **Get Room Messages** → Retrieves chat messages
3. **Send Message** → Sends a new message
4. **Create Private Room** → Creates private chat

### 6. Mesh Network

1. **List Mesh Peers** → Gets mesh network peers
2. **Register Peer** → Registers/updates peer info
3. **Send Mesh Message** → Sends mesh network message
4. **Get Peer Messages** → Retrieves peer messages

## Test Suites

### Authentication Tests
- Tests user registration, login, and profile retrieval
- Automatically handles token extraction and storage
- Validates response structures

### Festival Tests
- Tests festival listing and retrieval
- Validates festival data structure
- Sets up test festival IDs for other tests

### Integration Tests
- End-to-end workflow testing
- Tests complete user journey
- Validates API consistency

## Environment Variables

The testing configuration includes these environment variables:

```javascript
{
  "base_url": "http://localhost:3000",
  "test_email": "test@example.com",
  "test_password": "password123",
  "test_username": "testuser",
  "test_first_name": "Test",
  "test_last_name": "User",
  "test_festival_id": "test-festival-base",
  "test_template_id": "test-template-base",
  "test_artist_id": "test-artist-001",
  "test_room_id": "test-room-001",
  "test_peer_id": "test-peer-001",
  "auth_token": "" // Auto-populated after login
}
```

## Running Tests

### Individual Request Testing
1. Select any request from the workspace
2. Click **Send** to execute
3. View response in the response panel
4. Check console for any test script output

### Test Suite Execution
1. Go to **Test** tab in Insomnia
2. Select a test suite (e.g., "Authentication Tests")
3. Click **Run Tests**
4. View results in the test results panel

### Automated Testing
1. Use the **Integration Tests** suite for complete workflows
2. Tests run in sequence with proper data flow
3. Each test validates the previous test's output

## Response Validation

The test suites include automatic response validation:

```javascript
// Example validation script
if (insomnia.response.status >= 200 && insomnia.response.status < 300) {
  console.log(`✅ ${requestName}: ${status}`);
} else {
  console.log(`❌ ${requestName}: ${status}`);
}
```

## Debugging

### Console Output
- All test scripts log to the Insomnia console
- Check console for authentication token extraction
- Monitor test execution flow

### Response Inspection
- Use Insomnia's response viewer to inspect JSON structure
- Validate against OpenAPI schema definitions
- Check for proper error handling

### Environment Variables
- Monitor environment variable changes during test execution
- Verify token storage and usage
- Check test data propagation

## Advanced Features

### Custom Test Scripts
Add custom validation scripts to any request:

```javascript
// Before request
insomnia.environment.set('custom_var', 'value');

// After response
const response = JSON.parse(insomnia.response.body);
if (response.success) {
  console.log('Request successful');
}
```

### Dynamic Data Generation
Generate unique test data for each run:

```javascript
const timestamp = Date.now();
insomnia.environment.set('test_username', `user_${timestamp}`);
```

### Conditional Logic
Implement conditional test execution:

```javascript
if (insomnia.environment.get('auth_token')) {
  // Run authenticated tests
} else {
  // Run public tests only
}
```

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Ensure server is running
   - Check test credentials in environment
   - Verify JWT token extraction

2. **Missing Test Data**
   - Run server setup scripts
   - Check database seeding
   - Verify test IDs in environment

3. **Network Errors**
   - Confirm server URL in environment
   - Check server port configuration
   - Verify firewall settings

### Server Requirements

Ensure your server has:
- All routes properly implemented
- Test data seeded in database
- CORS configured for Insomnia
- Proper error handling

## Best Practices

1. **Test Isolation**: Use unique test data for each test run
2. **Cleanup**: Implement cleanup scripts for test data
3. **Validation**: Always validate response structure and status codes
4. **Documentation**: Keep test descriptions up to date
5. **Environment Management**: Use separate environments for different stages

## Integration with CI/CD

The OpenAPI specification and test configuration can be integrated into CI/CD pipelines:

1. **API Validation**: Use tools like `swagger-codegen` or `openapi-generator`
2. **Contract Testing**: Implement contract testing with tools like Pact
3. **Load Testing**: Use Insomnia's test suites with load testing tools
4. **Automated Testing**: Export test results for automated validation

## Support

For issues with:
- **OpenAPI Specification**: Check the `openapi.yaml` file
- **Test Configuration**: Review `insomnia-testing-config.json`
- **Server Implementation**: Check server route files
- **Database Setup**: Verify test data seeding scripts
