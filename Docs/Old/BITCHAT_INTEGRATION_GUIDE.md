# BitChat Integration Guide for Tiikii Festival Backend

## Overview

This guide explains how the Tiikii Festival backend has been enhanced to support BitChat's offline Bluetooth mesh communication capabilities. The integration enables festival-goers to communicate, manage tickets, and access rooms even when internet connectivity is unavailable.

## Architecture

### BitChat Protocol Integration

The backend now supports BitChat's four-layer protocol stack:

1. **Application Layer**: Festival-specific messages (tickets, estadias, chat)
2. **Session Layer**: Message framing and routing
3. **Encryption Layer**: Noise Protocol Framework (XX pattern)
4. **Transport Layer**: Bluetooth Low Energy mesh network

### Key Components

- **MeshNetworkService**: Core service for handling mesh communication
- **EstadiasService**: Manages room access and permissions
- **OfflineSyncService**: Handles offline-to-online synchronization
- **CryptoUtils**: Cryptographic utilities for Noise Protocol

## Database Schema

### New Tables

#### Mesh Network Tables
- `mesh_identities`: Cryptographic identities for mesh participants
- `mesh_sessions`: Active Noise protocol sessions
- `mesh_messages`: Messages sent through mesh network
- `mesh_rooms`: Bluetooth mesh chat rooms
- `mesh_room_participants`: Room membership

#### Estadias System Tables
- `estadias`: Room/area definitions
- `estadia_access`: User access permissions
- `estadia_access_logs`: Access event logging

#### Synchronization Tables
- `offline_sync_queue`: Queues data for online sync
- `mesh_network_stats`: Network statistics

## API Endpoints

### Mesh Identity Management

#### Register Mesh Identity
```http
POST /api/mesh/identity/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "festivalId": "cordillera-2025",
  "fingerprint": "sha256_hash_of_public_key",
  "staticPublicKey": "base64_encoded_curve25519_key",
  "signingPublicKey": "base64_encoded_ed25519_key",
  "nickname": "user_nickname"
}
```

#### Get Mesh Identity
```http
GET /api/mesh/identity/:fingerprint
Authorization: Bearer <token>
```

### Mesh Messaging

#### Send Mesh Message
```http
POST /api/mesh/message
Authorization: Bearer <token>
Content-Type: application/json

{
  "senderFingerprint": "sender_fingerprint",
  "recipientFingerprint": "recipient_fingerprint_or_FFFFFFFFFFFFFFFF_for_broadcast",
  "roomId": "room_id_optional",
  "messageType": "text|ticket|estadia|location|system",
  "content": "message_content",
  "encryptedContent": "encrypted_content_for_private_messages",
  "isPrivate": false,
  "ttl": 7
}
```

### Estadias Management

#### Get Estadias
```http
GET /api/mesh/estadias/:festivalId
Authorization: Bearer <token>
```

#### Grant Access
```http
POST /api/mesh/estadias/access
Authorization: Bearer <token>
Content-Type: application/json

{
  "estadiaId": "estadia_id",
  "userId": "user_id",
  "ticketId": "ticket_id_optional",
  "accessType": "permanent|temporary|scheduled",
  "expiresAt": "2025-01-15T23:59:59Z",
  "notes": "access_notes"
}
```

#### Log Access
```http
POST /api/mesh/estadias/log
Authorization: Bearer <token>
Content-Type: application/json

{
  "estadiaId": "estadia_id",
  "userId": "user_id",
  "accessType": "entry|exit|denied|granted|revoked",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "meshIdentityId": "mesh_identity_id_optional",
  "notes": "access_notes"
}
```

### Synchronization

#### Get Sync Queue
```http
GET /api/mesh/sync/queue/:userId
Authorization: Bearer <token>
```

#### Process Sync Queue
```http
POST /api/mesh/sync/process
Authorization: Bearer <token>
```

#### Update Online Status
```http
POST /api/mesh/online-status
Authorization: Bearer <token>
Content-Type: application/json

{
  "isOnline": true
}
```

## Message Types

### Text Messages
Standard chat messages sent through the mesh network.

