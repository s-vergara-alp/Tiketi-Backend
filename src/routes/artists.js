const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler, createNotFoundError, createValidationError } = require('../middleware/errorHandler');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const database = require('../database/database');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get all artists
router.get('/', asyncHandler(async (req, res) => {
    const { genre, festivalId } = req.query;

    // Build query
    let query = 'SELECT * FROM artists';
    const params = [];

    if (festivalId) {
        query = `
            SELECT DISTINCT a.* 
            FROM artists a 
            JOIN schedule s ON a.id = s.artist_id 
            WHERE s.festival_id = ?
        `;
        params.push(festivalId);
    }

    if (genre) {
        query += festivalId ? ' AND a.genre = ?' : ' WHERE genre = ?';
        params.push(genre);
    }

    query += ' ORDER BY name ASC';

    const artists = await database.all(query, params);

    // Format artists
    const formattedArtists = artists.map(artist => ({
        ...artist,
        socialMedia: artist.social_media ? JSON.parse(artist.social_media) : {}
    }));

    res.json({
        artists: formattedArtists,
        count: formattedArtists.length
    });
}));

// Get artist by ID
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const artist = await database.get(
        'SELECT * FROM artists WHERE id = ?',
        [id]
    );

    if (!artist) {
        throw createNotFoundError('Artist not found');
    }

    // Get artist's schedule
    const schedule = await database.all(`
        SELECT 
            s.*,
            f.name as festival_name,
            f.logo as festival_logo,
            st.name as stage_name,
            st.description as stage_description
        FROM schedule s
        JOIN festivals f ON s.festival_id = f.id
        JOIN stages st ON s.stage_id = st.id
        WHERE s.artist_id = ? AND f.is_active = 1
        ORDER BY s.start_time ASC
    `, [id]);

    const formattedArtist = {
        ...artist,
        socialMedia: artist.social_media ? JSON.parse(artist.social_media) : {},
        schedule: schedule.map(slot => ({
            ...slot,
            festival: {
                id: slot.festival_id,
                name: slot.festival_name,
                logo: slot.festival_logo
            },
            stage: {
                id: slot.stage_id,
                name: slot.stage_name,
                description: slot.stage_description
            }
        }))
    };

    res.json({
        artist: formattedArtist
    });
}));

// Get artists by genre
router.get('/genre/:genre', asyncHandler(async (req, res) => {
    const { genre } = req.params;
    const { festivalId } = req.query;

    // Build query
    let query = 'SELECT * FROM artists WHERE genre = ?';
    const params = [genre];

    if (festivalId) {
        query = `
            SELECT DISTINCT a.* 
            FROM artists a 
            JOIN schedule s ON a.id = s.artist_id 
            WHERE a.genre = ? AND s.festival_id = ?
        `;
        params.push(genre, festivalId);
    }

    query += ' ORDER BY name ASC';

    const artists = await database.all(query, params);

    // Format artists
    const formattedArtists = artists.map(artist => ({
        ...artist,
        socialMedia: artist.social_media ? JSON.parse(artist.social_media) : {}
    }));

    res.json({
        genre,
        artists: formattedArtists,
        count: formattedArtists.length
    });
}));

// Search artists
router.get('/search/:query', asyncHandler(async (req, res) => {
    const { query } = req.params;
    const { festivalId } = req.query;
    const searchTerm = `%${query}%`;

    // Build search query
    let sqlQuery = `
        SELECT * FROM artists 
        WHERE (name LIKE ? OR bio LIKE ? OR genre LIKE ?)
    `;
    const params = [searchTerm, searchTerm, searchTerm];

    if (festivalId) {
        sqlQuery = `
            SELECT DISTINCT a.* 
            FROM artists a 
            JOIN schedule s ON a.id = s.artist_id 
            WHERE (a.name LIKE ? OR a.bio LIKE ? OR a.genre LIKE ?) 
            AND s.festival_id = ?
        `;
        params.push(searchTerm, searchTerm, searchTerm, festivalId);
    }

    sqlQuery += ' ORDER BY name ASC';

    const artists = await database.all(sqlQuery, params);

    // Format artists
    const formattedArtists = artists.map(artist => ({
        ...artist,
        socialMedia: artist.social_media ? JSON.parse(artist.social_media) : {}
    }));

    res.json({
        query,
        festivalId: festivalId || null,
        artists: formattedArtists,
        count: formattedArtists.length
    });
}));

