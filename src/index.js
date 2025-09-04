// Load configuration first (which loads environment variables)
const config = require('./config');

const { app, server, io } = require('./app');
const database = require('./database/database');

const PORT = config.PORT;

// Database connection and server startup
async function startServer() {
    try {
        // Connect to database
        await database.connect();
        
        // Check if database is properly set up
        const hasTables = await database.checkDatabase();
        if (!hasTables) {
            console.log('Database not initialized. Please run: npm run db:migrate && npm run db:seed');
            process.exit(1);
        }

        // Start server
        server.listen(PORT, () => {
            console.log('Tiikii Festival API Server iniciado correctamente');
            console.log('Environment:', process.env.NODE_ENV || 'development');
            console.log('Puerto:', PORT);
            console.log('Health check: http://localhost:' + PORT + '/health');
            console.log('API base URL: http://localhost:' + PORT + '/api');
        });

    } catch (error) {
        console.error('Error al iniciar el servidor:', error);
        process.exit(1);
    }
}

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} recibido, cerrando servidor gracefully...`);
    
    try {
        // Close Socket.IO connections
        io.close(() => {
            console.log('Conexiones Socket.IO cerradas');
        });

        // Disconnect from database
        await database.disconnect();
        console.log('Conexión a la base de datos cerrada');

        // Close HTTP server
        server.close(() => {
            console.log('HTTP server cerrado');
            console.log('Shutdown completado exitosamente');
            process.exit(0);
        });

        // Force exit after 30 seconds
        setTimeout(() => {
            console.error('No se pudieron cerrar las conexiones a tiempo, forzando shutdown');
            process.exit(1);
        }, 30000);

    } catch (error) {
        console.error('Error durante el shutdown:', error);
        process.exit(1);
    }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions with enhanced logging
process.on('uncaughtException', (error) => {
    console.error('Excepción no capturada:', error);
    console.error('Process ID:', process.pid);
    console.error('Memory Usage:', process.memoryUsage());
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Rejection no manejado en:', promise);
    console.error('Razón:', reason);
    process.exit(1);
});

// Start the server only when not in test mode
if (process.env.NODE_ENV !== 'test') {
    startServer();
}
