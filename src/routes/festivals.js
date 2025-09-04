const express = require('express');
const { asyncHandler, createNotFoundError, createValidationError } = require('../middleware/errorHandler');
const database = require('../database/database');

const router = express.Router();

// Get all festivals
router.get('/', asyncHandler(async (req, res) => {
    const festivals = await database.all(`
        SELECT 
            id, name, description, logo, venue, 
            start_date, end_date,
            latitude, longitude, latitude_delta, longitude_delta,
            primary_color, secondary_color, accent_color, background_color,
            decoration_icons, created_at, updated_at, is_active
        FROM festivals 
        WHERE is_active = 1
        ORDER BY start_date ASC
    `);

    // Parse JSON fields
    const formattedFestivals = festivals.map(festival => ({
        ...festival,
        decoration_icons: festival.decoration_icons ? JSON.parse(festival.decoration_icons) : [],
        location: {
            latitude: festival.latitude,
            longitude: festival.longitude,
            latitudeDelta: festival.latitude_delta,
            longitudeDelta: festival.longitude_delta
        },
        colors: {
            primary: festival.primary_color,
            secondary: festival.secondary_color,
            accent: festival.accent_color,
            background: festival.background_color
        },
        dates: `${new Date(festival.start_date).toLocaleDateString()} - ${new Date(festival.end_date).toLocaleDateString()}`
    }));

    res.json(formattedFestivals);
}));

// Get festival by ID
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const festival = await database.get(`
        SELECT 
            id, name, description, logo, venue, 
            start_date, end_date,
            latitude, longitude, latitude_delta, longitude_delta,
            primary_color, secondary_color, accent_color, background_color,
            decoration_icons, created_at, updated_at, is_active
        FROM festivals 
        WHERE id = ? AND is_active = 1
    `, [id]);

    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    // Get related data
    const [stages, artists, ticketTemplates] = await Promise.all([
        database.all('SELECT * FROM stages WHERE festival_id = ?', [id]),
        database.all(`
            SELECT DISTINCT a.* 
            FROM artists a 
            JOIN schedule s ON a.id = s.artist_id 
            WHERE s.festival_id = ?
        `, [id]),
        database.all('SELECT * FROM ticket_templates WHERE festival_id = ? AND is_available = 1', [id])
    ]);

    // Format the response
    const formattedFestival = {
        ...festival,
        decoration_icons: festival.decoration_icons ? JSON.parse(festival.decoration_icons) : [],
        location: {
            latitude: festival.latitude,
            longitude: festival.longitude,
            latitudeDelta: festival.latitude_delta,
            longitudeDelta: festival.longitude_delta
        },
        colors: {
            primary: festival.primary_color,
            secondary: festival.secondary_color,
            accent: festival.accent_color,
            background: festival.background_color
        },
        dates: `${new Date(festival.start_date).toLocaleDateString()} - ${new Date(festival.end_date).toLocaleDateString()}`,
        stages: stages.map(stage => ({
            ...stage,
            location: {
                lat: stage.latitude,
                lon: stage.longitude
            }
        })),
        artists: artists.map(artist => ({
            ...artist,
            social_media: artist.social_media ? JSON.parse(artist.social_media) : {}
        })),
        ticketTemplates: ticketTemplates.map(template => ({
            ...template,
            benefits: template.benefits ? JSON.parse(template.benefits) : []
        }))
    };

    res.json(formattedFestival);
}));

// Get ticket templates preview for a festival (public, limited info)
router.get('/:id/tickets-preview', asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Input validation and sanitization
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
        throw createValidationError('Invalid festival ID');
    }
    
    // Get festival to ensure it exists and is active
    const festival = await database.get(`
        SELECT id, is_active FROM festivals WHERE id = ?
    `, [id.trim()]);

    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    if (!festival.is_active) {
        throw createValidationError('Festival is not active');
    }

    // Only return basic public information
    const templates = await database.all(`
        SELECT 
            id, name, description, price, currency,
            is_available
        FROM ticket_templates 
        WHERE festival_id = ? AND is_available = 1
        ORDER BY price ASC
    `, [id.trim()]);

    res.json({
        festivalId: id,
        previewOnly: true,
        message: 'Login to see full ticket details and purchase',
        templates: templates
    });
}));

