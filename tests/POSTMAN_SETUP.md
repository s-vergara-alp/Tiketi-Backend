# Guía para usar la API de Tiikii Festival en Postman

Este documento explica cómo importar y usar la especificación OpenAPI de Tiikii Festival en Postman para realizar pruebas de la API.

## 📋 Contenido

- [Importar la especificación OpenAPI](#importar-la-especificación-openapi)
- [Configurar autenticación](#configurar-autenticación)
- [Variables de entorno](#variables-de-entorno)
- [Ejemplos de uso](#ejemplos-de-uso)
- [Colección de pruebas](#colección-de-pruebas)
- [Automatización de pruebas](#automatización-de-pruebas)

## 🚀 Importar la especificación OpenAPI

### Método 1: Importar desde archivo

1. **Abrir Postman**
   - Inicia Postman en tu computadora

2. **Importar archivo OpenAPI**
   - Haz clic en el botón **"Import"** en la esquina superior izquierda
   - Selecciona **"Upload Files"**
   - Navega hasta el archivo `openapi.yaml` en `Tiikii/@Test/server/`
   - Haz clic en **"Open"**

3. **Configurar la importación**
   - Postman detectará automáticamente que es un archivo OpenAPI
   - Haz clic en **"Import"** para confirmar
   - Se creará una nueva colección llamada "Tiikii Festival API"

### Método 2: Importar desde URL (si tienes el servidor corriendo)

1. **Obtener la URL del servidor**
   - Asegúrate de que tu servidor esté corriendo
   - La URL debería ser algo como: `http://localhost:3000`

2. **Importar desde URL**
   - En Postman, haz clic en **"Import"**
   - Selecciona **"Link"**
   - Ingresa la URL: `http://localhost:3000/openapi.yaml` (si tienes el endpoint configurado)
   - Haz clic en **"Continue"** y luego **"Import"**

## 🔐 Configurar autenticación

### Configurar Bearer Token

1. **Seleccionar la colección**
   - En el panel izquierdo, haz clic en la colección "Tiikii Festival API"

2. **Configurar autenticación a nivel de colección**
   - Ve a la pestaña **"Authorization"**
   - En **"Type"**, selecciona **"Bearer Token"**
   - En **"Token"**, ingresa: `{{auth_token}}`

3. **Obtener token de autenticación**
   - Ejecuta la petición **"POST /api/auth/login"**
   - Copia el token de la respuesta
   - Configúralo en las variables de entorno (ver siguiente sección)

## 🌍 Variables de entorno

### Crear un entorno

1. **Crear nuevo entorno**
   - Haz clic en el ícono de engranaje (⚙️) en la esquina superior derecha
   - Selecciona **"Add"**
   - Nombra el entorno: `Tiikii Festival - Development`

2. **Configurar variables**
   ```
   Variable Name: base_url
   Initial Value: http://localhost:3000
   Current Value: http://localhost:3000

   Variable Name: auth_token
   Initial Value: (vacío)
   Current Value: (se llenará automáticamente)

   Variable Name: user_id
   Initial Value: (vacío)
   Current Value: (se llenará automáticamente)

   Variable Name: festival_id
   Initial Value: test-festival-base
   Current Value: test-festival-base

   Variable Name: template_id
   Initial Value: test-template-base
   Current Value: test-template-base
   ```

3. **Seleccionar el entorno**
   - En el dropdown de entornos (esquina superior derecha), selecciona tu entorno creado

## 📝 Ejemplos de uso

### 1. Autenticación

#### Registrar un nuevo usuario
```http
POST {{base_url}}/api/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "firstName": "Test",
  "lastName": "User"
}
```

#### Iniciar sesión
```http
POST {{base_url}}/api/auth/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "password123"
}
```

**Script de prueba para guardar el token:**
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set("auth_token", response.data.token);
    pm.environment.set("user_id", response.data.user.id);
}
```

### 2. Gestión de Festivales

#### Obtener todos los festivales
```http
GET {{base_url}}/api/festivals
Authorization: Bearer {{auth_token}}
```

#### Obtener festival específico
```http
GET {{base_url}}/api/festivals/{{festival_id}}
Authorization: Bearer {{auth_token}}
```

### 3. Gestión de Tickets

#### Obtener plantillas de tickets
```http
GET {{base_url}}/api/tickets/templates/{{festival_id}}
Authorization: Bearer {{auth_token}}
```

#### Comprar un ticket
```http
POST {{base_url}}/api/tickets/purchase
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "festivalId": "{{festival_id}}",
  "templateId": "{{template_id}}",
  "holderName": "John Doe",
  "paymentMethod": {
    "type": "card",
    "token": "tok_test_123"
  }
}
```

#### Validar ticket
```http
POST {{base_url}}/api/tickets/validate/QR_CODE_123456789
Authorization: Bearer {{auth_token}}
```

### 4. Mesh Network

#### Registrar un peer
```http
POST {{base_url}}/api/mesh/peers
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "id": "test-peer-001",
  "noisePublicKey": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "signingPublicKey": "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
  "nickname": "TestPeer001",
  "isConnected": true,
  "isReachable": true,
  "metadata": {
    "deviceType": "mobile",
    "appVersion": "1.0.0"
  }
}
```

#### Enviar mensaje mesh
```http
POST {{base_url}}/api/mesh/messages
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "senderId": "test-peer-001",
  "recipientId": "test-peer-002",
  "content": "Test message from mesh network",
  "isPrivate": true,
  "isEncrypted": true,
  "deliveryStatus": "sent",
  "metadata": {
    "messageType": "text",
    "timestamp": 1640995200000
  }
}
```

### 5. Gestión de Estadías

#### Crear estadía
```http
POST {{base_url}}/api/mesh/estadias
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "userId": "{{user_id}}",
  "festivalId": "{{festival_id}}",
  "roomId": "room-123",
  "accessCode": "TEST-ACCESS-001",
  "startTime": "2024-07-15T18:00:00.000Z",
  "endTime": "2024-07-17T06:00:00.000Z",
  "metadata": {
    "guestCount": 2,
    "specialRequests": "Late checkout requested",
    "amenities": ["wifi", "breakfast"]
  }
}
```

#### Validar acceso a estadía
```http
POST {{base_url}}/api/mesh/estadias/access/validate
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "accessCode": "TEST-ACCESS-001",
  "roomId": "room-123",
  "userId": "{{user_id}}"
}
```

## 🧪 Colección de pruebas

### Crear pruebas automatizadas

Para cada petición, puedes agregar scripts de prueba en la pestaña **"Tests"**:

#### Ejemplo de script de prueba para login:
```javascript
// Verificar código de estado
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Verificar estructura de respuesta
pm.test("Response has required fields", function () {
    const response = pm.response.json();
    pm.expect(response).to.have.property('success');
    pm.expect(response).to.have.property('data');
    pm.expect(response.data).to.have.property('token');
    pm.expect(response.data).to.have.property('user');
});

