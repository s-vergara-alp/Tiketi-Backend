# Ejemplos de Respuestas de la API - Tiikii Festival

Este documento contiene ejemplos de las respuestas esperadas de cada endpoint de la API para facilitar las pruebas y el desarrollo.

## 📋 Contenido

- [Autenticación](#autenticación)
- [Festivales](#festivales)
- [Entradas](#entradas)
- [Chat](#chat)
- [Programación](#programación)
- [Artistas](#artistas)
- [Vendedores](#vendedores)
- [Puntos de Interés](#puntos-de-interés)
- [Usuarios](#usuarios)
- [Widgets](#widgets)
- [Sistema](#sistema)

## 🔐 Autenticación

### POST /api/auth/register
**Request:**
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "firstName": "Test",
  "lastName": "User"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "username": "testuser",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "isActive": true,
    "isVerified": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "User registered successfully"
}
```

### POST /api/auth/login
**Request:**
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "user-123",
    "username": "testuser",
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User",
    "avatar": null,
    "is_active": 1,
    "is_verified": 1
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### GET /api/auth/me
**Response (200):**
```json
{
  "user": {
    "id": "user-123",
    "username": "testuser",
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User",
    "avatar": null,
    "phone": null,
    "date_of_birth": null,
    "is_active": 1,
    "is_verified": 1,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z",
    "last_login": "2024-01-01T00:00:00.000Z"
  }
}
```

### PUT /api/auth/me
**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "avatar": "https://example.com/avatar.jpg",
  "preferences": {
    "notifications": true,
    "theme": "dark"
  }
}
```

**Response (200):**
```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": "user-123",
    "username": "testuser",
    "email": "test@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "avatar": "https://example.com/avatar.jpg",
    "phone": "+1234567890",
    "preferences": "{\"notifications\":true,\"theme\":\"dark\"}",
    "is_verified": 1,
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### PUT /api/auth/change-password
**Request:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

**Response (200):**
```json
{
  "message": "Password changed successfully"
}
```

### POST /api/auth/logout
**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

## 🎪 Festivales

### GET /api/festivals
**Response (200):**
```json
[
  {
    "id": "festival-123",
    "name": "Tiikii Festival 2024",
    "description": "El mejor festival de música electrónica",
    "logo": "https://example.com/logo.png",
    "venue": "Parque Central",
    "start_date": "2024-07-15T18:00:00.000Z",
    "end_date": "2024-07-17T06:00:00.000Z",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "latitude_delta": 0.01,
    "longitude_delta": 0.01,
    "primary_color": "#FF6B6B",
    "secondary_color": "#4ECDC4",
    "accent_color": "#45B7D1",
    "background_color": "#F8F9FA",
    "decoration_icons": ["🎵", "🎪", "🎨"],
    "is_active": 1,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "latitudeDelta": 0.01,
      "longitudeDelta": 0.01
    },
    "colors": {
      "primary": "#FF6B6B",
      "secondary": "#4ECDC4",
      "accent": "#45B7D1",
      "background": "#F8F9FA"
    },
    "dates": "7/15/2024 - 7/17/2024"
  }
]
```

### GET /api/festivals/:id
**Response (200):**
```json
{
  "id": "festival-123",
  "name": "Tiikii Festival 2024",
  "description": "El mejor festival de música electrónica",
  "logo": "https://example.com/logo.png",
  "venue": "Parque Central",
  "start_date": "2024-07-15T18:00:00.000Z",
  "end_date": "2024-07-17T06:00:00.000Z",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "latitude_delta": 0.01,
  "longitude_delta": 0.01,
  "primary_color": "#FF6B6B",
  "secondary_color": "#4ECDC4",
  "accent_color": "#45B7D1",
  "background_color": "#F8F9FA",
  "decoration_icons": ["🎵", "🎪", "🎨"],
  "is_active": 1,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "latitudeDelta": 0.01,
    "longitudeDelta": 0.01
  },
  "colors": {
    "primary": "#FF6B6B",
    "secondary": "#4ECDC4",
    "accent": "#45B7D1",
    "background": "#F8F9FA"
  },
  "dates": "7/15/2024 - 7/17/2024",
  "stages": [
    {
      "id": "stage-123",
      "festival_id": "festival-123",
      "name": "Main Stage",
      "description": "The main stage of the festival",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "capacity": 10000,
      "is_active": 1,
      "location": {
        "lat": 40.7128,
        "lon": -74.0060
      }
    }
  ],
  "artists": [
    {
      "id": "artist-123",
      "name": "Martin Garrix",
      "bio": "DJ y productor holandés",
      "genre": "Electronic",
      "image_url": "https://example.com/artist.jpg",
      "social_media": {
        "instagram": "@martingarrix",
        "twitter": "@martingarrix"
      }
    }
  ],
  "ticketTemplates": [
    {
      "id": "template-456",
      "festival_id": "festival-123",
      "name": "VIP Pass",
      "description": "Acceso VIP con beneficios exclusivos",
      "price": 150.00,
      "currency": "USD",
      "benefits": ["Acceso VIP", "Área exclusiva", "Barra premium"],
      "max_quantity": 100,
      "current_quantity": 25,
      "is_available": 1
    }
  ]
}
```

## 🎫 Entradas

### GET /api/tickets
**Response (200):**
```json
[
  {
    "id": "ticket-123",
    "festival_id": "festival-123",
    "template_id": "template-456",
    "qr_payload": "QR_CODE_123456789",
    "holder_name": "John Doe",
    "tier": "VIP",
    "valid_from": "2024-07-15T18:00:00.000Z",
    "valid_to": "2024-07-17T06:00:00.000Z",
    "status": "active",
    "price": 150.00,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

### POST /api/tickets/purchase
**Request:**
```json
{
  "festivalId": "festival-123",
  "templateId": "template-456",
  "holderName": "John Doe",
  "paymentMethod": {
    "type": "card",
    "token": "tok_test_123"
  },
  "amount": 99.99,
  "currency": "USD",
  "seatInfo": {
    "section": "A",
    "row": "1",
    "seat": "5"
  }
}
```

**Response (201):**
```json
{
  "message": "Ticket purchased successfully",
  "ticket": {
    "id": "ticket-123",
    "festival_id": "festival-123",
    "template_id": "template-456",
    "qr_payload": "QR_CODE_123456789",
    "holder_name": "John Doe",
    "tier": "VIP",
    "valid_from": "2024-07-15T18:00:00.000Z",
    "valid_to": "2024-07-17T06:00:00.000Z",
    "status": "active",
    "price": 99.99
  },
  "payment": {
    "id": "payment-123",
    "status": "completed",
    "amount": 99.99,
    "currency": "USD",
    "gateway_transaction_id": "txn_123456789"
  }
}
```

### POST /api/tickets/validate/:qrPayload
**Response (200):**
```json
{
  "success": true,
  "data": {
    "ticket": {
      "id": "ticket-123",
      "holder_name": "John Doe",
      "tier": "VIP",
      "festival_name": "Tiikii Festival 2024",
      "valid_from": "2024-07-15T18:00:00.000Z",
      "valid_to": "2024-07-17T06:00:00.000Z",
      "status": "active"
    },
    "validation": {
      "isValid": true,
      "message": "Ticket is valid for entry",
      "validatedAt": "2024-07-15T20:30:00.000Z"
    }
  },
  "message": "Ticket validated successfully"
}
```

### POST /api/tickets/:id/transfer
**Request:**
```json
{
  "newHolderName": "Jane Doe"
}
```

**Response (200):**
```json
{
  "message": "Ticket transferred successfully",
  "ticket": {
    "id": "ticket-123",
    "festival_id": "festival-123",
    "template_id": "template-456",
    "qr_payload": "QR_CODE_123456789",
    "holder_name": "Jane Doe",
    "tier": "VIP",
    "valid_from": "2024-07-15T18:00:00.000Z",
    "valid_to": "2024-07-17T06:00:00.000Z",
    "status": "active",
    "price": 99.99
  }
}
```

### POST /api/tickets/:id/cancel
**Request:**
```json
{
  "reason": "Change of plans"
}
```

**Response (200):**
```json
{
  "message": "Ticket cancelled successfully",
  "ticket": {
    "id": "ticket-123",
    "festival_id": "festival-123",
    "template_id": "template-456",
    "qr_payload": "QR_CODE_123456789",
    "holder_name": "John Doe",
    "tier": "VIP",
    "valid_from": "2024-07-15T18:00:00.000Z",
    "valid_to": "2024-07-17T06:00:00.000Z",
    "status": "cancelled",
    "price": 99.99
  }
}
```

## 🌐 Mesh Network

### GET /api/mesh/peers
**Response (200):**
```json
[
  {
    "id": "peer-123",
    "name": "Peer 1",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "last_seen": "2024-01-01T00:00:00.000Z",
    "is_active": 1,
    "capabilities": ["chat", "file-sharing"]
  }
]
```

### POST /api/mesh/peers
**Request:**
```json
{
  "name": "My Device",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "capabilities": ["chat", "file-sharing"]
}
```

**Response (201):**
```json
{
  "message": "Peer registered successfully",
  "peer": {
    "id": "peer-123",
    "name": "My Device",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "last_seen": "2024-01-01T00:00:00.000Z",
    "is_active": 1,
    "capabilities": ["chat", "file-sharing"]
  }
}
```

### POST /api/mesh/messages
**Request:**
```json
{
  "recipient_id": "peer-456",
  "content": "Hello from mesh network!",
  "type": "text"
}
```

**Response (201):**
```json
{
  "message": "Message sent successfully",
  "data": {
    "id": "msg-123",
    "sender_id": "peer-123",
    "recipient_id": "peer-456",
    "content": "Hello from mesh network!",
    "type": "text",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "status": "sent"
  }
}
```

### POST /api/mesh/estadias
**Request:**
```json
{
  "festival_id": "festival-123",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "duration": 120,
  "notes": "Great festival experience"
}
```

**Response (201):**
```json
{
  "message": "Estadia created successfully",
  "data": {
    "id": "estadia-123",
    "festival_id": "festival-123",
    "user_id": "user-123",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "duration": 120,
    "notes": "Great festival experience",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

## 💬 Chat

### GET /api/chat/rooms
**Response (200):**
```json
[
  {
    "id": "room-123",
    "festival_id": "festival-123",
    "name": "General Chat",
    "type": "public",
    "avatar": "https://example.com/avatar.png",
    "is_active": 1,
    "participant_count": 25,
    "last_message": {
      "content": "¡Hola a todos!",
      "timestamp": "2024-07-15T20:30:00.000Z",
      "sender": "user-456"
    },
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

### GET /api/chat/rooms/:roomId/messages
**Response (200):**
```json
[
  {
    "id": "message-123",
    "room_id": "room-123",
    "sender_id": "user-456",
    "content": "¡Hola a todos!",
    "timestamp": "2024-07-15T20:30:00.000Z",
    "is_edited": 0,
    "is_deleted": 0,
    "sender": {
      "id": "user-456",
      "username": "johndoe",
      "first_name": "John",
      "last_name": "Doe",
      "avatar": "https://example.com/avatar.png"
    }
  }
]
```

### POST /api/chat/rooms/:roomId/messages
**Request:**
```json
{
  "content": "¡Hola a todos!"
}
```

**Response (201):**
```json
{
  "message": "Message sent successfully",
  "data": {
    "id": "message-123",
    "room_id": "room-123",
    "sender_id": "user-456",
    "content": "¡Hola a todos!",
    "timestamp": "2024-07-15T20:30:00.000Z",
    "is_edited": 0,
    "is_deleted": 0
  }
}
```

## 📅 Programación

### GET /api/schedule/festival/:festivalId
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "schedule-123",
      "festivalId": "festival-123",
      "artistId": "artist-456",
      "stageId": "stage-789",
      "title": "DJ Set - Martin Garrix",
      "startTime": "2024-07-15T22:00:00.000Z",
      "endTime": "2024-07-16T00:00:00.000Z",
      "artist": {
        "id": "artist-456",
        "name": "Martin Garrix",
        "genre": "Electronic",
        "imageUrl": "https://example.com/artist.jpg"
      },
      "stage": {
        "id": "stage-789",
        "name": "Main Stage",
        "capacity": 10000
      }
    }
  ],
  "message": "Schedule retrieved successfully"
}
```

## 🎤 Artistas

### GET /api/artists
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "artist-123",
      "name": "Martin Garrix",
      "bio": "DJ y productor holandés",
      "genre": "Electronic",
      "imageUrl": "https://example.com/artist.jpg",
      "socialMedia": {
        "instagram": "@martingarrix",
        "twitter": "@martingarrix",
        "spotify": "martin-garrix"
      },
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "message": "Artists retrieved successfully"
}
```

### GET /api/artists/festival/:festivalId
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "artist-123",
      "name": "Martin Garrix",
      "bio": "DJ y productor holandés",
      "genre": "Electronic",
      "imageUrl": "https://example.com/artist.jpg",
      "performanceCount": 1,
      "nextPerformance": {
        "startTime": "2024-07-15T22:00:00.000Z",
        "stage": "Main Stage"
      }
    }
  ],
  "message": "Festival artists retrieved successfully"
}
```

## 🏪 Vendedores

### GET /api/vendors/festival/:festivalId
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "vendor-123",
      "festivalId": "festival-123",
      "name": "Burger Palace",
      "description": "Las mejores hamburguesas del festival",
      "type": "food",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "isActive": true,
      "waitTime": 15,
      "rating": 4.5,
      "imageUrl": "https://example.com/vendor.jpg",
      "menu": [
        {
          "name": "Classic Burger",
          "price": 12.99,
          "description": "Hamburguesa clásica con papas"
        }
      ]
    }
  ],
  "message": "Vendors retrieved successfully"
}
```

## 📍 Puntos de Interés

### GET /api/pois/festival/:festivalId
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "poi-123",
      "festivalId": "festival-123",
      "name": "Entrada Principal",
      "description": "Entrada principal del festival",
      "kind": "entrance",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "isActive": true,
      "icon": "🚪",
      "color": "#FF6B6B"
    }
  ],
  "message": "POIs retrieved successfully"
}
```

## 👤 Usuarios

### GET /api/users/profile
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "username": "testuser",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "avatar": null,
    "phone": "+1234567890",
    "dateOfBirth": "1990-01-01",
    "isActive": true,
    "isVerified": true,
    "preferences": {
      "notifications": true,
      "theme": "dark"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "User profile retrieved successfully"
}
```

### GET /api/users/notifications
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "notification-123",
      "userId": "user-123",
      "title": "Nueva entrada disponible",
      "body": "Se han liberado nuevas entradas para Tiikii Festival",
      "type": "ticket",
      "data": {
        "festivalId": "festival-123"
      },
      "isRead": false,
      "createdAt": "2024-07-15T20:30:00.000Z"
    }
  ],
  "message": "Notifications retrieved successfully"
}
```

## 🧩 Widgets

### GET /api/widgets/festival/:festivalId
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "widget-123",
      "festivalId": "festival-123",
      "type": "weather",
      "title": "Clima",
      "description": "Información del clima actual",
      "config": {
        "showTemperature": true,
        "showForecast": true
      },
      "isActive": true,
      "position": {
        "x": 0,
        "y": 0,
        "width": 2,
        "height": 1
      }
    }
  ],
  "message": "Widgets retrieved successfully"
}
```

