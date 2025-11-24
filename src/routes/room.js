const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { asyncHandler, createValidationError, createNotFoundError } = require('../middleware/errorHandler');
const database = require('../database/database');
const { v4: uuidv4 } = require('uuid');

router.get('/list', authenticateToken, asyncHandler(async (req, res) => {
    const isAdmin = req.user.is_admin === 1 || req.user.role === 'admin';
    
    let rooms;
    if (isAdmin) {
        rooms = await database.all(`
            SELECT 
                id as id,
                name as name,
                description as description,
                location as location,
                status as status,
                ble_address as bleAddress,
                ble_name as bleName,
                created_at as createdAt,
                updated_at as updatedAt
            FROM door_locks
            ORDER BY name ASC
        `);
    } else {
        rooms = await database.all(`
            SELECT 
                id as id,
                name as name,
                description as description,
                location as location,
                status as status,
                ble_address as bleAddress,
                ble_name as bleName,
                created_at as createdAt,
                updated_at as updatedAt
            FROM door_locks
            WHERE id IN (
                SELECT DISTINCT room_id 
                FROM room_permissions 
                WHERE user_id = ?
            )
            ORDER BY name ASC
        `, [req.user.id]);
    }

    const formattedRooms = rooms.map(room => ({
        id: room.id,
        name: room.name,
        description: room.description || undefined,
        location: room.location || undefined,
        status: room.status || 'unknown',
        bleAddress: room.bleAddress || undefined
    }));

    res.json({ rooms: formattedRooms });
}));

router.get('/:roomId/status', authenticateToken, asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;

    const isAdmin = req.user.is_admin === 1 || req.user.role === 'admin';
    
    let hasPermission = isAdmin;
    if (!hasPermission) {
        const permission = await database.get(`
            SELECT 1 FROM room_permissions 
            WHERE user_id = ? AND room_id = ?
        `, [userId, roomId]);
        hasPermission = !!permission;
    }

    if (!hasPermission) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    const lock = await database.get(`
        SELECT 
            id,
            status,
            ble_address,
            updated_at
        FROM door_locks
        WHERE id = ?
    `, [roomId]);

    if (!lock) {
        return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
        roomId: lock.id,
        status: lock.status || 'unknown',
        lastUpdated: lock.updated_at || new Date().toISOString(),
        bleConnected: false
    });
}));

router.post('/unlock/log', authenticateToken, asyncHandler(async (req, res) => {
    const { roomId, success } = req.body;
    const userId = req.user.id;

    if (!roomId) {
        return res.status(400).json({ error: 'roomId is required' });
    }

    const isAdmin = req.user.is_admin === 1 || req.user.role === 'admin';
    
    let hasPermission = isAdmin;
    if (!hasPermission) {
        const permission = await database.get(`
            SELECT 1 FROM room_permissions 
            WHERE user_id = ? AND room_id = ?
        `, [userId, roomId]);
        hasPermission = !!permission;
    }

    if (!hasPermission) {
        await logUnlockAttempt(userId, roomId, false, 'Permission denied');
        return res.status(403).json({ 
            success: false,
            message: 'Permission denied'
        });
    }

    const lock = await database.get(`
        SELECT id FROM door_locks WHERE id = ?
    `, [roomId]);

    if (!lock) {
        await logUnlockAttempt(userId, roomId, false, 'Room not found');
        return res.status(404).json({
            success: false,
            message: 'Room not found'
        });
    }

    await logUnlockAttempt(userId, roomId, success === true, 
        success ? 'Door unlocked successfully via BLE' : 'Door unlock failed via BLE');
    
    if (success) {
        await database.run(`
            UPDATE door_locks 
            SET status = 'unlocked', updated_at = datetime('now')
            WHERE id = ?
        `, [roomId]);
    }

    res.json({
        success: true,
        message: 'Unlock attempt logged'
    });
}));

router.post('/:roomId/register', authenticateToken, requireRole(['admin']), asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const { roomName, description, location, bleAddress, bleName } = req.body;

    if (!roomName || !bleAddress) {
        return res.status(400).json({ 
            error: 'roomName and bleAddress are required' 
        });
    }

    const existing = await database.get(`
        SELECT id FROM door_locks WHERE id = ?
    `, [roomId]);

    if (existing) {
        await database.run(`
            UPDATE door_locks
            SET name = ?,
                description = ?,
                location = ?,
                ble_address = ?,
                ble_name = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `, [roomName, description || null, location || null, bleAddress, bleName || null, roomId]);
    } else {
        await database.run(`
            INSERT INTO door_locks (id, name, description, location, ble_address, ble_name, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'unknown', datetime('now'), datetime('now'))
        `, [roomId, roomName, description || null, location || null, bleAddress, bleName || null]);
    }

    res.json({
        success: true,
        message: 'Door lock registered successfully',
        lock: {
            roomId,
            roomName,
            bleAddress
        }
    });
}));

router.post('/:roomId/permission', authenticateToken, requireRole(['admin']), asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    const existing = await database.get(`
        SELECT 1 FROM room_permissions 
        WHERE user_id = ? AND room_id = ?
    `, [userId, roomId]);

    if (!existing) {
        await database.run(`
            INSERT INTO room_permissions (id, user_id, room_id, created_at)
            VALUES (?, ?, ?, datetime('now'))
        `, [uuidv4(), userId, roomId]);
    }

    res.json({
        success: true,
        message: `Permission granted to user ${userId} for room ${roomId}`
    });
}));

router.delete('/:roomId/permission/:userId', authenticateToken, requireRole(['admin']), asyncHandler(async (req, res) => {
    const { roomId, userId } = req.params;

    await database.run(`
        DELETE FROM room_permissions
        WHERE user_id = ? AND room_id = ?
    `, [userId, roomId]);

    res.json({
        success: true,
        message: `Permission revoked from user ${userId} for room ${roomId}`
    });
}));


async function logUnlockAttempt(userId, roomId, success, message) {
    try {
        await database.run(`
            INSERT INTO unlock_logs (id, user_id, room_id, success, message, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `, [uuidv4(), userId, roomId, success ? 1 : 0, message]);
    } catch (error) {
        console.error('Error logging unlock attempt:', error);
    }
}

module.exports = router;