// Guardar token para uso posterior
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set("auth_token", response.data.token);
    pm.environment.set("user_id", response.data.user.id);
}
```

#### Ejemplo de script de prueba para validación de ticket:
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Ticket validation response is correct", function () {
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    pm.expect(response.data).to.have.property('ticket');
    pm.expect(response.data).to.have.property('validation');
    pm.expect(response.data.validation).to.have.property('isValid');
});
```

## 🔄 Automatización de pruebas

### Usar Collection Runner

1. **Abrir Collection Runner**
   - Haz clic en la colección "Tiikii Festival API"
   - Haz clic en **"Run"**

2. **Configurar la ejecución**
   - Selecciona las peticiones que quieres ejecutar
   - Asegúrate de que el entorno correcto esté seleccionado
   - Configura el número de iteraciones si es necesario

3. **Ejecutar las pruebas**
   - Haz clic en **"Run Tiikii Festival API"**
   - Observa los resultados en tiempo real

### Orden recomendado de ejecución

1. **POST /api/auth/register** (si es un usuario nuevo)
2. **POST /api/auth/login** (para obtener token)
3. **GET /api/festivals** (verificar festivales disponibles)
4. **GET /api/tickets/templates/{festivalId}** (ver plantillas)
5. **POST /api/tickets/purchase** (comprar ticket)
6. **POST /api/tickets/validate/{qrPayload}** (validar ticket)
7. **POST /api/mesh/peers** (registrar peer)
8. **POST /api/mesh/messages** (enviar mensaje)
9. **POST /api/mesh/estadias** (crear estadía)
10. **POST /api/mesh/estadias/access/validate** (validar acceso)

## 🛠️ Troubleshooting

### Problemas comunes

1. **Error 401 Unauthorized**
   - Verifica que el token esté configurado correctamente
   - Asegúrate de que el token no haya expirado
   - Ejecuta nuevamente el login para obtener un token fresco

2. **Error 404 Not Found**
   - Verifica que la URL base esté configurada correctamente
   - Asegúrate de que el servidor esté corriendo
   - Verifica que los IDs de recursos existan

3. **Error 400 Bad Request**
   - Revisa el formato del JSON en el body
   - Verifica que todos los campos requeridos estén presentes
   - Revisa los tipos de datos (string, number, boolean)

4. **Variables no se actualizan**
   - Verifica que el entorno correcto esté seleccionado
   - Asegúrate de que los scripts de prueba estén ejecutándose
   - Revisa la sintaxis de los scripts

### Logs y debugging

Para debugging avanzado, puedes agregar logs en los scripts:

```javascript
// Log de la respuesta completa
console.log("Response:", pm.response.json());

// Log de variables de entorno
console.log("Auth Token:", pm.environment.get("auth_token"));
console.log("User ID:", pm.environment.get("user_id"));
```

## 📚 Recursos adicionales

- [Documentación de Postman](https://learning.postman.com/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Postman Testing](https://learning.postman.com/docs/writing-scripts/test-scripts/)

## 🎯 Próximos pasos

1. **Configurar CI/CD**: Integrar las pruebas de Postman en tu pipeline de CI/CD
2. **Monitoreo**: Configurar alertas para fallos en las pruebas
3. **Documentación**: Mantener actualizada la especificación OpenAPI
4. **Versionado**: Implementar versionado de API para cambios futuros

---

¡Con esta configuración podrás probar completamente la API de Tiikii Festival usando Postman! 🚀
