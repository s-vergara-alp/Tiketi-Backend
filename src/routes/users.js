const express = require('express');
const { asyncHandler, createNotFoundError, createValidationError } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const database = require('../database/database');

const router = express.Router();

// Get user profile
router.get('/profile', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const user = await database.get(`
        SELECT 
            id, username, email, first_name, last_name, 
            avatar, phone, date_of_birth, preferences,
            created_at, updated_at, last_login, is_verified
        FROM users 
        WHERE id = ?
    `, [userId]);

    if (!user) {
        throw createNotFoundError('User not found');
    }

    // Parse preferences
    const formattedUser = {
        ...user,
        preferences: user.preferences ? JSON.parse(user.preferences) : {}
    };

    res.json({
        user: formattedUser
    });
}));

// Get user's festival activity
router.get('/activity', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Get user's tickets
    const tickets = await database.all(`
        SELECT 
            t.*,
            f.name as festival_name,
            f.logo as festival_logo,
            f.start_date as festival_start
        FROM tickets t
        JOIN festivals f ON t.festival_id = f.id
        WHERE t.user_id = ?
        ORDER BY t.purchase_date DESC
        LIMIT 10
    `, [userId]);

    // Get user's chat activity
    const chatActivity = await database.all(`
        SELECT 
            cr.name as room_name,
            cr.type as room_type,
            COUNT(cm.id) as message_count,
            MAX(cm.timestamp) as last_activity
        FROM chat_participants cp
        JOIN chat_rooms cr ON cp.room_id = cr.id
        LEFT JOIN chat_messages cm ON cr.id = cm.room_id
        WHERE cp.user_id = ?
        GROUP BY cr.id
        ORDER BY last_activity DESC
        LIMIT 5
    `, [userId]);

    // Get user's favorites
    const favorites = await database.all(`
        SELECT 
            a.*,
            f.name as festival_name
        FROM user_favorites uf
        JOIN artists a ON uf.artist_id = a.id
        JOIN schedule s ON a.id = s.artist_id
        JOIN festivals f ON s.festival_id = f.id
        WHERE uf.user_id = ?
        ORDER BY uf.created_at DESC
        LIMIT 10
    `, [userId]);

    res.json({
        tickets: tickets.map(ticket => ({
            ...ticket,
            festivalName: ticket.festival_name,
            festivalLogo: ticket.festival_logo,
            festivalStart: ticket.festival_start
        })),
        chatActivity: chatActivity.map(activity => ({
            ...activity,
            lastActivity: activity.last_activity
        })),
        favorites: favorites.map(artist => ({
            ...artist,
            festivalName: artist.festival_name,
            socialMedia: artist.social_media ? JSON.parse(artist.social_media) : {}
        }))
    });
}));

// Get user's presence data
router.get('/presence/:festivalId', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;
    const userId = req.user.id;

    const presence = await database.get(`
        SELECT * FROM user_presence 
        WHERE user_id = ? AND festival_id = ?
        ORDER BY last_seen DESC
        LIMIT 1
    `, [userId, festivalId]);

    res.json({
        presence: presence ? {
            ...presence,
            location: {
                lat: presence.latitude,
                lon: presence.longitude
            }
        } : null
    });
}));

// Update user presence
router.put('/presence/:festivalId', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;
    const { latitude, longitude, status = 'online' } = req.body;
    const userId = req.user.id;

    // Check if festival exists
    const festival = await database.get(
        'SELECT id FROM festivals WHERE id = ? AND is_active = 1',
        [festivalId]
    );
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    // Check if presence record exists
    const existingPresence = await database.get(
        'SELECT id FROM user_presence WHERE user_id = ? AND festival_id = ?',
        [userId, festivalId]
    );

    if (existingPresence) {
        // Update existing presence
        await database.run(`
            UPDATE user_presence 
            SET latitude = ?, longitude = ?, status = ?, last_seen = CURRENT_TIMESTAMP
            WHERE user_id = ? AND festival_id = ?
        `, [latitude, longitude, status, userId, festivalId]);
    } else {
        // Create new presence record
        const presenceId = require('uuid').v4();
        await database.run(`
            INSERT INTO user_presence (id, user_id, festival_id, latitude, longitude, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [presenceId, userId, festivalId, latitude, longitude, status]);
    }

    res.json({
        message: 'Presence updated successfully'
    });
}));

// Get nearby users
router.get('/nearby/:festivalId', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;
    const { latitude, longitude, radius = 1000 } = req.query; // radius in meters
    const userId = req.user.id;

    if (!latitude || !longitude) {
        throw createValidationError('Latitude and longitude are required');
    }

    // Get nearby users using simple distance calculation
    // In production, you might want to use a more sophisticated geospatial query
    const nearbyUsers = await database.all(`
        SELECT 
            up.*,
            u.first_name,
            u.last_name,
            u.avatar,
            u.username,
            mi.fingerprint as mesh_fingerprint,
            mi.nickname as mesh_nickname
        FROM user_presence up
        JOIN users u ON up.user_id = u.id
        LEFT JOIN mesh_identities mi ON up.user_id = mi.user_id AND mi.festival_id = ? AND mi.is_active = 1
        WHERE up.festival_id = ? 
        AND up.user_id != ?
        AND up.status = 'online'
        AND (
            (up.latitude BETWEEN ? - 0.01 AND ? + 0.01) AND
            (up.longitude BETWEEN ? - 0.01 AND ? + 0.01)
        )
        ORDER BY up.last_seen DESC
        LIMIT 50
    `, [festivalId, festivalId, userId, parseFloat(latitude), parseFloat(latitude), parseFloat(longitude), parseFloat(longitude)]);

    // Calculate actual distances and filter by radius
    const usersWithDistance = nearbyUsers
        .map(user => {
            const distance = calculateDistance(
                parseFloat(latitude), parseFloat(longitude),
                user.latitude, user.longitude
            );
            return {
                ...user,
                distance: Math.round(distance),
                location: {
                    lat: user.latitude,
                    lon: user.longitude
                },
                meshFingerprint: user.mesh_fingerprint || null,
                meshNickname: user.mesh_nickname || null
            };
        })
        .filter(user => user.distance <= radius)
        .sort((a, b) => a.distance - b.distance);

    res.json({
        nearbyUsers: usersWithDistance,
        userCount: usersWithDistance.length
    });
}));

// Get user's notifications
router.get('/notifications', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const notifications = await database.all(`
        SELECT * FROM notifications 
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), parseInt(offset)]);

    const formattedNotifications = notifications.map(notification => ({
        ...notification,
        data: notification.data ? JSON.parse(notification.data) : {}
    }));

    res.json({
        notifications: formattedNotifications
    });
}));

