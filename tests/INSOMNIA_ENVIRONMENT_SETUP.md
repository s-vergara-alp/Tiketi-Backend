# Insomnia Environment Setup Guide

This guide explains how to properly set up and use the comprehensive environment variables in Insomnia for testing the Tiikii Festival API.

## Environment Variables Overview

The Insomnia configuration now includes **150+ environment variables** organized into logical categories:

### 🔧 **Core API Configuration**
- `base_url` - API base URL (http://localhost:3000, https://api.tiikii.com, etc.)
- `api_version` - API version (v1)
- `content_type` - Request content type (application/json)
- `accept` - Accept header (application/json)
- `user_agent` - User agent string

### 👤 **User Authentication & Profile**
- `test_email` - Test user email
- `test_password` - Test user password
- `test_username` - Test username
- `test_first_name` - User first name
- `test_last_name` - User last name
- `test_phone` - User phone number
- `test_date_of_birth` - User date of birth
- `auth_token` - JWT authentication token (auto-populated)
- `refresh_token` - Refresh token
- `user_id` - User ID (auto-populated)

### 🎪 **Festival & Event Data**
- `test_festival_id` - Festival ID
- `test_festival_name` - Festival name
- `test_template_id` - Ticket template ID
- `test_template_name` - Ticket template name
- `test_start_date` - Festival start date
- `test_end_date` - Festival end date
- `test_venue` - Festival venue
- `test_logo` - Festival logo URL

### 🎵 **Artist & Performance Data**
- `test_artist_id` - Artist ID
- `test_artist_name` - Artist name
- `test_stage_id` - Stage ID
- `test_stage_name` - Stage name
- `test_genre` - Music genre
- `test_bio` - Artist biography
- `test_image_url` - Artist image URL
- `test_social_media` - Social media links (JSON)

### 🎫 **Ticket & Payment Data**
- `test_ticket_id` - Ticket ID
- `test_payment_id` - Payment ID
- `test_amount` - Payment amount
- `test_currency` - Currency (USD)
- `test_holder_name` - Ticket holder name
- `test_payment_method` - Payment method
- `test_payment_token` - Payment token
- `test_qr_payload` - QR code payload

### 💬 **Chat & Messaging**
- `test_room_id` - Chat room ID
- `test_room_name` - Chat room name
- `test_message_id` - Message ID
- `test_participant_id` - Chat participant ID
- `test_message_content` - Message content
- `test_message_text` - Message text

### 🌐 **Mesh Network**
- `test_peer_id` - Mesh peer ID
- `test_peer_nickname` - Peer nickname
- `test_noise_public_key` - Noise protocol public key
- `test_signing_public_key` - Signing public key
- `test_estadia_id` - Estadia ID
- `test_room_access_code` - Room access code

### 📍 **Location & Geography**
- `test_latitude` - Latitude coordinate
- `test_longitude` - Longitude coordinate
- `test_radius` - Search radius
- `test_vendor_id` - Vendor ID
- `test_vendor_name` - Vendor name
- `test_poi_id` - Point of interest ID
- `test_poi_name` - Point of interest name

### 🔔 **Notifications & Activity**
- `test_notification_id` - Notification ID
- `test_message_count` - Message count
- `test_unread_count` - Unread count
- `test_performance_count` - Performance count

### 🎨 **UI & Styling**
- `test_primary_color` - Primary color
- `test_secondary_color` - Secondary color
- `test_accent_color` - Accent color
- `test_background_color` - Background color
- `test_decoration_icons` - Decoration icons (JSON array)

### 📊 **Pagination & Filtering**
- `test_limit` - Results limit
- `test_offset` - Results offset
- `test_page` - Page number
- `test_page_size` - Page size
- `test_sort` - Sort field
- `test_order` - Sort order (asc/desc)
- `test_filter` - Filter value
- `test_search` - Search query

### 📁 **File & Media**
- `test_file_path` - File path
- `test_file_name` - File name
- `test_file_size` - File size
- `test_file_type` - File MIME type
- `test_file_content` - Base64 file content
- `test_avatar` - Avatar URL

### 🔗 **URLs & Webhooks**
- `test_webhook_url` - Webhook URL
- `test_callback_url` - Callback URL
- `test_redirect_url` - Redirect URL
- `test_success_url` - Success URL
- `test_cancel_url` - Cancel URL

### ⚙️ **Configuration & Settings**
- `test_metadata` - Metadata (JSON)
- `test_preferences` - User preferences (JSON)
- `test_benefits` - Benefits list (JSON array)
- `test_amenities` - Amenities list (JSON array)
- `test_headers` - Custom headers (JSON)
- `test_cookies` - Cookies (JSON)

### 🔒 **Security & Encryption**
- `jwt_secret` - JWT secret key
- `test_encryption_key` - Encryption key
- `test_hmac_secret` - HMAC secret
- `test_salt` - Salt value
- `test_hash` - Hash value
- `test_signature` - Digital signature

### 🚦 **Status & State**
- `test_status_active` - Active status
- `test_status_pending` - Pending status
- `test_status_completed` - Completed status
- `test_status_failed` - Failed status
- `test_status_cancelled` - Cancelled status
- `test_status_used` - Used status
- `test_status_expired` - Expired status
- `test_status_online` - Online status
- `test_status_offline` - Offline status
- `test_status_away` - Away status

### 🔢 **Quantities & Capacities**
- `test_capacity` - Venue capacity
- `test_max_quantity` - Maximum quantity
- `test_current_quantity` - Current quantity
- `test_guest_count` - Guest count
- `test_timeout` - Request timeout
- `test_retry_count` - Retry count
- `test_retry_delay` - Retry delay

### 🌍 **Environment Settings**
- `test_environment` - Environment name
- `test_debug` - Debug mode
- `test_verbose` - Verbose logging
- `test_dry_run` - Dry run mode
- `test_sandbox` - Sandbox mode

## Environment Setup Instructions

### 1. **Import Environment Configuration**

1. Open Insomnia
2. Click on the environment dropdown (top-left)
3. Select "Manage Environments"
4. Click "Import" and select `insomnia-testing-config.json`
5. Or manually copy the environment data from `insomnia-env.json`

### 2. **Select Environment**

Choose the appropriate environment for your testing:

- **Base Environment** - Development (localhost:3000)
- **Production Environment** - Production (api.tiikii.com)
- **Staging Environment** - Staging (staging-api.tiikii.com)

### 3. **Using Environment Variables in Requests**

Reference variables using double curly braces:

```javascript
// URL
{{ base_url }}/api/festivals/{{ test_festival_id }}

// Headers
Authorization: Bearer {{ auth_token }}
Content-Type: {{ content_type }}

// Request Body
{
  "email": "{{ test_email }}",
  "password": "{{ test_password }}",
  "festivalId": "{{ test_festival_id }}"
}

// Query Parameters
?limit={{ test_limit }}&offset={{ test_offset }}
```

### 4. **Dynamic Variable Updates**

The test suites automatically update variables during execution:

```javascript
// After login - extract and store token
if (insomnia.request.name === 'Login' && insomnia.response.status === 200) {
  const responseData = JSON.parse(insomnia.response.body);
  if (responseData.token) {
    insomnia.environment.set('auth_token', responseData.token);
  }
}

// After festival list - store first festival ID
if (insomnia.request.name === 'List Festivals' && insomnia.response.status === 200) {
  const responseData = JSON.parse(insomnia.response.body);
  if (Array.isArray(responseData) && responseData.length > 0) {
    insomnia.environment.set('test_festival_id', responseData[0].id);
  }
}
```

## Environment Categories by Use Case

### 🔐 **Authentication Testing**
```javascript
{
  "test_email": "{{ test_email }}",
  "test_password": "{{ test_password }}",
  "test_username": "{{ test_username }}"
}
```

### 🎪 **Festival Management**
```javascript
{
  "festivalId": "{{ test_festival_id }}",
  "festivalName": "{{ test_festival_name }}",
  "startDate": "{{ test_start_date }}",
  "endDate": "{{ test_end_date }}"
}
```

### 🎫 **Ticket Operations**
```javascript
{
  "templateId": "{{ test_template_id }}",
  "holderName": "{{ test_holder_name }}",
  "amount": {{ test_amount }},
  "currency": "{{ test_currency }}"
}
```

### 💬 **Chat System**
```javascript
{
  "roomId": "{{ test_room_id }}",
  "messageText": "{{ test_message_text }}",
  "participantId": "{{ test_participant_id }}"
}
```

### 🌐 **Mesh Network**
```javascript
{
  "peerId": "{{ test_peer_id }}",
  "nickname": "{{ test_peer_nickname }}",
  "noisePublicKey": "{{ test_noise_public_key }}"
}
```

### 📍 **Location Services**
```javascript
{
  "latitude": {{ test_latitude }},
  "longitude": {{ test_longitude }},
  "radius": {{ test_radius }}
}
```

## Best Practices

### 1. **Environment Isolation**
- Use separate environments for different stages
- Never mix production and development data
- Keep sensitive data in secret variables

### 2. **Variable Naming**
- Use descriptive names with prefixes
- Group related variables logically
- Maintain consistency across environments

### 3. **Data Validation**
- Validate environment variables before use
- Check for required variables in test scripts
- Handle missing or invalid data gracefully

### 4. **Security**
- Use secret variables for sensitive data
- Never commit production secrets to version control
- Rotate keys and tokens regularly

### 5. **Testing Workflows**
- Start with authentication to get tokens
- Use dynamic variable updates for data flow
- Validate responses and extract new IDs

## Troubleshooting

### Common Issues

1. **Missing Variables**
   - Check environment selection
   - Verify variable names (case-sensitive)
   - Ensure proper JSON formatting

2. **Authentication Failures**
   - Verify test credentials
   - Check token extraction scripts
   - Validate JWT format

3. **Data Mismatches**
   - Ensure test data exists in database
   - Check ID formats and values
   - Validate environment-specific data

4. **Request Failures**
   - Verify base URL configuration
   - Check network connectivity
   - Validate request format

### Debug Tips

1. **Console Logging**
   ```javascript
   console.log('Current environment:', insomnia.environment.get('test_environment'));
   console.log('Auth token:', insomnia.environment.get('auth_token'));
   ```

2. **Variable Inspection**
   ```javascript
   const allVars = insomnia.environment.all();
   console.log('All variables:', JSON.stringify(allVars, null, 2));
   ```

3. **Response Validation**
   ```javascript
   if (insomnia.response.status !== 200) {
     console.error('Request failed:', insomnia.response.status);
     console.error('Response:', insomnia.response.body);
   }
   ```

## Environment File Structure

The environment files are organized as follows:

```
insomnia-env.json
├── development
│   ├── Core API (base_url, content_type, etc.)
│   ├── User Data (test_email, test_password, etc.)
│   ├── Festival Data (test_festival_id, test_festival_name, etc.)
│   ├── Artist Data (test_artist_id, test_artist_name, etc.)
│   ├── Ticket Data (test_ticket_id, test_amount, etc.)
│   ├── Chat Data (test_room_id, test_message_id, etc.)
│   ├── Mesh Data (test_peer_id, test_noise_public_key, etc.)
│   ├── Location Data (test_latitude, test_longitude, etc.)
│   ├── UI Data (test_primary_color, test_decoration_icons, etc.)
│   ├── Security Data (jwt_secret, test_encryption_key, etc.)
│   └── Configuration Data (test_environment, test_debug, etc.)
├── production
│   └── (Same structure with production values)
└── staging
    └── (Same structure with staging values)
```

This comprehensive environment setup ensures that all API endpoints can be properly tested with realistic data across all environments.