## 🏥 Sistema

### GET /health
**Response (200):**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "development",
  "version": "1.0.0",
  "database": {
    "status": "connected",
    "type": "sqlite"
  },
  "memory": {
    "used": "45.2 MB",
    "free": "102.8 MB"
  }
}
```

## ❌ Ejemplos de Errores

### Error 400 - Bad Request
```json
{
  "success": false,
  "error": {
    "type": "ValidationError",
    "message": "Invalid input data",
    "details": [
      "Field 'email' is required",
      "Field 'password' must be at least 6 characters"
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error 401 - Unauthorized
```json
{
  "success": false,
  "error": {
    "type": "UnauthorizedError",
    "message": "Authentication required"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error 404 - Not Found
```json
{
  "success": false,
  "error": {
    "type": "NotFoundError",
    "message": "Resource not found"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error 500 - Internal Server Error
```json
{
  "success": false,
  "error": {
    "type": "InternalServerError",
    "message": "An unexpected error occurred"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🗺️ Points of Interest (POIs)

### GET /api/pois/festival/:festivalId
**Response (200):**
```json
{
  "festivalId": "festival-123",
  "festivalName": "Tiikii Festival 2024",
  "pois": [
    {
      "id": "poi-123",
      "festival_id": "festival-123",
      "name": "Main Stage",
      "description": "The main performance stage",
      "kind": "stage",
      "location": {
        "lat": 40.7128,
        "lon": -74.0060
      },
      "is_active": 1,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

### GET /api/pois/festival/:festivalId/nearby
**Response (200):**
```json
{
  "festivalId": "festival-123",
  "festivalName": "Tiikii Festival 2024",
  "location": {
    "lat": 40.7128,
    "lon": -74.0060
  },
  "radius": 500,
  "kind": "stage",
  "pois": [
    {
      "id": "poi-123",
      "festival_id": "festival-123",
      "name": "Main Stage",
      "description": "The main performance stage",
      "kind": "stage",
      "location": {
        "lat": 40.7128,
        "lon": -74.0060
      },
      "distance": 150,
      "is_active": 1
    }
  ],
  "count": 1
}
```

## 📅 Schedule

### GET /api/schedule/festival/:festivalId
**Response (200):**
```json
{
  "festivalId": "festival-123",
  "festivalName": "Tiikii Festival 2024",
  "schedule": [
    {
      "id": "schedule-123",
      "festival_id": "festival-123",
      "artist_id": "artist-456",
      "stage_id": "stage-789",
      "start_time": "2024-07-15T20:00:00.000Z",
      "end_time": "2024-07-15T22:00:00.000Z",
      "artist": {
        "id": "artist-456",
        "name": "DJ Example",
        "bio": "Electronic music producer",
        "genre": "Electronic",
        "imageUrl": "https://example.com/artist.jpg",
        "socialMedia": {
          "instagram": "@djexample",
          "twitter": "@djexample"
        }
      },
      "stage": {
        "id": "stage-789",
        "name": "Main Stage",
        "description": "The main performance stage",
        "capacity": 5000
      }
    }
  ],
  "count": 1
}
```

### GET /api/schedule/festival/:festivalId/now
**Response (200):**
```json
{
  "festivalId": "festival-123",
  "festivalName": "Tiikii Festival 2024",
  "currentTime": "2024-07-15T21:00:00.000Z",
  "performances": [
    {
      "id": "schedule-123",
      "festival_id": "festival-123",
      "artist_id": "artist-456",
      "stage_id": "stage-789",
      "start_time": "2024-07-15T20:00:00.000Z",
      "end_time": "2024-07-15T22:00:00.000Z",
      "status": "now",
      "artist": {
        "id": "artist-456",
        "name": "DJ Example",
        "bio": "Electronic music producer",
        "genre": "Electronic",
        "imageUrl": "https://example.com/artist.jpg",
        "socialMedia": {
          "instagram": "@djexample",
          "twitter": "@djexample"
        }
      },
      "stage": {
        "id": "stage-789",
        "name": "Main Stage",
        "description": "The main performance stage"
      }
    }
  ]
}
```

## 🛍️ Vendors

### GET /api/vendors/festival/:festivalId
**Response (200):**
```json
{
  "festivalId": "festival-123",
  "festivalName": "Tiikii Festival 2024",
  "vendors": [
    {
      "id": "vendor-123",
      "festival_id": "festival-123",
      "name": "Food Truck Central",
      "description": "Delicious food and drinks",
      "type": "food",
      "location": {
        "lat": 40.7128,
        "lon": -74.0060
      },
      "rating": 4.5,
      "wait_time": 15,
      "is_active": 1,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

### PUT /api/vendors/:id/wait-time
**Request:**
```json
{
  "waitTime": 20
}
```

**Response (200):**
```json
{
  "message": "Wait time updated successfully",
  "vendorId": "vendor-123",
  "waitTime": 20
}
```

## 🧩 Widgets

### GET /api/widgets/festival/:festivalId
**Response (200):**
```json
{
  "festivalId": "festival-123",
  "festivalName": "Tiikii Festival 2024",
  "widgets": [
    {
      "id": "widget-123",
      "festival_id": "festival-123",
      "title": "Weather Widget",
      "type": "weather",
      "content": {
        "temperature": 25,
        "condition": "sunny"
      },
      "order_index": 1,
      "priority": 5,
      "is_active": 1,
      "is_enabled": true,
      "custom_settings": {
        "theme": "dark",
        "size": "large"
      }
    }
  ]
}
```

### PUT /api/widgets/:id/preferences
**Request:**
```json
{
  "isEnabled": true,
  "orderIndex": 2,
  "customSettings": {
    "theme": "light",
    "size": "medium"
  }
}
```

**Response (200):**
```json
{
  "message": "Widget preferences updated successfully"
}
```

## 📝 Notas Importantes

1. **Autenticación**: La mayoría de endpoints requieren el header `Authorization: Bearer <token>`

2. **Paginación**: Algunos endpoints soportan paginación con parámetros `page` y `limit`

3. **Filtros**: Muchos endpoints soportan filtros como `search`, `genre`, `type`, etc.

4. **Timestamps**: Todos los timestamps están en formato ISO 8601 UTC

5. **IDs**: Todos los IDs son UUIDs en formato string

6. **Moneda**: Los precios están en USD por defecto

7. **Coordenadas**: Las coordenadas están en formato decimal (latitud, longitud)

---

**¡Usa estos ejemplos para probar y entender la API!** 🚀