### Ticket Messages
```json
{
  "action": "scan|transfer|validate",
  "ticketId": "ticket_id",
  "qrPayload": "qr_code_data",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Estadia Messages
```json
{
  "action": "request_access|grant_access|log_entry|log_exit",
  "estadiaId": "estadia_id",
  "accessType": "permanent|temporary|scheduled",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Location Messages
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "accuracy": 10.5,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### System Messages
Server-generated messages for notifications and status updates.

## Offline Synchronization

### How It Works

1. **Offline Mode**: When internet is unavailable, all data is queued locally
2. **Online Detection**: Backend detects when connectivity is restored
3. **Sync Processing**: Queued data is processed and synchronized
4. **Conflict Resolution**: Conflicts are resolved using configurable strategies

### Sync Types

- **Messages**: Chat messages sent via mesh
- **Presence**: User location and status updates
- **Access Logs**: Estadia entry/exit events
- **Ticket Scans**: QR code validation events
- **Favorites**: Artist favorites and preferences
- **Notifications**: Push notifications

### Conflict Resolution Strategies

- **server_wins**: Server data takes precedence
- **client_wins**: Client data takes precedence
- **merge**: Intelligent merging of data
- **manual**: Requires manual resolution

## Security Features

### Noise Protocol Framework

- **Protocol**: `Noise_XX_25519_ChaChaPoly_SHA256`
- **Key Exchange**: Curve25519 ECDH
- **Encryption**: ChaCha20-Poly1305 AEAD
- **Hashing**: SHA-256
- **Forward Secrecy**: Ephemeral keys for each session

### Identity Management

- **Fingerprints**: SHA-256 hash of public keys
- **Trust Levels**: unknown, casual, trusted, verified
- **Social Features**: Favorites, blocking, petnames

### Message Security

- **End-to-End Encryption**: All private messages encrypted
- **Authentication**: Cryptographic message authentication
- **Replay Protection**: Nonce-based replay prevention
- **Forward Secrecy**: Past messages remain secure

## Usage Examples

### Basic Mesh Communication

```javascript
// Register mesh identity
const identity = await fetch('/api/mesh/identity/register', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    festivalId: 'cordillera-2025',
    fingerprint: userFingerprint,
    staticPublicKey: userPublicKey,
    nickname: 'FestivalGoer'
  })
});

// Send mesh message
const message = await fetch('/api/mesh/message', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    senderFingerprint: userFingerprint,
    recipientFingerprint: 'FFFFFFFFFFFFFFFF', // Broadcast
    messageType: 'text',
    content: 'Hello from the mesh network!',
    isPrivate: false,
    ttl: 7
  })
});
```

### Estadia Access Management

```javascript
// Grant access to estadia
const access = await fetch('/api/mesh/estadias/access', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    estadiaId: 'vip-lounge-1',
    userId: 'user123',
    accessType: 'temporary',
    expiresAt: '2025-01-15T23:59:59Z',
    notes: 'VIP access for festival duration'
  })
});

// Log access event
const log = await fetch('/api/mesh/estadias/log', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    estadiaId: 'vip-lounge-1',
    userId: 'user123',
    accessType: 'entry',
    latitude: 40.7128,
    longitude: -74.0060,
    notes: 'Entered via mesh network'
  })
});
```

## Migration Instructions

### 1. Run Database Migration

```bash
cd src/database
node migrate_mesh.js
```

### 2. Update Environment Variables

Add to your `.env` file:
```env
# Mesh Network Configuration
MESH_NETWORK_ENABLED=true
MESH_SYNC_INTERVAL=30000
MESH_CLEANUP_INTERVAL=300000
```

### 3. Restart Server

```bash
npm start
```

## Monitoring and Analytics

### Network Statistics

```http
GET /api/mesh/stats/:festivalId?date=2025-01-15
```

Returns:
- Total peers connected
- Active sessions
- Messages sent/received
- Bytes transferred
- Average hop count

### Estadia Analytics

```http
GET /api/mesh/estadias/analytics/:festivalId?startDate=2025-01-15&endDate=2025-01-16
```

Returns:
- Total entries/exits per estadia
- Peak occupancy
- Access patterns
- Denied access attempts

## Troubleshooting

### Common Issues

1. **Identity Registration Fails**
   - Check fingerprint format (64 hex characters)
   - Verify public key format (base64, 32 bytes)
   - Ensure user is authenticated

2. **Messages Not Syncing**
   - Check offline sync queue status
   - Verify online status is correctly set
   - Review sync error messages

3. **Estadia Access Denied**
   - Verify user has valid access permissions
   - Check access expiration times
   - Review access logs for details

### Debug Endpoints

```http
# Get sync queue status
GET /api/mesh/sync/queue/:userId

# Get mesh network stats
GET /api/mesh/stats/:festivalId

# Get access logs
GET /api/mesh/estadias/:estadiaId/logs
```

## Future Enhancements

### Planned Features

1. **Group Messaging**: Multi-party encrypted conversations
2. **File Sharing**: Secure file transfer over mesh
3. **Location Services**: Real-time location sharing
4. **Emergency Features**: Emergency broadcast system
5. **Analytics Dashboard**: Real-time network monitoring

### Integration Opportunities

1. **IoT Devices**: Connect festival infrastructure
2. **Payment Systems**: Offline payment processing
3. **Access Control**: Smart locks and gates
4. **Environmental Monitoring**: Air quality, noise levels
5. **Crowd Management**: Density monitoring and alerts

## Support

For technical support or questions about the BitChat integration:

1. Check the API documentation
2. Review the error logs
3. Test with the provided Insomnia collection
4. Contact the development team

## References

- [BitChat GitHub Repository](https://github.com/permissionlesstech/bitchat)
- [Noise Protocol Framework](https://noiseprotocol.org/)
- [BitChat Whitepaper](https://github.com/permissionlesstech/bitchat/blob/main/WHITEPAPER.md)
- [BitChat Technical Documentation](https://github.com/permissionlesstech/bitchat/blob/main/BRING_THE_NOISE.md)
