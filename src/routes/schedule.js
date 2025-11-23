const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler, createNotFoundError, createValidationError } = require('../middleware/errorHandler');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const database = require('../database/database');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get schedule for a festival
router.get('/festival/:festivalId', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;
    const { date, stageId } = req.query;

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
        SELECT 
            s.*,
            a.name as artist_name,
            a.bio as artist_bio,
            a.genre as artist_genre,
            a.image_url as artist_image,
            a.social_media as artist_social_media,
            st.name as stage_name,
            st.description as stage_description,
            st.capacity as stage_capacity
        FROM schedule s
        JOIN artists a ON s.artist_id = a.id
        JOIN stages st ON s.stage_id = st.id
        WHERE s.festival_id = ?
    `;
    const params = [festivalId];

    if (date) {
        query += ' AND DATE(s.start_time) = ?';
        params.push(date);
    }

    if (stageId) {
        query += ' AND s.stage_id = ?';
        params.push(stageId);
    }

    query += ' ORDER BY s.start_time ASC';

    const schedule = await database.all(query, params);

    // Format schedule
    const formattedSchedule = schedule.map(slot => ({
        ...slot,
        artist: {
            id: slot.artist_id,
            name: slot.artist_name,
            bio: slot.artist_bio,
            genre: slot.artist_genre,
            imageUrl: slot.artist_image,
            socialMedia: slot.artist_social_media ? JSON.parse(slot.artist_social_media) : {}
        },
        stage: {
            id: slot.stage_id,
            name: slot.stage_name,
            description: slot.stage_description,
            capacity: slot.stage_capacity
        }
    }));

    res.json({
        festivalId,
        festivalName: festival.name,
        schedule: formattedSchedule,
        count: formattedSchedule.length
    });
}));

// Get schedule by date
router.get('/festival/:festivalId/date/:date', asyncHandler(async (req, res) => {
    const { festivalId, date } = req.params;

    // Check if festival exists
    const festival = await database.get(
        'SELECT id, name FROM festivals WHERE id = ? AND is_active = 1',
        [festivalId]
    );
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    const schedule = await database.all(`
        SELECT 
            s.*,
            a.name as artist_name,
            a.bio as artist_bio,
            a.genre as artist_genre,
            a.image_url as artist_image,
            a.social_media as artist_social_media,
            st.name as stage_name,
            st.description as stage_description,
            st.capacity as stage_capacity
        FROM schedule s
        JOIN artists a ON s.artist_id = a.id
        JOIN stages st ON s.stage_id = st.id
        WHERE s.festival_id = ? AND DATE(s.start_time) = ?
        ORDER BY s.start_time ASC
    `, [festivalId, date]);

    // Format schedule
    const formattedSchedule = schedule.map(slot => ({
        ...slot,
        artist: {
            id: slot.artist_id,
            name: slot.artist_name,
            bio: slot.artist_bio,
            genre: slot.artist_genre,
            imageUrl: slot.artist_image,
            socialMedia: slot.artist_social_media ? JSON.parse(slot.artist_social_media) : {}
        },
        stage: {
            id: slot.stage_id,
            name: slot.stage_name,
            description: slot.stage_description,
            capacity: slot.stage_capacity
        }
    }));

    res.json({
        festivalId,
        festivalName: festival.name,
        date,
        schedule: formattedSchedule,
        count: formattedSchedule.length
    });
}));

// Get schedule by stage
router.get('/festival/:festivalId/stage/:stageId', asyncHandler(async (req, res) => {
    const { festivalId, stageId } = req.params;

    // Check if festival exists
    const festival = await database.get(
        'SELECT id, name FROM festivals WHERE id = ? AND is_active = 1',
        [festivalId]
    );
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    // Check if stage exists
    const stage = await database.get(
        'SELECT * FROM stages WHERE id = ? AND festival_id = ?',
        [stageId, festivalId]
    );
    if (!stage) {
        throw createNotFoundError('Stage not found');
    }

    const schedule = await database.all(`
        SELECT 
            s.*,
            a.name as artist_name,
            a.bio as artist_bio,
            a.genre as artist_genre,
            a.image_url as artist_image,
            a.social_media as artist_social_media
        FROM schedule s
        JOIN artists a ON s.artist_id = a.id
        WHERE s.festival_id = ? AND s.stage_id = ?
        ORDER BY s.start_time ASC
    `, [festivalId, stageId]);

    // Format schedule
    const formattedSchedule = schedule.map(slot => ({
        ...slot,
        artist: {
            id: slot.artist_id,
            name: slot.artist_name,
            bio: slot.artist_bio,
            genre: slot.artist_genre,
            imageUrl: slot.artist_image,
            socialMedia: slot.artist_social_media ? JSON.parse(slot.artist_social_media) : {}
        },
        stage: {
            id: stage.id,
            name: stage.name,
            description: stage.description,
            capacity: stage.capacity
        }
    }));

    res.json({
        festivalId,
        festivalName: festival.name,
        stage: {
            id: stage.id,
            name: stage.name,
            description: stage.description,
            capacity: stage.capacity
        },
        schedule: formattedSchedule,
        count: formattedSchedule.length
    });
}));

// Get current and upcoming performances
router.get('/festival/:festivalId/now', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;
    const now = new Date().toISOString();

    // Check if festival exists
    const festival = await database.get(
        'SELECT id, name FROM festivals WHERE id = ? AND is_active = 1',
        [festivalId]
    );
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    // Get current and upcoming performances
    const performances = await database.all(`
        SELECT 
            s.*,
            a.name as artist_name,
            a.bio as artist_bio,
            a.genre as artist_genre,
            a.image_url as artist_image,
            a.social_media as artist_social_media,
            st.name as stage_name,
            st.description as stage_description
        FROM schedule s
        JOIN artists a ON s.artist_id = a.id
        JOIN stages st ON s.stage_id = st.id
        WHERE s.festival_id = ? AND s.end_time > ?
        ORDER BY s.start_time ASC
        LIMIT 10
    `, [festivalId, now]);

    // Format performances and determine status
    const formattedPerformances = performances.map(slot => {
        const startTime = new Date(slot.start_time);
        const endTime = new Date(slot.end_time);
        const now = new Date();
        
        let status = 'upcoming';
        if (now >= startTime && now <= endTime) {
            status = 'now';
        } else if (now < startTime) {
            status = 'upcoming';
        } else {
            status = 'finished';
        }

        return {
            ...slot,
            status,
            artist: {
                id: slot.artist_id,
                name: slot.artist_name,
                bio: slot.artist_bio,
                genre: slot.artist_genre,
                imageUrl: slot.artist_image,
                socialMedia: slot.artist_social_media ? JSON.parse(slot.artist_social_media) : {}
            },
            stage: {
                id: slot.stage_id,
                name: slot.stage_name,
                description: slot.stage_description
            }
        };
    });

    res.json({
        festivalId,
        festivalName: festival.name,
        currentTime: now,
        performances: formattedPerformances
    });
}));

// Get artist schedule
router.get('/artist/:artistId', asyncHandler(async (req, res) => {
    const { artistId } = req.params;

    // Check if artist exists
    const artist = await database.get(
        'SELECT * FROM artists WHERE id = ?',
        [artistId]
    );
    if (!artist) {
        throw createNotFoundError('Artist not found');
    }

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
    `, [artistId]);

    // Format schedule
    const formattedSchedule = schedule.map(slot => ({
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
        schedule: formattedSchedule,
        count: formattedSchedule.length
    });
}));

