const jwt = require('jsonwebtoken');
const database = require('../database/database');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Store connected users
const connectedUsers = new Map();
const userSockets = new Map();

// Authenticate socket connection
const authenticateSocket = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await database.get(
            'SELECT id, username, first_name, last_name, avatar FROM users WHERE id = ? AND is_active = 1',
            [decoded.userId]
        );

        if (!user) {
            return next(new Error('User not found'));
        }

        socket.userId = user.id;
        socket.user = user;
        next();
    } catch (error) {
        next(new Error('Authentication error'));
    }
};

// Setup socket handlers
const setupSocketHandlers = (io) => {
    // Use authentication middleware
    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.username} (${socket.user.id})`);

        // Store user connection
        connectedUsers.set(socket.userId, {
            id: socket.userId,
            username: socket.user.username,
            firstName: socket.user.first_name,
            lastName: socket.user.last_name,
            avatar: socket.user.avatar,
            socketId: socket.id,
            connectedAt: new Date()
        });

        userSockets.set(socket.userId, socket.id);

        // Join user to their personal room
        socket.join(`user:${socket.userId}`);

        // Handle joining festival room
        socket.on('join-festival', async (data) => {
            const { festivalId } = data;
            
            if (festivalId) {
                socket.join(`festival:${festivalId}`);
                console.log(`User ${socket.user.username} joined festival ${festivalId}`);
                
                // Update user presence
                await updateUserPresence(socket.userId, festivalId, 'online');
                
                // Notify others in the festival
                socket.to(`festival:${festivalId}`).emit('user-joined', {
                    userId: socket.userId,
                    username: socket.user.username,
                    firstName: socket.user.first_name,
                    lastName: socket.user.last_name,
                    avatar: socket.user.avatar
                });
            }
        });

        // Handle leaving festival room
        socket.on('leave-festival', async (data) => {
            const { festivalId } = data;
            
            if (festivalId) {
                socket.leave(`festival:${festivalId}`);
                console.log(`User ${socket.user.username} left festival ${festivalId}`);
                
                // Update user presence
                await updateUserPresence(socket.userId, festivalId, 'offline');
                
                // Notify others in the festival
                socket.to(`festival:${festivalId}`).emit('user-left', {
                    userId: socket.userId,
                    username: socket.user.username
                });
            }
        });

        // Handle joining chat room
        socket.on('join-chat', async (data) => {
            const { roomId } = data;
            
            if (roomId) {
                // Check if user is participant in the room
                const participant = await database.get(
                    'SELECT * FROM chat_participants WHERE room_id = ? AND user_id = ?',
                    [roomId, socket.userId]
                );
                
                if (participant) {
                    socket.join(`chat:${roomId}`);
                    console.log(`User ${socket.user.username} joined chat room ${roomId}`);
                    
                    // Notify others in the chat room
                    socket.to(`chat:${roomId}`).emit('user-joined-chat', {
                        userId: socket.userId,
                        username: socket.user.username,
                        firstName: socket.user.first_name,
                        lastName: socket.user.last_name,
                        avatar: socket.user.avatar,
                        roomId
                    });
                }
            }
        });

        // Handle leaving chat room
        socket.on('leave-chat', (data) => {
            const { roomId } = data;
            
            if (roomId) {
                socket.leave(`chat:${roomId}`);
                console.log(`User ${socket.user.username} left chat room ${roomId}`);
                
                // Notify others in the chat room
                socket.to(`chat:${roomId}`).emit('user-left-chat', {
                    userId: socket.userId,
                    username: socket.user.username,
                    roomId
                });
            }
        });

        // Handle sending chat message
        socket.on('send-message', async (data) => {
            const { roomId, text } = data;
            
            if (!roomId || !text) {
                return;
            }

            try {
                // Check if user is participant in the room
                const participant = await database.get(
                    'SELECT * FROM chat_participants WHERE room_id = ? AND user_id = ?',
                    [roomId, socket.userId]
                );
                
                if (!participant) {
                    return;
                }

                // Create message in database
                const messageId = uuidv4();
                await database.run(`
                    INSERT INTO chat_messages (id, room_id, sender_id, text, timestamp)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, [messageId, roomId, socket.userId, text]);

                // Update room's last activity
                await database.run(
                    'UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [roomId]
                );

                // Get created message with user info
                const message = await database.get(`
                    SELECT 
                        cm.*,
                        u.first_name,
                        u.last_name,
                        u.avatar
                    FROM chat_messages cm
                    JOIN users u ON cm.sender_id = u.id
                    WHERE cm.id = ?
                `, [messageId]);

                const formattedMessage = {
                    ...message,
                    senderName: `${message.first_name} ${message.last_name}`,
                    isOwn: false
                };

                // Broadcast message to chat room
                io.to(`chat:${roomId}`).emit('new-message', {
                    message: formattedMessage,
                    roomId
                });

                // Update unread count for other participants
                await updateUnreadCount(roomId, socket.userId);

            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('message-error', {
                    error: 'Failed to send message'
                });
            }
        });

        // Handle typing indicator
        socket.on('typing', (data) => {
            const { roomId, isTyping } = data;
            
            if (roomId) {
                socket.to(`chat:${roomId}`).emit('user-typing', {
                    userId: socket.userId,
                    username: socket.user.username,
                    isTyping,
                    roomId
                });
            }
        });

        // Handle location updates
        socket.on('update-location', async (data) => {
            const { festivalId, latitude, longitude } = data;
            
            if (festivalId && latitude && longitude) {
                try {
                    await updateUserLocation(socket.userId, festivalId, latitude, longitude);
                    
                    // Broadcast location to festival room
                    socket.to(`festival:${festivalId}`).emit('user-location-updated', {
                        userId: socket.userId,
                        username: socket.user.username,
                        location: { lat: latitude, lon: longitude },
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    console.error('Error updating location:', error);
                }
            }
        });

        // Handle presence updates
        socket.on('update-presence', async (data) => {
            const { festivalId, status } = data;
            
            if (festivalId && status) {
                try {
                    await updateUserPresence(socket.userId, festivalId, status);
                    
                    // Broadcast presence to festival room
                    socket.to(`festival:${festivalId}`).emit('user-presence-updated', {
                        userId: socket.userId,
                        username: socket.user.username,
                        status,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    console.error('Error updating presence:', error);
                }
            }
        });

        // Handle widget updates
        socket.on('widget-update', (data) => {
            const { festivalId, widgetId, data: widgetData } = data;
            
            if (festivalId && widgetId) {
                // Broadcast widget update to festival room
                socket.to(`festival:${festivalId}`).emit('widget-updated', {
                    widgetId,
                    data: widgetData,
                    updatedBy: socket.userId,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Handle emergency notifications
        socket.on('emergency-alert', async (data) => {
            const { festivalId, type, message, location } = data;
            
            if (festivalId && type && message) {
                try {
                    // Create notification in database
                    const notificationId = uuidv4();
                    await database.run(`
                        INSERT INTO notifications (id, user_id, title, body, type, data)
                        VALUES (?, ?, ?, ?, 'emergency', ?)
                    `, [
                        notificationId,
                        socket.userId,
                        `Emergency Alert: ${type}`,
                        message,
                        JSON.stringify({ location, reportedBy: socket.user.username })
                    ]);

                    // Broadcast emergency alert to festival room
                    io.to(`festival:${festivalId}`).emit('emergency-alert', {
                        id: notificationId,
                        type,
                        message,
                        location,
                        reportedBy: socket.user.username,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    console.error('Error creating emergency alert:', error);
                }
            }
        });

        // Handle disconnection
        socket.on('disconnect', async () => {
            console.log(`User disconnected: ${socket.user.username} (${socket.user.id})`);
            
            // Remove from connected users
            connectedUsers.delete(socket.userId);
            userSockets.delete(socket.userId);
            
            // Update presence to offline for all festivals
            await updateUserPresenceOnDisconnect(socket.userId);
        });
    });
};

// Helper function to update user presence
const updateUserPresence = async (userId, festivalId, status) => {
    try {
        const existingPresence = await database.get(
            'SELECT id FROM user_presence WHERE user_id = ? AND festival_id = ?',
            [userId, festivalId]
        );

        if (existingPresence) {
            await database.run(`
                UPDATE user_presence 
                SET status = ?, last_seen = CURRENT_TIMESTAMP
                WHERE user_id = ? AND festival_id = ?
            `, [status, userId, festivalId]);
        } else {
            const presenceId = uuidv4();
            await database.run(`
                INSERT INTO user_presence (id, user_id, festival_id, latitude, longitude, status)
                VALUES (?, ?, ?, 0, 0, ?)
            `, [presenceId, userId, festivalId, status]);
        }
    } catch (error) {
        console.error('Error updating user presence:', error);
    }
};

// Helper function to update user location
const updateUserLocation = async (userId, festivalId, latitude, longitude) => {
    try {
        const existingPresence = await database.get(
            'SELECT id FROM user_presence WHERE user_id = ? AND festival_id = ?',
            [userId, festivalId]
        );

        if (existingPresence) {
            await database.run(`
                UPDATE user_presence 
                SET latitude = ?, longitude = ?, last_seen = CURRENT_TIMESTAMP
                WHERE user_id = ? AND festival_id = ?
            `, [latitude, longitude, userId, festivalId]);
        } else {
            const presenceId = uuidv4();
            await database.run(`
                INSERT INTO user_presence (id, user_id, festival_id, latitude, longitude, status)
                VALUES (?, ?, ?, ?, ?, 'online')
            `, [presenceId, userId, festivalId, latitude, longitude]);
        }
    } catch (error) {
        console.error('Error updating user location:', error);
    }
};

// Helper function to update user presence on disconnect
const updateUserPresenceOnDisconnect = async (userId) => {
    try {
        await database.run(`
            UPDATE user_presence 
            SET status = 'offline', last_seen = CURRENT_TIMESTAMP
            WHERE user_id = ?
        `, [userId]);
    } catch (error) {
        console.error('Error updating user presence on disconnect:', error);
    }
};

// Helper function to update unread count
const updateUnreadCount = async (roomId, senderId) => {
    try {
        // Get all participants except sender
        const participants = await database.all(`
            SELECT user_id FROM chat_participants 
            WHERE room_id = ? AND user_id != ?
        `, [roomId, senderId]);

        // Update last read timestamp for sender
        await database.run(`
            UPDATE chat_participants 
            SET last_read_at = CURRENT_TIMESTAMP
            WHERE room_id = ? AND user_id = ?
        `, [roomId, senderId]);

        // Emit unread count updates to other participants
        participants.forEach(participant => {
            const socketId = userSockets.get(participant.user_id);
            if (socketId) {
                io.to(socketId).emit('unread-count-updated', {
                    roomId,
                    timestamp: new Date().toISOString()
                });
            }
        });
    } catch (error) {
        console.error('Error updating unread count:', error);
    }
};

// Helper function to send notification to user
const sendNotificationToUser = async (userId, title, body, type = 'general', data = {}) => {
    try {
        const notificationId = uuidv4();
        await database.run(`
            INSERT INTO notifications (id, user_id, title, body, type, data)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [notificationId, userId, title, body, type, JSON.stringify(data)]);

        // Send to connected user
        const socketId = userSockets.get(userId);
        if (socketId) {
            io.to(socketId).emit('new-notification', {
                id: notificationId,
                title,
                body,
                type,
                data,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Error sending notification:', error);
    }
};

// Helper function to broadcast to festival
const broadcastToFestival = (festivalId, event, data) => {
    io.to(`festival:${festivalId}`).emit(event, data);
};

// Helper function to get connected users for a festival
const getConnectedUsersForFestival = (festivalId) => {
    return Array.from(connectedUsers.values()).filter(user => 
        user.festivalId === festivalId
    );
};

module.exports = {
    setupSocketHandlers,
    sendNotificationToUser,
    broadcastToFestival,
    getConnectedUsersForFestival,
    connectedUsers,
    userSockets
};
