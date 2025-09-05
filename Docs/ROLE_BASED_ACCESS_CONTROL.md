# Role-Based Access Control (RBAC) - Tiikii Festival

## Overview

The Tiikii Festival backend now implements a comprehensive Role-Based Access Control (RBAC) system that provides fine-grained permissions for different types of users and operations. This system ensures that only authorized personnel can access sensitive endpoints and perform critical operations.

## User Roles

### Role Hierarchy

The system implements a hierarchical role structure where higher roles inherit permissions from lower roles:

```
admin > staff > security > user
```

### Role Definitions

#### 1. **User** (Default Role)
- **Description**: Regular festival attendees
- **Permissions**:
  - View public festival information
  - Purchase tickets
  - Access personal account information
  - Use chat functionality
  - Access mesh network features

#### 2. **Security**
- **Description**: Security personnel responsible for access control
- **Permissions**: All user permissions plus:
  - Validate QR codes for entry
  - Validate room access codes
  - Access security-related endpoints

#### 3. **Staff**
- **Description**: Festival staff members
- **Permissions**: All security permissions plus:
  - Access ticket templates
  - Create and manage estadias (accommodations)
  - Update estadia status
  - Access staff-only endpoints

#### 4. **Admin**
- **Description**: System administrators
- **Permissions**: All staff permissions plus:
  - Full system access
  - User management
  - System configuration
  - All administrative functions

## Database Schema

### User Table Updates

The `users` table has been extended with role-related columns:

```sql
-- Role-based access control columns
is_admin BOOLEAN DEFAULT 0,
is_staff BOOLEAN DEFAULT 0,
is_security BOOLEAN DEFAULT 0,
role TEXT DEFAULT 'user' -- 'user', 'staff', 'security', 'admin'
```

### Migration

A migration script (`src/database/migrate_roles.js`) has been created to:
- Add role columns to existing users table
- Create a default admin user if none exists
- Ensure backward compatibility

## Middleware Implementation

### Authentication Middleware

The system includes several middleware functions for role-based access control:

#### `authenticateToken`
- **Purpose**: Basic JWT token verification
- **Usage**: Required for all protected endpoints
- **Returns**: User object with role information in `req.user`

#### `requireVerified`
- **Purpose**: Ensures user has verified their email
- **Usage**: For endpoints requiring email verification
- **Error**: Returns 401 if user is not verified

#### `requireAdmin`
- **Purpose**: Restricts access to admin users only
- **Usage**: For administrative endpoints
- **Error**: Returns 401 if user is not admin

#### `requireStaff`
- **Purpose**: Restricts access to staff and admin users
- **Usage**: For staff-only endpoints
- **Error**: Returns 401 if user is not staff or admin

#### `requireSecurity`
- **Purpose**: Restricts access to security, staff, and admin users
- **Usage**: For security-related endpoints
- **Error**: Returns 401 if user lacks security privileges

#### `requireElevated`
- **Purpose**: Restricts access to any elevated role (security, staff, admin)
- **Usage**: For endpoints requiring elevated privileges
- **Error**: Returns 401 if user has no elevated privileges

## Protected Endpoints

### Security-Protected Endpoints

These endpoints require security personnel or higher:

#### QR Code Validation
```
POST /api/tickets/validate/:qrPayload
```
- **Purpose**: Validate QR codes for festival entry
- **Access**: Security, Staff, Admin
- **Security Impact**: Critical - prevents unauthorized entry

#### Room Access Validation
```
POST /api/mesh/estadias/access/validate
```
- **Purpose**: Validate access codes for room entry
- **Access**: Security, Staff, Admin
- **Security Impact**: Critical - controls accommodation access

### Staff-Protected Endpoints

These endpoints require staff privileges or higher:

#### Ticket Templates
```
GET /api/tickets/templates/:festivalId
```
- **Purpose**: Access detailed ticket template information
- **Access**: Staff, Admin
- **Business Impact**: Contains sensitive pricing and availability data

#### Estadia Management
```
POST /api/mesh/estadias
PUT /api/mesh/estadias/:id/status
```
- **Purpose**: Create and manage accommodations
- **Access**: Staff, Admin
- **Business Impact**: Controls accommodation allocation

## Implementation Examples

### Adding Role Protection to Routes