// Get festival statistics
router.get('/:id/stats', asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if festival exists
    const festival = await database.get('SELECT id, name FROM festivals WHERE id = ? AND is_active = 1', [id]);
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    // Get statistics
    const [
        totalTickets,
        activeTickets,
        totalArtists,
        totalStages,
        totalVendors,
        totalPOIs
    ] = await Promise.all([
        database.get('SELECT COUNT(*) as count FROM tickets WHERE festival_id = ?', [id]),
        database.get('SELECT COUNT(*) as count FROM tickets WHERE festival_id = ? AND status = "active"', [id]),
        database.get(`
            SELECT COUNT(DISTINCT a.id) as count 
            FROM artists a 
            JOIN schedule s ON a.id = s.artist_id 
            WHERE s.festival_id = ?
        `, [id]),
        database.get('SELECT COUNT(*) as count FROM stages WHERE festival_id = ?', [id]),
        database.get('SELECT COUNT(*) as count FROM vendors WHERE festival_id = ? AND is_active = 1', [id]),
        database.get('SELECT COUNT(*) as count FROM points_of_interest WHERE festival_id = ? AND is_active = 1', [id])
    ]);

    res.json({
        festivalId: id,
        festivalName: festival.name,
        stats: {
            totalTickets: totalTickets.count,
            activeTickets: activeTickets.count,
            totalArtists: totalArtists.count,
            totalStages: totalStages.count,
            totalVendors: totalVendors.count,
            totalPOIs: totalPOIs.count
        }
    });
}));

// Get festival map data
router.get('/:id/map', asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if festival exists
    const festival = await database.get('SELECT id, name FROM festivals WHERE id = ? AND is_active = 1', [id]);
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    // Get all map-related data
    const [stages, vendors, pois, geofences] = await Promise.all([
        database.all('SELECT * FROM stages WHERE festival_id = ?', [id]),
        database.all('SELECT * FROM vendors WHERE festival_id = ? AND is_active = 1', [id]),
        database.all('SELECT * FROM points_of_interest WHERE festival_id = ? AND is_active = 1', [id]),
        database.all('SELECT * FROM geofences WHERE festival_id = ? AND is_active = 1', [id])
    ]);

    res.json({
        festivalId: id,
        mapData: {
            stages: stages.map(stage => ({
                ...stage,
                location: {
                    lat: stage.latitude,
                    lon: stage.longitude
                }
            })),
            vendors: vendors.map(vendor => ({
                ...vendor,
                location: {
                    lat: vendor.latitude,
                    lon: vendor.longitude
                }
            })),
            pois: pois.map(poi => ({
                ...poi,
                location: {
                    lat: poi.latitude,
                    lon: poi.longitude
                }
            })),
            geofences: geofences.map(geofence => ({
                ...geofence,
                location: {
                    lat: geofence.latitude,
                    lon: geofence.longitude
                }
            }))
        }
    });
}));

// Search festivals
router.get('/search/:query', asyncHandler(async (req, res) => {
    const { query } = req.params;
    const searchTerm = `%${query}%`;

    const festivals = await database.all(`
        SELECT 
            id, name, description, logo, venue, 
            start_date, end_date,
            latitude, longitude, latitude_delta, longitude_delta,
            primary_color, secondary_color, accent_color, background_color,
            decoration_icons, created_at, updated_at, is_active
        FROM festivals 
        WHERE is_active = 1 
        AND (name LIKE ? OR description LIKE ? OR venue LIKE ?)
        ORDER BY start_date ASC
    `, [searchTerm, searchTerm, searchTerm]);

    // Format the response
    const formattedFestivals = festivals.map(festival => ({
        ...festival,
        decoration_icons: festival.decoration_icons ? JSON.parse(festival.decoration_icons) : [],
        location: {
            latitude: festival.latitude,
            longitude: festival.longitude,
            latitudeDelta: festival.latitude_delta,
            longitudeDelta: festival.longitude_delta
        },
        colors: {
            primary: festival.primary_color,
            secondary: festival.secondary_color,
            accent: festival.accent_color,
            background: festival.background_color
        },
        dates: `${new Date(festival.start_date).toLocaleDateString()} - ${new Date(festival.end_date).toLocaleDateString()}`
    }));

    res.json({
        query,
        festivals: formattedFestivals,
        count: formattedFestivals.length
    });
}));

module.exports = router;
