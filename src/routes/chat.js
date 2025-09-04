const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { asyncHandler, createValidationError, createNotFoundError } = require('../middleware/errorHandler');
const database = require('../database/database');

const router = express.Router();

// Get user's chat rooms
router.get('/rooms', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const chatRooms = await database.all(`
        SELECT 
            cr.*,
            (SELECT COUNT(*) FROM chat_messages cm 
             WHERE cm.room_id = cr.id 
             AND cm.timestamp > COALESCE(cp.last_read_at, '1970-01-01')) as unread_count,
            (SELECT cm.text FROM chat_messages cm 
             WHERE cm.room_id = cr.id 
             ORDER BY cm.timestamp DESC LIMIT 1) as last_message,
            (SELECT cm.timestamp FROM chat_messages cm 
             WHERE cm.room_id = cr.id 
             ORDER BY cm.timestamp DESC LIMIT 1) as last_message_time
        FROM chat_rooms cr
        JOIN chat_participants cp ON cr.id = cp.room_id
        WHERE cp.user_id = ? AND cr.is_active = 1
        ORDER BY last_message_time DESC NULLS LAST
    `, [userId]);

    res.json(chatRooms.map(room => ({
        ...room,
        unreadCount: room.unread_count || 0,
        lastMessage: room.last_message || '',
        lastMessageTime: room.last_message_time || null
    })));
}));

// Get chat room messages
router.get('/rooms/:roomId/messages', asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Check if user is participant in the room
    const participant = await database.get(
        'SELECT * FROM chat_participants WHERE room_id = ? AND user_id = ?',
        [roomId, userId]
    );
    if (!participant) {
        throw createNotFoundError('Chat room not found');
    }

    // Get messages
    const messages = await database.all(`
        SELECT 
            cm.*,
            u.first_name,
            u.last_name,
            u.avatar
        FROM chat_messages cm
        JOIN users u ON cm.sender_id = u.id
        WHERE cm.room_id = ? AND cm.is_deleted = 0
        ORDER BY cm.timestamp ASC
    `, [roomId]);

    // Update last read timestamp
    await database.run(
        'UPDATE chat_participants SET last_read_at = CURRENT_TIMESTAMP WHERE room_id = ? AND user_id = ?',
        [roomId, userId]
    );

    res.json({
        roomId,
        messages: messages.map(message => ({
            ...message,
            senderName: `${message.first_name} ${message.last_name}`,
            isOwn: message.sender_id === userId
        }))
    });
}));

// Send message
router.post('/rooms/:roomId/messages', [
    body('text')
        .trim()
        .isLength({ min: 1, max: 1000 })
        .withMessage('Message must be between 1 and 1000 characters')
], asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array()[0].msg);
    }

    const { roomId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    // Check if user is participant in the room
    const participant = await database.get(
        'SELECT * FROM chat_participants WHERE room_id = ? AND user_id = ?',
        [roomId, userId]
    );
    if (!participant) {
        throw createNotFoundError('Chat room not found');
    }

    // Create message
    const messageId = uuidv4();
    const result = await database.run(`
        INSERT INTO chat_messages (id, room_id, sender_id, text, timestamp)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [messageId, roomId, userId, text]);

    if (result.changes === 0) {
        throw new Error('Failed to send message');
    }

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

    // Update room's last activity
    await database.run(
        'UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [roomId]
    );

    res.status(201).json({
        message: 'Message sent successfully',
        chatMessage: {
            ...message,
            senderName: `${message.first_name} ${message.last_name}`,
            isOwn: true
        }
    });
}));

// Create private chat room
router.post('/rooms', [
    body('participantId')
        .notEmpty()
        .withMessage('Participant ID is required')
], asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array()[0].msg);
    }

    const { participantId, festivalId } = req.body;
    const userId = req.user.id;

    // Check if participant exists
    const participant = await database.get(
        'SELECT id, first_name, last_name FROM users WHERE id = ?',
        [participantId]
    );
    if (!participant) {
        throw createNotFoundError('Participant not found');
    }

    // Check if private room already exists
    const existingRoom = await database.get(`
        SELECT cr.* FROM chat_rooms cr
        JOIN chat_participants cp1 ON cr.id = cp1.room_id
        JOIN chat_participants cp2 ON cr.id = cp2.room_id
        WHERE cr.type = 'friends' 
        AND cp1.user_id = ? 
        AND cp2.user_id = ?
        AND cr.festival_id = ?
    `, [userId, participantId, festivalId]);

    if (existingRoom) {
        return res.json({
            message: 'Chat room already exists',
            chatRoom: existingRoom
        });
    }

    // Create new private room
    const roomId = uuidv4();
    const roomName = `${participant.first_name} ${participant.last_name}`;

    await database.transaction(async (db) => {
        // Create room
        await db.run(`
            INSERT INTO chat_rooms (id, festival_id, name, type, avatar, created_by)
            VALUES (?, ?, ?, 'friends', '👤', ?)
        `, [roomId, festivalId, roomName, userId]);

        // Add participants
        await db.run(
            'INSERT INTO chat_participants (room_id, user_id) VALUES (?, ?)',
            [roomId, userId]
        );
        await db.run(
            'INSERT INTO chat_participants (room_id, user_id) VALUES (?, ?)',
            [roomId, participantId]
        );
    });

    const newRoom = await database.get(
        'SELECT * FROM chat_rooms WHERE id = ?',
        [roomId]
    );

    res.status(201).json({
        message: 'Chat room created successfully',
        chatRoom: newRoom
    });
}));

// Mark messages as read
router.put('/rooms/:roomId/read', asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Check if user is participant in the room
    const participant = await database.get(
        'SELECT * FROM chat_participants WHERE room_id = ? AND user_id = ?',
        [roomId, userId]
    );
    if (!participant) {
        throw createNotFoundError('Chat room not found');
    }

    // Update last read timestamp
    await database.run(
        'UPDATE chat_participants SET last_read_at = CURRENT_TIMESTAMP WHERE room_id = ? AND user_id = ?',
        [roomId, userId]
    );

    res.json({
        message: 'Messages marked as read'
    });
}));

// Delete message (soft delete)
router.delete('/messages/:messageId', asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Check if message exists and belongs to user
    const message = await database.get(
        'SELECT * FROM chat_messages WHERE id = ? AND sender_id = ?',
        [messageId, userId]
    );
    if (!message) {
        throw createNotFoundError('Message not found');
    }

    // Soft delete message
    await database.run(
        'UPDATE chat_messages SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
        [messageId]
    );

    res.json({
        message: 'Message deleted successfully'
    });
}));

// Edit message
router.put('/messages/:messageId', [
    body('text')
        .trim()
        .isLength({ min: 1, max: 1000 })
        .withMessage('Message must be between 1 and 1000 characters')
], asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array()[0].msg);
    }

    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    // Check if message exists and belongs to user
    const message = await database.get(
        'SELECT * FROM chat_messages WHERE id = ? AND sender_id = ? AND is_deleted = 0',
        [messageId, userId]
    );
    if (!message) {
        throw createNotFoundError('Message not found');
    }

    // Update message
    await database.run(
        'UPDATE chat_messages SET text = ?, is_edited = 1, edited_at = CURRENT_TIMESTAMP WHERE id = ?',
        [text, messageId]
    );

    res.json({
        message: 'Message updated successfully'
    });
}));

module.exports = router;
