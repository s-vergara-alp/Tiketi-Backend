const express = require('express');
const { asyncHandler, createNotFoundError } = require('../middleware/errorHandler');
const database = require('../database/database');

const router = express.Router();

// Get all POIs for a festival
router.get('/festival/:festivalId', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;
    const { kind } = req.query; // Optional filter by kind

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
        SELECT * FROM points_of_interest 
        WHERE festival_id = ? AND is_active = 1
    `;
    const params = [festivalId];

    if (kind) {
        query += ' AND kind = ?';
        params.push(kind);
    }

    query += ' ORDER BY name ASC';

    const pois = await database.all(query, params);

    // Format POIs
    const formattedPOIs = pois.map(poi => ({
        ...poi,
        location: {
            lat: poi.latitude,
            lon: poi.longitude
        }
    }));

    res.json({
        festivalId,
        festivalName: festival.name,
        pois: formattedPOIs,
        count: formattedPOIs.length
    });
}));

// Get POI by ID
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const poi = await database.get(`
        SELECT poi.*, f.name as festival_name
        FROM points_of_interest poi
        JOIN festivals f ON poi.festival_id = f.id
        WHERE poi.id = ? AND poi.is_active = 1
    `, [id]);

    if (!poi) {
        throw createNotFoundError('Point of interest not found');
    }

    const formattedPOI = {
        ...poi,
        location: {
            lat: poi.latitude,
            lon: poi.longitude
        }
    };

    res.json({
        poi: formattedPOI
    });
}));

// Get POIs by kind
router.get('/festival/:festivalId/kind/:kind', asyncHandler(async (req, res) => {
    const { festivalId, kind } = req.params;

    // Check if festival exists
    const festival = await database.get(
        'SELECT id, name FROM festivals WHERE id = ? AND is_active = 1',
        [festivalId]
    );
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    // Validate POI kind
    const validKinds = ['stage', 'info', 'medic', 'entrance', 'exit', 'water', 'locker', 'lostfound', 'charging', 'restroom'];
    if (!validKinds.includes(kind)) {
        throw createValidationError('Invalid POI kind');
    }

    const pois = await database.all(`
        SELECT * FROM points_of_interest 
        WHERE festival_id = ? AND kind = ? AND is_active = 1
        ORDER BY name ASC
    `, [festivalId, kind]);

    // Format POIs
    const formattedPOIs = pois.map(poi => ({
        ...poi,
        location: {
            lat: poi.latitude,
            lon: poi.longitude
        }
    }));

    res.json({
        festivalId,
        festivalName: festival.name,
        kind,
        pois: formattedPOIs,
        count: formattedPOIs.length
    });
}));

// Get nearby POIs
router.get('/festival/:festivalId/nearby', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;
    const { latitude, longitude, radius = 1000, kind } = req.query; // radius in meters

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
        SELECT * FROM points_of_interest 
        WHERE festival_id = ? AND is_active = 1
        AND (
            (latitude BETWEEN ? - 0.01 AND ? + 0.01) AND
            (longitude BETWEEN ? - 0.01 AND ? + 0.01)
        )
    `;
    const params = [festivalId, parseFloat(latitude), parseFloat(latitude), parseFloat(longitude), parseFloat(longitude)];

    if (kind) {
        query += ' AND kind = ?';
        params.push(kind);
    }

    query += ' ORDER BY name ASC';

    const pois = await database.all(query, params);

    // Calculate distances and filter by radius
    const poisWithDistance = pois
        .map(poi => {
            const distance = calculateDistance(
                parseFloat(latitude), parseFloat(longitude),
                poi.latitude, poi.longitude
            );
            return {
                ...poi,
                distance: Math.round(distance),
                location: {
                    lat: poi.latitude,
                    lon: poi.longitude
                }
            };
        })
        .filter(poi => poi.distance <= radius)
        .sort((a, b) => a.distance - b.distance);

    res.json({
        festivalId,
        festivalName: festival.name,
        location: { lat: parseFloat(latitude), lon: parseFloat(longitude) },
        radius: parseInt(radius),
        kind: kind || 'all',
        pois: poisWithDistance,
        count: poisWithDistance.length
    });
}));

// Search POIs
router.get('/festival/:festivalId/search', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;
    const { query, kind } = req.query;

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
        SELECT * FROM points_of_interest 
        WHERE festival_id = ? AND is_active = 1
    `;
    const params = [festivalId];

    if (query) {
        sqlQuery += ' AND (name LIKE ? OR description LIKE ?)';
        params.push(`%${query}%`, `%${query}%`);
    }

    if (kind) {
        sqlQuery += ' AND kind = ?';
        params.push(kind);
    }

    sqlQuery += ' ORDER BY name ASC';

    const pois = await database.all(sqlQuery, params);

    // Format POIs
    const formattedPOIs = pois.map(poi => ({
        ...poi,
        location: {
            lat: poi.latitude,
            lon: poi.longitude
        }
    }));

    res.json({
        festivalId,
        festivalName: festival.name,
        query: query || '',
        kind: kind || '',
        pois: formattedPOIs,
        count: formattedPOIs.length
    });
}));

// Get POI statistics
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

    // Get statistics by kind
    const stats = await database.all(`
        SELECT 
            kind,
            COUNT(*) as count
        FROM points_of_interest 
        WHERE festival_id = ? AND is_active = 1
        GROUP BY kind
        ORDER BY count DESC
    `, [festivalId]);

    // Get total count
    const totalCount = await database.get(`
        SELECT COUNT(*) as total_pois
        FROM points_of_interest 
        WHERE festival_id = ? AND is_active = 1
    `, [festivalId]);

    res.json({
        festivalId,
        festivalName: festival.name,
        stats: stats.map(stat => ({
            kind: stat.kind,
            count: stat.count
        })),
        totalPOIs: totalCount.total_pois
    });
}));

// Get emergency POIs (medical, security, etc.)
router.get('/festival/:festivalId/emergency', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;

    // Check if festival exists
    const festival = await database.get(
        'SELECT id, name FROM festivals WHERE id = ? AND is_active = 1',
        [festivalId]
    );
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    const emergencyPOIs = await database.all(`
        SELECT * FROM points_of_interest 
        WHERE festival_id = ? AND is_active = 1
        AND kind IN ('medic', 'security', 'info')
        ORDER BY kind ASC, name ASC
    `, [festivalId]);

    // Group by kind
    const groupedPOIs = emergencyPOIs.reduce((acc, poi) => {
        if (!acc[poi.kind]) {
            acc[poi.kind] = [];
        }
        acc[poi.kind].push({
            ...poi,
            location: {
                lat: poi.latitude,
                lon: poi.longitude
            }
        });
        return acc;
    }, {});

    res.json({
        festivalId,
        festivalName: festival.name,
        emergencyPOIs: groupedPOIs
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
