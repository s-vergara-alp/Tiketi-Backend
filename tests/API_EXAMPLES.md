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
  "username": "testuser",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-123",
      "username": "testuser",
      "email": "test@example.com",
      "firstName": "Test",
      "lastName": "User",
      "avatar": null,
      "isActive": true,
      "isVerified": false
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "7d"
  },
  "message": "Login successful"
}
```

### GET /api/auth/me
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
    "phone": null,
    "dateOfBirth": null,
    "isActive": true,
    "isVerified": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "lastLogin": "2024-01-01T00:00:00.000Z"
  },
  "message": "User profile retrieved successfully"
}
```

## 🎪 Festivales

### GET /api/festivals
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "festival-123",
      "name": "Tiikii Festival 2024",
      "description": "El mejor festival de música electrónica",
      "logo": "https://example.com/logo.png",
      "venue": "Parque Central",
      "startDate": "2024-07-15T18:00:00.000Z",
      "endDate": "2024-07-17T06:00:00.000Z",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "primaryColor": "#FF6B6B",
      "secondaryColor": "#4ECDC4",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "message": "Festivals retrieved successfully"
}
```

### GET /api/festivals/:id
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "festival-123",
    "name": "Tiikii Festival 2024",
    "description": "El mejor festival de música electrónica",
    "logo": "https://example.com/logo.png",
    "venue": "Parque Central",
    "startDate": "2024-07-15T18:00:00.000Z",
    "endDate": "2024-07-17T06:00:00.000Z",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "latitudeDelta": 0.01,
    "longitudeDelta": 0.01,
    "primaryColor": "#FF6B6B",
    "secondaryColor": "#4ECDC4",
    "accentColor": "#45B7D1",
    "backgroundColor": "#F8F9FA",
    "decorationIcons": ["🎵", "🎪", "🎨"],
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Festival retrieved successfully"
}
```

## 🎫 Entradas

### GET /api/tickets
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "ticket-123",
      "festivalId": "festival-123",
      "templateId": "template-456",
      "qrPayload": "QR_CODE_123456789",
      "holderName": "John Doe",
      "tier": "VIP",
      "validFrom": "2024-07-15T18:00:00.000Z",
      "validTo": "2024-07-17T06:00:00.000Z",
      "status": "active",
      "price": 150.00,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "message": "Tickets retrieved successfully"
}
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
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "ticket": {
      "id": "ticket-123",
      "festivalId": "festival-123",
      "templateId": "template-456",
      "qrPayload": "QR_CODE_123456789",
      "holderName": "John Doe",
      "tier": "VIP",
      "validFrom": "2024-07-15T18:00:00.000Z",
      "validTo": "2024-07-17T06:00:00.000Z",
      "status": "active",
      "price": 150.00
    },
    "payment": {
      "id": "payment-123",
      "status": "completed",
      "amount": 150.00,
      "currency": "USD",
      "gatewayTransactionId": "txn_123456789"
    }
  },
  "message": "Ticket purchased successfully"
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
      "holderName": "John Doe",
      "tier": "VIP",
      "festivalName": "Tiikii Festival 2024",
      "validFrom": "2024-07-15T18:00:00.000Z",
      "validTo": "2024-07-17T06:00:00.000Z",
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

## 💬 Chat

### GET /api/chat/rooms
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "room-123",
      "festivalId": "festival-123",
      "name": "General Chat",
      "type": "public",
      "avatar": "https://example.com/avatar.png",
      "isActive": true,
      "participantCount": 25,
      "lastMessage": {
        "content": "¡Hola a todos!",
        "timestamp": "2024-07-15T20:30:00.000Z",
        "sender": "user-456"
      }
    }
  ],
  "message": "Chat rooms retrieved successfully"
}
```

### GET /api/chat/rooms/:roomId/messages
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "message-123",
      "roomId": "room-123",
      "senderId": "user-456",
      "content": "¡Hola a todos!",
      "timestamp": "2024-07-15T20:30:00.000Z",
      "isEdited": false,
      "isDeleted": false,
      "sender": {
        "id": "user-456",
        "username": "johndoe",
        "firstName": "John",
        "lastName": "Doe",
        "avatar": "https://example.com/avatar.png"
      }
    }
  ],
  "message": "Messages retrieved successfully"
}
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
  "success": true,
  "data": {
    "id": "message-123",
    "roomId": "room-123",
    "senderId": "user-456",
    "content": "¡Hola a todos!",
    "timestamp": "2024-07-15T20:30:00.000Z",
    "isEdited": false,
    "isDeleted": false
  },
  "message": "Message sent successfully"
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
