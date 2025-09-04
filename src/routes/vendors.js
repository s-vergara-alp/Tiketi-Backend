const express = require('express');
const { asyncHandler, createNotFoundError } = require('../middleware/errorHandler');
const database = require('../database/database');

const router = express.Router();

// Get all vendors for a festival
router.get('/festival/:festivalId', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;
    const { type } = req.query; // Optional filter by type

    // Check if festival exists
    const festival = await database.get(
        'SELECT id, name FROM festivals WHERE id = ? AND is_active = 1',
        [festivalId]
    );
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    // Build query
    let query = `
        SELECT * FROM vendors 
        WHERE festival_id = ? AND is_active = 1
    `;
    const params = [festivalId];

    if (type) {
        query += ' AND type = ?';
        params.push(type);
    }

    query += ' ORDER BY name ASC';

    const vendors = await database.all(query, params);

    // Format vendors
    const formattedVendors = vendors.map(vendor => ({
        ...vendor,
        location: {
            lat: vendor.latitude,
            lon: vendor.longitude
        }
    }));

    res.json({
        festivalId,
        festivalName: festival.name,
        vendors: formattedVendors,
        count: formattedVendors.length
    });
}));

// Get vendor by ID
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const vendor = await database.get(`
        SELECT v.*, f.name as festival_name
        FROM vendors v
        JOIN festivals f ON v.festival_id = f.id
        WHERE v.id = ? AND v.is_active = 1
    `, [id]);

    if (!vendor) {
        throw createNotFoundError('Vendor not found');
    }

    const formattedVendor = {
        ...vendor,
        location: {
            lat: vendor.latitude,
            lon: vendor.longitude
        }
    };

    res.json({
        vendor: formattedVendor
    });
}));

// Search vendors
router.get('/festival/:festivalId/search', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;
    const { query, type } = req.query;

    // Check if festival exists
    const festival = await database.get(
        'SELECT id, name FROM festivals WHERE id = ? AND is_active = 1',
        [festivalId]
    );
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    // Build search query
    let sqlQuery = `
        SELECT * FROM vendors 
        WHERE festival_id = ? AND is_active = 1
    `;
    const params = [festivalId];

    if (query) {
        sqlQuery += ' AND (name LIKE ? OR description LIKE ?)';
        params.push(`%${query}%`, `%${query}%`);
    }

    if (type) {
        sqlQuery += ' AND type = ?';
        params.push(type);
    }

    sqlQuery += ' ORDER BY rating DESC, name ASC';

    const vendors = await database.all(sqlQuery, params);

    // Format vendors
    const formattedVendors = vendors.map(vendor => ({
        ...vendor,
        location: {
            lat: vendor.latitude,
            lon: vendor.longitude
        }
    }));

    res.json({
        festivalId,
        festivalName: festival.name,
        query: query || '',
        type: type || '',
        vendors: formattedVendors,
        count: formattedVendors.length
    });
}));

// Get vendors by type
router.get('/festival/:festivalId/type/:type', asyncHandler(async (req, res) => {
    const { festivalId, type } = req.params;

    // Check if festival exists
    const festival = await database.get(
        'SELECT id, name FROM festivals WHERE id = ? AND is_active = 1',
        [festivalId]
    );
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    // Validate vendor type
    const validTypes = ['food', 'drink', 'merch', 'atm', 'restroom', 'charging', 'medical', 'security'];
    if (!validTypes.includes(type)) {
        throw createValidationError('Invalid vendor type');
    }

    const vendors = await database.all(`
        SELECT * FROM vendors 
        WHERE festival_id = ? AND type = ? AND is_active = 1
        ORDER BY rating DESC, name ASC
    `, [festivalId, type]);

    // Format vendors
    const formattedVendors = vendors.map(vendor => ({
        ...vendor,
        location: {
            lat: vendor.latitude,
            lon: vendor.longitude
        }
    }));

    res.json({
        festivalId,
        festivalName: festival.name,
        type,
        vendors: formattedVendors,
        count: formattedVendors.length
    });
}));