```javascript
const { requireSecurity, requireStaff } = require('../middleware/auth');

// Security-only endpoint
router.post('/validate/:qrPayload', requireSecurity, asyncHandler(async (req, res) => {
    // Only security personnel can validate QR codes
    const validationResult = await ticketService.validateTicket(qrPayload);
    res.json(validationResult);
}));

// Staff-only endpoint
router.get('/templates/:festivalId', requireStaff, asyncHandler(async (req, res) => {
    // Only staff can access ticket templates
    const templates = await ticketService.getTicketTemplates(festivalId);
    res.json(templates);
}));
```

### Checking User Roles in Code

```javascript
// In route handlers
if (req.user.is_admin) {
    // Admin-specific logic
} else if (req.user.is_staff) {
    // Staff-specific logic
} else if (req.user.is_security) {
    // Security-specific logic
} else {
    // Regular user logic
}

// Using role field
switch (req.user.role) {
    case 'admin':
        // Admin logic
        break;
    case 'staff':
        // Staff logic
        break;
    case 'security':
        // Security logic
        break;
    default:
        // User logic
}
```

## Security Considerations

### 1. **Principle of Least Privilege**
- Users are granted the minimum permissions necessary for their role
- Role hierarchy ensures proper permission inheritance
- Sensitive operations require explicit role verification

### 2. **Token Security**
- JWT tokens include role information
- Tokens are validated on every request
- Role changes require token refresh

### 3. **Database Security**
- Role information is stored securely in the database
- Role changes are logged and auditable
- Default users have minimal privileges

### 4. **Endpoint Protection**
- All sensitive endpoints are protected by appropriate middleware
- Role checks are performed before business logic execution
- Consistent error messages prevent information leakage

## Testing

### Test User Creation

The test suite includes utilities for creating users with specific roles:

```javascript
// Create test user with specific role
const testUser = generateTestUser('test-id', 'staff');

// Test user with admin privileges
const adminUser = generateTestUser('admin-id', 'admin');
```

### Role-Based Test Scenarios

Tests verify that:
- Users can only access endpoints appropriate to their role
- Role restrictions are properly enforced
- Error messages are consistent and secure
- Role inheritance works correctly

## Migration and Deployment

### Database Migration

1. **Run the migration script**:
   ```bash
   node src/database/migrate_roles.js
   ```

2. **Verify migration**:
   - Check that role columns exist in users table
   - Verify default admin user was created
   - Test role-based access control

### Production Deployment

1. **Update existing users**:
   - Assign appropriate roles to existing users
   - Ensure at least one admin user exists
   - Review and update user permissions

2. **Monitor access patterns**:
   - Log role-based access attempts
   - Monitor for unauthorized access attempts
   - Review role assignments regularly

## API Documentation Updates

### OpenAPI Specification

The OpenAPI specification has been updated to include:
- Role requirements for each endpoint
- Security schemes for different role levels
- Example requests with proper authorization headers

### Endpoint Documentation

Each protected endpoint now includes:
- Required role level
- Security implications
- Access restrictions
- Example usage

## Future Enhancements

### Planned Features

1. **Dynamic Role Assignment**:
   - Admin interface for role management
   - Temporary role assignments
   - Role expiration and renewal

2. **Granular Permissions**:
   - Permission-based access control
   - Custom permission sets
   - Resource-specific permissions

3. **Audit Logging**:
   - Comprehensive access logging
   - Role change tracking
   - Security event monitoring

4. **Role Templates**:
   - Predefined role templates
   - Festival-specific roles
   - Custom role creation

## Troubleshooting

### Common Issues

1. **"Staff access required" errors**:
   - Verify user has appropriate role
   - Check token includes role information
   - Ensure middleware is properly applied

2. **Role not recognized**:
   - Verify database migration completed
   - Check user record has role fields
   - Confirm token includes updated user data

3. **Permission denied**:
   - Review role hierarchy
   - Check endpoint protection level
   - Verify user role assignment

### Debug Commands

```javascript
// Check user role in database
const user = await database.get('SELECT * FROM users WHERE id = ?', [userId]);
console.log('User role:', user.role);
console.log('Is admin:', user.is_admin);
console.log('Is staff:', user.is_staff);
console.log('Is security:', user.is_security);
```

## Conclusion

The Role-Based Access Control system provides a robust, scalable, and secure foundation for managing user permissions in the Tiikii Festival backend. By implementing hierarchical roles and comprehensive middleware protection, the system ensures that sensitive operations are only accessible to authorized personnel while maintaining flexibility for future enhancements.

The system is designed with security best practices in mind, including the principle of least privilege, comprehensive testing, and detailed audit capabilities. This foundation will support the growing needs of the festival management system while maintaining the highest standards of security and reliability.
