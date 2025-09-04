# Configuración de Insomnia para Tiikii Festival API

Este documento explica cómo configurar y usar la colección de Insomnia para probar todas las APIs del servidor Tiikii Festival.

## Contenido

- [Instalación de Insomnia](#instalación-de-insomnia)
- [Importar la Colección](#importar-la-colección)
- [Configurar Variables de Entorno](#configurar-variables-de-entorno)
- [Flujo de Pruebas](#flujo-de-pruebas)
- [Test Suites en Insomnia](#test-suites-en-insomnia)
- [Endpoints Disponibles](#endpoints-disponibles)
- [Troubleshooting](#troubleshooting)

## Instalación de Insomnia

### 1. Descargar Insomnia
- Visita [https://insomnia.rest/](https://insomnia.rest/)
- Descarga la versión para tu sistema operativo
- Instala siguiendo las instrucciones del instalador

### 2. Crear Cuenta (Opcional)
- Puedes usar Insomnia sin cuenta, pero crear una cuenta te permite sincronizar colecciones entre dispositivos

## Importar la Colección

### Método 1: Importar desde Archivo
1. Abre Insomnia
2. Haz clic en **"Create"** en la esquina superior derecha
3. Selecciona **"Import From"** → **"File"**
4. Navega al archivo `insomnia-collection.json` en el directorio del servidor
5. Haz clic en **"Import"**

### Método 2: Importar desde URL (si está en repositorio)
1. Abre Insomnia
2. Haz clic en **"Create"** → **"Import From"** → **"URL"**
3. Pega la URL del archivo JSON
4. Haz clic en **"Import"**

## Configurar Variables de Entorno

### 1. Acceder a Variables de Entorno
1. En Insomnia, haz clic en el ícono de **"Environment"** en la barra superior
2. Selecciona **"Manage Environments"**
3. Edita el entorno **"Base Environment"**

### 2. Configurar Variables Principales
```json
{
  "base_url": "http://localhost:3000",
  "auth_token": "",
  "festival_id": "festival-123",
  "template_id": "template-456",
  "room_id": "room-789",
  "qr_payload": "qr-code-123",
  "user_id": "user-123"
}
```

### 3. Variables por Entorno

#### Desarrollo Local
```json
{
  "base_url": "http://localhost:3000",
  "auth_token": "",
  "festival_id": "festival-dev-123",
  "template_id": "template-dev-456"
}
```

#### Producción
```json
{
  "base_url": "https://api.tiikii.com",
  "auth_token": "",
  "festival_id": "festival-prod-123",
  "template_id": "template-prod-456"
}
```

## Flujo de Pruebas

### 1. Verificar Servidor
```bash
# Primero, asegúrate de que el servidor esté ejecutándose
npm run dev
```

### 2. Probar Health Check
1. Ejecuta **"Health Check"** en la carpeta **System**
2. Deberías recibir una respuesta 200 con información del servidor

### 3. Flujo de Autenticación
1. **Register User**: Crea una nueva cuenta
2. **Login User**: Inicia sesión y copia el token de la respuesta
3. **Get Current User**: Verifica que la autenticación funciona
4. Actualiza la variable `auth_token` con el token recibido

### 4. Probar APIs Principales
1. **Get All Festivals**: Obtén la lista de festivales
2. **Get Festival by ID**: Obtén detalles de un festival específico
3. **Get Festival Artists**: Obtén artistas de un festival
4. **Get Festival Schedule**: Obtén la programación

### 5. Probar Funcionalidades de Usuario
1. **Get User Profile**: Obtén perfil del usuario
2. **Get User Tickets**: Obtén entradas del usuario
3. **Purchase Ticket**: Compra una entrada (requiere datos válidos)

## Test Suites en Insomnia

Insomnia permite crear test suites automatizados para validar la funcionalidad de la API de manera sistemática.

### 1. Crear un Test Suite

1. **Navegar al Tab de Tests:**
   - En tu documento de Insomnia, haz clic en la pestaña **"Test"**
   - Haz clic en **"New Test Suite"**
   - Proporciona un nombre (ej: "Tiikii Festival API Tests")
   - Haz clic en **"Create Suite"**

### 2. Añadir Tests Individuales

1. **Crear un Test:**
   - Dentro del Test Suite, haz clic en **"New Test"**
   - Nombra tu test (ej: "Health Check Test")
   - Selecciona la request correspondiente del dropdown
   - Usa JavaScript y la librería de aserciones Chai para escribir scripts de test

2. **Ejemplo de Test Script:**
   ```javascript
   // Verificar que el health check retorna 200
   const response = await insomnia.send();
   expect(response.status).to.equal(200);
   
   // Validar propiedades del JSON de respuesta
   const body = JSON.parse(response.data);
   expect(body).to.have.property('status').that.is.a('string');
   expect(body.status).to.equal('OK');
   ```

3. **Test de Autenticación:**
   ```javascript
   // Test de login exitoso
   const response = await insomnia.send();
   expect(response.status).to.equal(200);
   
   const body = JSON.parse(response.data);
   expect(body).to.have.property('token').that.is.a('string');
   expect(body).to.have.property('user').that.is.an('object');
   
   // Guardar el token para tests posteriores
   insomnia.environment.set('auth_token', body.token);
   ```

4. **Test de Endpoint Protegido:**
   ```javascript
   // Verificar que el endpoint requiere autenticación
   const response = await insomnia.send();
   expect(response.status).to.equal(200);
   
   const body = JSON.parse(response.data);
   expect(body).to.have.property('success').that.is.a('boolean');
   expect(body.success).to.be.true;
   ```

### 3. Ejecutar Tests

1. **Ejecutar Tests Individuales:**
   - Haz clic en el botón **"Run Test"** en un test específico
   - Revisa los resultados en tiempo real

2. **Ejecutar Todo el Test Suite:**
   - Haz clic en el botón **"Run Tests"** en el Test Suite
   - Revisa los resultados para identificar fallos o problemas

### 4. Test Suite Completo para Tiikii Festival

#### Test Suite: "Authentication Flow"
```javascript
// Test 1: Health Check
const response = await insomnia.send();
expect(response.status).to.equal(200);

// Test 2: User Registration
const response = await insomnia.send();
expect(response.status).to.equal(201);
const body = JSON.parse(response.data);
expect(body).to.have.property('token');

// Test 3: User Login
const response = await insomnia.send();
expect(response.status).to.equal(200);
const body = JSON.parse(response.data);
expect(body).to.have.property('user');
insomnia.environment.set('auth_token', body.token);

// Test 4: Get Current User
const response = await insomnia.send();
expect(response.status).to.equal(200);
const body = JSON.parse(response.data);
expect(body).to.have.property('user');
```

#### Test Suite: "Festival API"
```javascript
// Test 1: Get All Festivals
const response = await insomnia.send();
expect(response.status).to.equal(200);
const body = JSON.parse(response.data);
expect(body).to.have.property('data').that.is.an('array');

// Test 2: Get Festival by ID
const response = await insomnia.send();
expect(response.status).to.equal(200);
const body = JSON.parse(response.data);
expect(body).to.have.property('data');
expect(body.data).to.have.property('id');

// Test 3: Get Festival Artists
const response = await insomnia.send();
expect(response.status).to.equal(200);
const body = JSON.parse(response.data);
expect(body).to.have.property('data').that.is.an('array');
```

#### Test Suite: "Ticket Management"
```javascript
// Test 1: Get Ticket Templates
const response = await insomnia.send();
expect(response.status).to.equal(200);
const body = JSON.parse(response.data);
expect(body).to.have.property('data').that.is.an('array');

// Test 2: Purchase Ticket
const response = await insomnia.send();
expect(response.status).to.equal(201);
const body = JSON.parse(response.data);
expect(body).to.have.property('data');
expect(body.data).to.have.property('ticket_id');

// Test 3: Get User Tickets
const response = await insomnia.send();
expect(response.status).to.equal(200);
const body = JSON.parse(response.data);
expect(body).to.have.property('data').that.is.an('array');
```

### 5. Integración con CI/CD

Los Test Suites de Insomnia pueden integrarse en pipelines de CI/CD:

1. **Insomnia CLI:**
   ```bash
   # Instalar Insomnia CLI
   npm install -g @insomnia/cli
   
   # Ejecutar tests desde línea de comandos
   insomnia run --test-suite "Tiikii Festival API Tests"
   ```

2. **Script de Automatización:**
   ```bash
   #!/bin/bash
   echo "Ejecutando tests de API..."
   insomnia run --test-suite "Authentication Flow"
   insomnia run --test-suite "Festival API"
   insomnia run --test-suite "Ticket Management"
   echo "Tests completados"
   ```

### 6. Mejores Prácticas

1. **Organización:**
   - Crea test suites separados por funcionalidad
   - Usa nombres descriptivos para tests
   - Agrupa tests relacionados

2. **Datos de Test:**
   - Usa variables de entorno para datos dinámicos
   - Limpia datos de test después de cada ejecución
   - Usa datos consistentes entre tests

3. **Aserciones:**
   - Verifica tanto el status code como el contenido
   - Valida la estructura de la respuesta
   - Incluye tests de casos de error

4. **Mantenimiento:**
   - Actualiza tests cuando cambie la API
   - Documenta tests complejos
   - Revisa resultados regularmente

## Endpoints Disponibles

### Authentication
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener usuario actual
- `POST /api/auth/logout` - Cerrar sesión

### Festivals
- `GET /api/festivals` - Listar festivales
- `GET /api/festivals/:id` - Obtener festival por ID
- `GET /api/festivals/:id/tickets-preview` - Vista previa de entradas
- `GET /api/festivals/:id/stats` - Estadísticas del festival
- `GET /api/festivals/:id/map` - Mapa del festival
- `GET /api/festivals/search/:query` - Buscar festivales

### Tickets
- `GET /api/tickets` - Obtener entradas del usuario
- `GET /api/tickets/:id` - Obtener entrada específica
- `POST /api/tickets/purchase` - Comprar entrada
- `POST /api/tickets/validate/:qrPayload` - Validar entrada
- `GET /api/tickets/templates/:festivalId` - Obtener plantillas de entradas
- `POST /api/tickets/:id/transfer` - Transferir entrada
- `POST /api/tickets/:id/cancel` - Cancelar entrada

### Chat
- `GET /api/chat/rooms` - Obtener salas de chat
- `GET /api/chat/rooms/:roomId/messages` - Obtener mensajes
- `POST /api/chat/rooms/:roomId/messages` - Enviar mensaje
- `POST /api/chat/rooms` - Crear sala de chat
- `PUT /api/chat/rooms/:roomId/read` - Marcar como leído
- `DELETE /api/chat/messages/:messageId` - Eliminar mensaje
- `PUT /api/chat/messages/:messageId` - Editar mensaje

### Schedule
- `GET /api/schedule/festival/:festivalId` - Programación del festival
- `GET /api/schedule/festival/:festivalId/date/:date` - Programación por fecha
- `GET /api/schedule/festival/:festivalId/stage/:stageId` - Programación por escenario
- `GET /api/schedule/festival/:festivalId/now` - Eventos actuales
- `GET /api/schedule/artist/:artistId` - Programación del artista
- `GET /api/schedule/festival/:festivalId/stats` - Estadísticas de programación

### Artists
- `GET /api/artists` - Listar artistas
- `GET /api/artists/:id` - Obtener artista por ID
- `GET /api/artists/genre/:genre` - Artistas por género
- `GET /api/artists/search/:query` - Buscar artistas
- `GET /api/artists/festival/:festivalId` - Artistas del festival
- `GET /api/artists/stats/overview` - Estadísticas de artistas
- `GET /api/artists/popular` - Artistas populares
- `GET /api/artists/:id/upcoming` - Próximos eventos del artista

### Vendors
- `GET /api/vendors/festival/:festivalId` - Vendedores del festival
- `GET /api/vendors/:id` - Obtener vendedor por ID
- `GET /api/vendors/festival/:festivalId/search` - Buscar vendedores
- `GET /api/vendors/festival/:festivalId/type/:type` - Vendedores por tipo
- `GET /api/vendors/festival/:festivalId/nearby` - Vendedores cercanos
- `PUT /api/vendors/:id/wait-time` - Actualizar tiempo de espera
- `PUT /api/vendors/:id/rating` - Calificar vendedor
- `GET /api/vendors/festival/:festivalId/stats` - Estadísticas de vendedores

### Points of Interest (POIs)
- `GET /api/pois/festival/:festivalId` - POIs del festival
- `GET /api/pois/:id` - Obtener POI por ID
- `GET /api/pois/festival/:festivalId/kind/:kind` - POIs por tipo
- `GET /api/pois/festival/:festivalId/nearby` - POIs cercanos
- `GET /api/pois/festival/:festivalId/search` - Buscar POIs
- `GET /api/pois/festival/:festivalId/stats` - Estadísticas de POIs
- `GET /api/pois/festival/:festivalId/emergency` - POIs de emergencia

### Users
- `GET /api/users/profile` - Perfil del usuario
- `GET /api/users/activity` - Actividad del usuario
- `GET /api/users/presence/:festivalId` - Presencia en festival
- `PUT /api/users/presence/:festivalId` - Actualizar presencia
- `GET /api/users/nearby/:festivalId` - Usuarios cercanos
- `GET /api/users/notifications` - Notificaciones
- `PUT /api/users/notifications/:id/read` - Marcar notificación como leída
- `PUT /api/users/notifications/read-all` - Marcar todas como leídas
- `GET /api/users/favorites` - Favoritos del usuario
- `POST /api/users/favorites/:artistId` - Añadir a favoritos
- `DELETE /api/users/favorites/:artistId` - Eliminar de favoritos

### Widgets
- `GET /api/widgets/festival/:festivalId` - Widgets del festival
- `GET /api/widgets/:id` - Obtener widget por ID
- `PUT /api/widgets/:id/preferences` - Actualizar preferencias
- `GET /api/widgets/festival/:festivalId/preferences` - Preferencias del festival
- `DELETE /api/widgets/festival/:festivalId/preferences` - Eliminar preferencias

### System
- `GET /health` - Health check del servidor

## Troubleshooting

### Problema: "Connection refused"
**Solución**: Verifica que el servidor esté ejecutándose
```bash
npm run dev
```

### Problema: "401 Unauthorized"
**Solución**: 
1. Asegúrate de haber hecho login
2. Copia el token de la respuesta de login
3. Actualiza la variable `auth_token` en el entorno

### Problema: "404 Not Found"
**Solución**: 
1. Verifica que la URL base sea correcta
2. Asegúrate de que el endpoint exista
3. Verifica que el servidor esté ejecutándose en el puerto correcto

### Problema: "500 Internal Server Error"
**Solución**:
1. Revisa los logs del servidor
2. Verifica que la base de datos esté inicializada
3. Asegúrate de que los datos de entrada sean válidos

### Problema: Variables no se actualizan
**Solución**:
1. Asegúrate de estar en el entorno correcto
2. Verifica que las variables estén definidas
3. Reinicia Insomnia si es necesario

## Notas Importantes

1. **Autenticación**: La mayoría de endpoints requieren autenticación. Asegúrate de hacer login primero.

2. **Variables**: Actualiza las variables de entorno según tus datos de prueba.

3. **Datos de Prueba**: Algunos endpoints requieren IDs válidos. Usa los datos de la base de datos de prueba.

4. **Rate Limiting**: El servidor tiene rate limiting. Si recibes errores 429, espera un momento.

5. **CORS**: Asegúrate de que las URLs en las variables de entorno coincidan con la configuración CORS del servidor.

## Próximos Pasos

1. **Personalizar**: Añade tus propios endpoints o modifica los existentes
2. **Automatizar**: Usa Insomnia CLI para automatizar pruebas
3. **Documentar**: Añade descripciones detalladas a cada endpoint
4. **Compartir**: Exporta y comparte la colección con tu equipo

## Soporte

Si tienes problemas con la configuración:
1. Revisa los logs del servidor
2. Verifica la documentación de la API
3. Consulta los issues del repositorio
4. Contacta al equipo de desarrollo

---

**¡Disfruta probando la API de Tiikii Festival!**