// Get artists for a specific festival
router.get('/festival/:festivalId', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;
    const { genre } = req.query;

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
        SELECT DISTINCT a.* 
        FROM artists a 
        JOIN schedule s ON a.id = s.artist_id 
        WHERE s.festival_id = ?
    `;
    const params = [festivalId];

    if (genre) {
        query += ' AND a.genre = ?';
        params.push(genre);
    }

    query += ' ORDER BY a.name ASC';

    const artists = await database.all(query, params);

    // Format artists
    const formattedArtists = artists.map(artist => ({
        ...artist,
        socialMedia: artist.social_media ? JSON.parse(artist.social_media) : {}
    }));

    res.json({
        festivalId,
        festivalName: festival.name,
        artists: formattedArtists,
        count: formattedArtists.length
    });
}));

// Get artist statistics
router.get('/stats/overview', asyncHandler(async (req, res) => {
    const { festivalId } = req.query;

    // Build base query
    let baseQuery = 'FROM artists';
    let joinClause = '';
    let whereClause = '';

    if (festivalId) {
        joinClause = 'JOIN schedule s ON a.id = s.artist_id';
        whereClause = 'WHERE s.festival_id = ?';
    }

    // Get statistics
    const [
        totalArtists,
        genres,
        artistsByGenre
    ] = await Promise.all([
        database.get(`SELECT COUNT(*) as count ${baseQuery} ${joinClause} ${whereClause}`, festivalId ? [festivalId] : []),
        database.all(`
            SELECT 
                genre,
                COUNT(*) as count
            ${baseQuery} ${joinClause} ${whereClause}
            GROUP BY genre
            ORDER BY count DESC
        `, festivalId ? [festivalId] : []),
        database.all(`
            SELECT 
                a.genre,
                COUNT(DISTINCT a.id) as artist_count,
                COUNT(s.id) as performance_count
            FROM artists a
            ${festivalId ? 'JOIN schedule s ON a.id = s.artist_id WHERE s.festival_id = ?' : 'LEFT JOIN schedule s ON a.id = s.artist_id'}
            GROUP BY a.genre
            ORDER BY artist_count DESC
        `, festivalId ? [festivalId] : [])
    ]);

    res.json({
        festivalId: festivalId || null,
        stats: {
            totalArtists: totalArtists.count,
            totalGenres: genres.length
        },
        genres: genres.map(genre => ({
            name: genre.genre,
            count: genre.count
        })),
        artistsByGenre: artistsByGenre.map(item => ({
            genre: item.genre,
            artistCount: item.artist_count,
            performanceCount: item.performance_count
        }))
    });
}));

// Get popular artists (by performance count)
router.get('/popular', asyncHandler(async (req, res) => {
    const { festivalId, limit = 10 } = req.query;

    // Build query
    let query = `
        SELECT 
            a.*,
            COUNT(s.id) as performance_count
        FROM artists a
        JOIN schedule s ON a.id = s.artist_id
    `;
    const params = [];

    if (festivalId) {
        query += ' WHERE s.festival_id = ?';
        params.push(festivalId);
    }

    query += `
        GROUP BY a.id
        ORDER BY performance_count DESC
        LIMIT ?
    `;
    params.push(parseInt(limit));

    const artists = await database.all(query, params);

    // Format artists
    const formattedArtists = artists.map(artist => ({
        ...artist,
        socialMedia: artist.social_media ? JSON.parse(artist.social_media) : {},
        performanceCount: artist.performance_count
    }));

    res.json({
        festivalId: festivalId || null,
        limit: parseInt(limit),
        artists: formattedArtists
    });
}));

// Get upcoming performances for an artist
router.get('/:id/upcoming', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const now = new Date().toISOString();

    // Check if artist exists
    const artist = await database.get(
        'SELECT * FROM artists WHERE id = ?',
        [id]
    );
    if (!artist) {
        throw createNotFoundError('Artist not found');
    }

    const upcomingPerformances = await database.all(`
        SELECT 
            s.*,
            f.name as festival_name,
            f.logo as festival_logo,
            st.name as stage_name,
            st.description as stage_description
        FROM schedule s
        JOIN festivals f ON s.festival_id = f.id
        JOIN stages st ON s.stage_id = st.id
        WHERE s.artist_id = ? AND s.start_time > ? AND f.is_active = 1
        ORDER BY s.start_time ASC
        LIMIT 10
    `, [id, now]);

    const formattedPerformances = upcomingPerformances.map(slot => ({
        ...slot,
        festival: {
            id: slot.festival_id,
            name: slot.festival_name,
            logo: slot.festival_logo
        },
        stage: {
            id: slot.stage_id,
            name: slot.stage_name,
            description: slot.stage_description
        }
    }));

    res.json({
        artist: {
            id: artist.id,
            name: artist.name,
            bio: artist.bio,
            genre: artist.genre,
            imageUrl: artist.image_url,
            socialMedia: artist.social_media ? JSON.parse(artist.social_media) : {}
        },
        upcomingPerformances: formattedPerformances,
        count: formattedPerformances.length
    });
}));

// Create artist (Admin only)
router.post('/', authenticateToken, requireAdmin, [
    body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Name is required and must be less than 200 characters'),
    body('genre').optional().trim().isLength({ max: 100 }).withMessage('Genre must be less than 100 characters'),
    body('bio').optional().trim().isLength({ max: 2000 }).withMessage('Bio must be less than 2000 characters'),
    body('imageUrl').optional().isURL().withMessage('Image URL must be a valid URL'),
    body('socialMedia').optional().isObject().withMessage('Social media must be an object')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array()[0].msg);
    }

    const { name, bio, genre, imageUrl, socialMedia } = req.body;

    const artistId = uuidv4();
    const socialMediaJson = socialMedia ? JSON.stringify(socialMedia) : JSON.stringify({});

    await database.run(`
        INSERT INTO artists (id, name, bio, genre, image_url, social_media)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [artistId, name, bio || null, genre || null, imageUrl || null, socialMediaJson]);

    const artist = await database.get('SELECT * FROM artists WHERE id = ?', [artistId]);

    res.status(201).json({
        message: 'Artist created successfully',
        artist: {
            ...artist,
            social_media: artist.social_media ? JSON.parse(artist.social_media) : {}
        }
    });
}));

module.exports = router;