// Get nearby vendors
router.get('/festival/:festivalId/nearby', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;
    const { latitude, longitude, radius = 1000, type } = req.query; // radius in meters

    if (!latitude || !longitude) {
        throw createValidationError('Latitude and longitude are required');
    }

    // Check if festival exists
    const festival = await database.get(
        'SELECT id, name FROM festivals WHERE id = ? AND is_active = 1',
        [festivalId]
    );
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    // Build query
    let query = `
        SELECT * FROM vendors 
        WHERE festival_id = ? AND is_active = 1
        AND (
            (latitude BETWEEN ? - 0.01 AND ? + 0.01) AND
            (longitude BETWEEN ? - 0.01 AND ? + 0.01)
        )
    `;
    const params = [festivalId, parseFloat(latitude), parseFloat(latitude), parseFloat(longitude), parseFloat(longitude)];

    if (type) {
        query += ' AND type = ?';
        params.push(type);
    }

    query += ' ORDER BY rating DESC';

    const vendors = await database.all(query, params);

    // Calculate distances and filter by radius
    const vendorsWithDistance = vendors
        .map(vendor => {
            const distance = calculateDistance(
                parseFloat(latitude), parseFloat(longitude),
                vendor.latitude, vendor.longitude
            );
            return {
                ...vendor,
                distance: Math.round(distance),
                location: {
                    lat: vendor.latitude,
                    lon: vendor.longitude
                }
            };
        })
        .filter(vendor => vendor.distance <= radius)
        .sort((a, b) => a.distance - b.distance);

    res.json({
        festivalId,
        festivalName: festival.name,
        location: { lat: parseFloat(latitude), lon: parseFloat(longitude) },
        radius: parseInt(radius),
        type: type || 'all',
        vendors: vendorsWithDistance,
        count: vendorsWithDistance.length
    });
}));

// Update vendor wait time (for real-time updates)
router.put('/:id/wait-time', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { waitTime } = req.body;

    if (waitTime === undefined || waitTime < 0) {
        throw createValidationError('Valid wait time is required');
    }

    const result = await database.run(
        'UPDATE vendors SET wait_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [waitTime, id]
    );

    if (result.changes === 0) {
        throw createNotFoundError('Vendor not found');
    }

    res.json({
        message: 'Wait time updated successfully',
        vendorId: id,
        waitTime
    });
}));

// Update vendor rating
router.put('/:id/rating', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rating } = req.body;

    if (rating === undefined || rating < 0 || rating > 5) {
        throw createValidationError('Rating must be between 0 and 5');
    }

    const result = await database.run(
        'UPDATE vendors SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [rating, id]
    );

    if (result.changes === 0) {
        throw createNotFoundError('Vendor not found');
    }

    res.json({
        message: 'Rating updated successfully',
        vendorId: id,
        rating
    });
}));

// Get vendor statistics
router.get('/festival/:festivalId/stats', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;

    // Check if festival exists
    const festival = await database.get(
        'SELECT id, name FROM festivals WHERE id = ? AND is_active = 1',
        [festivalId]
    );
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    // Get statistics by type
    const stats = await database.all(`
        SELECT 
            type,
            COUNT(*) as count,
            AVG(rating) as avg_rating,
            AVG(wait_time) as avg_wait_time
        FROM vendors 
        WHERE festival_id = ? AND is_active = 1
        GROUP BY type
        ORDER BY count DESC
    `, [festivalId]);

    // Get total statistics
    const totalStats = await database.get(`
        SELECT 
            COUNT(*) as total_vendors,
            AVG(rating) as overall_avg_rating,
            AVG(wait_time) as overall_avg_wait_time
        FROM vendors 
        WHERE festival_id = ? AND is_active = 1
    `, [festivalId]);

    res.json({
        festivalId,
        festivalName: festival.name,
        stats: stats.map(stat => ({
            type: stat.type,
            count: stat.count,
            avgRating: Math.round(stat.avg_rating * 10) / 10,
            avgWaitTime: Math.round(stat.avg_wait_time)
        })),
        totalStats: {
            totalVendors: totalStats.total_vendors,
            overallAvgRating: Math.round(totalStats.overall_avg_rating * 10) / 10,
            overallAvgWaitTime: Math.round(totalStats.overall_avg_wait_time)
        }
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