// Get schedule statistics
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

    // Get statistics
    const [
        totalPerformances,
        uniqueArtists,
        uniqueStages,
        scheduleByDate,
        scheduleByStage
    ] = await Promise.all([
        database.get('SELECT COUNT(*) as count FROM schedule WHERE festival_id = ?', [festivalId]),
        database.get('SELECT COUNT(DISTINCT artist_id) as count FROM schedule WHERE festival_id = ?', [festivalId]),
        database.get('SELECT COUNT(DISTINCT stage_id) as count FROM schedule WHERE festival_id = ?', [festivalId]),
        database.all(`
            SELECT 
                DATE(start_time) as date,
                COUNT(*) as performance_count
            FROM schedule 
            WHERE festival_id = ?
            GROUP BY DATE(start_time)
            ORDER BY date ASC
        `, [festivalId]),
        database.all(`
            SELECT 
                st.name as stage_name,
                COUNT(s.id) as performance_count
            FROM stages st
            LEFT JOIN schedule s ON st.id = s.stage_id AND s.festival_id = ?
            WHERE st.festival_id = ?
            GROUP BY st.id
            ORDER BY performance_count DESC
        `, [festivalId, festivalId])
    ]);

    res.json({
        festivalId,
        festivalName: festival.name,
        stats: {
            totalPerformances: totalPerformances.count,
            uniqueArtists: uniqueArtists.count,
            uniqueStages: uniqueStages.count
        },
        scheduleByDate: scheduleByDate.map(item => ({
            date: item.date,
            performanceCount: item.performance_count
        })),
        scheduleByStage: scheduleByStage.map(item => ({
            stageName: item.stage_name,
            performanceCount: item.performance_count
        }))
    });
}));

// Create schedule entry (Admin only)
router.post('/', authenticateToken, requireAdmin, [
    body('festivalId').trim().isLength({ min: 1 }).withMessage('Festival ID is required'),
    body('artistId').trim().isLength({ min: 1 }).withMessage('Artist ID is required'),
    body('stageId').trim().isLength({ min: 1 }).withMessage('Stage ID is required'),
    body('startTime').isISO8601().withMessage('Start time must be a valid ISO 8601 date'),
    body('endTime').isISO8601().withMessage('End time must be a valid ISO 8601 date'),
    body('title').optional().trim().isLength({ max: 200 }).withMessage('Title must be less than 200 characters')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array()[0].msg);
    }

    const { festivalId, artistId, stageId, title, startTime, endTime } = req.body;

    if (new Date(startTime) >= new Date(endTime)) {
        throw createValidationError('End time must be after start time');
    }

    const festival = await database.get('SELECT id FROM festivals WHERE id = ?', [festivalId]);
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    const artist = await database.get('SELECT id FROM artists WHERE id = ?', [artistId]);
    if (!artist) {
        throw createNotFoundError('Artist not found');
    }

    const stage = await database.get('SELECT id FROM stages WHERE id = ? AND festival_id = ?', [stageId, festivalId]);
    if (!stage) {
        throw createNotFoundError('Stage not found for this festival');
    }

    const scheduleId = uuidv4();
    await database.run(`
        INSERT INTO schedule (id, festival_id, artist_id, stage_id, title, start_time, end_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [scheduleId, festivalId, artistId, stageId, title || null, startTime, endTime]);

    const schedule = await database.get('SELECT * FROM schedule WHERE id = ?', [scheduleId]);

    res.status(201).json({
        message: 'Schedule entry created successfully',
        schedule
    });
}));

module.exports = router;
