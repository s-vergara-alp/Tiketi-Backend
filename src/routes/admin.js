const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, requireRole } = require('../middleware/auth');
const database = require('../database/database');

const router = express.Router();

/**
 * @route GET /api/admin/stats
 * @desc Get admin dashboard statistics
 * @access Admin/Staff/Security only
 */
router.get('/stats', authenticateToken, requireRole(['admin', 'staff', 'security']), asyncHandler(async (req, res) => {
    const { festivalId } = req.query;

    // Get total attendees (active users for festival)
    let totalAttendees = 0;
    if (festivalId) {
        const attendeesResult = await database.get(`
            SELECT COUNT(DISTINCT user_id) as count
            FROM user_presence
            WHERE festival_id = ? AND is_active = 1
        `, [festivalId]);
        totalAttendees = attendeesResult?.count || 0;
    } else {
        const attendeesResult = await database.get(`
            SELECT COUNT(DISTINCT id) as count
            FROM users
            WHERE is_active = 1
        `);
        totalAttendees = attendeesResult?.count || 0;
    }

    // Get tickets sold
    let ticketsSold = 0;
    if (festivalId) {
        const ticketsResult = await database.get(`
            SELECT COUNT(*) as count
            FROM tickets
            WHERE festival_id = ?
        `, [festivalId]);
        ticketsSold = ticketsResult?.count || 0;
    } else {
        const ticketsResult = await database.get(`
            SELECT COUNT(*) as count
            FROM tickets
        `);
        ticketsSold = ticketsResult?.count || 0;
    }

    // Get tickets validated
    let ticketsValidated = 0;
    if (festivalId) {
        const validatedResult = await database.get(`
            SELECT COUNT(DISTINCT ticket_id) as count
            FROM ticket_validations
            WHERE festival_id = ?
        `, [festivalId]);
        ticketsValidated = validatedResult?.count || 0;
    } else {
        const validatedResult = await database.get(`
            SELECT COUNT(DISTINCT ticket_id) as count
            FROM ticket_validations
        `);
        ticketsValidated = validatedResult?.count || 0;
    }

    // Get active mesh connections (approximate from BLE sessions)
    let activeMeshConnections = 0;
    if (festivalId) {
        const meshResult = await database.get(`
            SELECT COUNT(DISTINCT user_id) as count
            FROM ble_sessions
            WHERE festival_id = ? AND expires_at > datetime('now')
        `, [festivalId]);
        activeMeshConnections = meshResult?.count || 0;
    } else {
        const meshResult = await database.get(`
            SELECT COUNT(DISTINCT user_id) as count
            FROM ble_sessions
            WHERE expires_at > datetime('now')
        `);
        activeMeshConnections = meshResult?.count || 0;
    }

    // Get festival status
    let festivalStatus = 'inactive';
    if (festivalId) {
        const festival = await database.get(`
            SELECT start_date, end_date, is_active
            FROM festivals
            WHERE id = ?
        `, [festivalId]);
        
        if (festival) {
            const now = new Date();
            const startDate = new Date(festival.start_date);
            const endDate = new Date(festival.end_date);
            
            if (festival.is_active === 1) {
                if (now >= startDate && now <= endDate) {
                    festivalStatus = 'active';
                } else if (now < startDate) {
                    festivalStatus = 'upcoming';
                } else {
                    festivalStatus = 'ended';
                }
            }
        }
    }

    res.json({
        stats: {
            totalAttendees,
            ticketsSold,
            ticketsValidated,
            activeMeshConnections,
            festivalStatus
        }
    });
}));

/**
 * @route GET /api/admin/metrics
 * @desc Get system metrics
 * @access Admin/Staff only
 */
router.get('/metrics', authenticateToken, requireRole(['admin', 'staff']), asyncHandler(async (req, res) => {
    // Placeholder for system metrics
    // In a real implementation, you'd track API response times, error rates, etc.
    res.json({
        apiResponseTime: 150,
        errorRate: 0.5,
        databasePerformance: 'good',
        uptime: process.uptime()
    });
}));

module.exports = router;