// Mark notification as read
router.put('/notifications/:id/read', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await database.run(
        'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
        [id, userId]
    );

    if (result.changes === 0) {
        throw createNotFoundError('Notification not found');
    }

    res.json({
        message: 'Notification marked as read'
    });
}));

// Mark all notifications as read
router.put('/notifications/read-all', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    await database.run(
        'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
        [userId]
    );

    res.json({
        message: 'All notifications marked as read'
    });
}));

// Get user's favorites
router.get('/favorites', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const favorites = await database.all(`
        SELECT 
            a.*,
            f.name as festival_name,
            f.id as festival_id
        FROM user_favorites uf
        JOIN artists a ON uf.artist_id = a.id
        JOIN schedule s ON a.id = s.artist_id
        JOIN festivals f ON s.festival_id = f.id
        WHERE uf.user_id = ?
        ORDER BY uf.created_at DESC
    `, [userId]);

    const formattedFavorites = favorites.map(artist => ({
        ...artist,
        festivalName: artist.festival_name,
        festivalId: artist.festival_id,
        socialMedia: artist.social_media ? JSON.parse(artist.social_media) : {}
    }));

    res.json({
        favorites: formattedFavorites
    });
}));

// Add artist to favorites
router.post('/favorites/:artistId', asyncHandler(async (req, res) => {
    const { artistId } = req.params;
    const userId = req.user.id;

    // Check if artist exists
    const artist = await database.get(
        'SELECT id FROM artists WHERE id = ?',
        [artistId]
    );
    if (!artist) {
        throw createNotFoundError('Artist not found');
    }

    // Check if already favorited
    const existingFavorite = await database.get(
        'SELECT * FROM user_favorites WHERE user_id = ? AND artist_id = ?',
        [userId, artistId]
    );
    if (existingFavorite) {
        return res.json({
            message: 'Artist already in favorites'
        });
    }

    // Add to favorites
    await database.run(
        'INSERT INTO user_favorites (user_id, artist_id) VALUES (?, ?)',
        [userId, artistId]
    );

    res.status(201).json({
        message: 'Artist added to favorites'
    });
}));

// Remove artist from favorites
router.delete('/favorites/:artistId', asyncHandler(async (req, res) => {
    const { artistId } = req.params;
    const userId = req.user.id;

    const result = await database.run(
        'DELETE FROM user_favorites WHERE user_id = ? AND artist_id = ?',
        [userId, artistId]
    );

    if (result.changes === 0) {
        throw createNotFoundError('Favorite not found');
    }

    res.json({
        message: 'Artist removed from favorites'
    });
}));

// Promote user to admin (only if no admins exist - for initial setup)
router.post('/promote-to-admin', authenticateToken, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    
    const adminCount = await database.get('SELECT COUNT(*) as count FROM users WHERE is_admin = 1 OR role = "admin"');
    
    if (adminCount.count > 0) {
        throw createValidationError('Admin users already exist. This endpoint is only for initial setup.');
    }
    
    await database.run(`
        UPDATE users 
        SET is_admin = 1, role = 'admin', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [userId]);
    
    const updatedUser = await database.get(
        'SELECT id, username, email, first_name, last_name, is_admin, role FROM users WHERE id = ?',
        [userId]
    );
    
    res.json({
        message: 'User promoted to admin successfully',
        user: updatedUser
    });
}));

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

module.exports = router;
