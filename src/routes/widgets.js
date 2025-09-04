const express = require('express');
const { asyncHandler, createNotFoundError } = require('../middleware/errorHandler');
const database = require('../database/database');

const router = express.Router();

// Get widgets for a festival
router.get('/festival/:festivalId', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;
    const userId = req.query.userId; // Optional user ID for personalized widgets

    // Check if festival exists
    const festival = await database.get(
        'SELECT id, name FROM festivals WHERE id = ? AND is_active = 1',
        [festivalId]
    );
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    // Get widgets
    const widgets = await database.all(`
        SELECT * FROM widgets 
        WHERE festival_id = ? AND is_active = 1
        ORDER BY order_index ASC, priority DESC
    `, [festivalId]);

    // Get user preferences if userId is provided
    let userPreferences = {};
    if (userId) {
        const preferences = await database.all(`
            SELECT widget_id, is_enabled, order_index, custom_settings
            FROM user_widget_preferences 
            WHERE user_id = ?
        `, [userId]);
        
        userPreferences = preferences.reduce((acc, pref) => {
            acc[pref.widget_id] = {
                isEnabled: pref.is_enabled,
                orderIndex: pref.order_index,
                customSettings: pref.custom_settings ? JSON.parse(pref.custom_settings) : {}
            };
            return acc;
        }, {});
    }

    // Format widgets
    const formattedWidgets = widgets.map(widget => {
        const userPref = userPreferences[widget.id] || {};
        return {
            ...widget,
            content: widget.content ? JSON.parse(widget.content) : {},
            isEnabled: userPref.isEnabled !== undefined ? userPref.isEnabled : true,
            orderIndex: userPref.orderIndex !== undefined ? userPref.orderIndex : widget.order_index,
            customSettings: userPref.customSettings || {}
        };
    });

    res.json({
        festivalId,
        festivalName: festival.name,
        widgets: formattedWidgets
    });
}));

// Get specific widget
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.query.userId; // Optional user ID

    const widget = await database.get(`
        SELECT w.*, f.name as festival_name
        FROM widgets w
        JOIN festivals f ON w.festival_id = f.id
        WHERE w.id = ? AND w.is_active = 1
    `, [id]);

    if (!widget) {
        throw createNotFoundError('Widget not found');
    }

    // Get user preferences if userId is provided
    let userPreferences = {};
    if (userId) {
        const preference = await database.get(`
            SELECT is_enabled, order_index, custom_settings
            FROM user_widget_preferences 
            WHERE user_id = ? AND widget_id = ?
        `, [userId, id]);
        
        if (preference) {
            userPreferences = {
                isEnabled: preference.is_enabled,
                orderIndex: preference.order_index,
                customSettings: preference.custom_settings ? JSON.parse(preference.custom_settings) : {}
            };
        }
    }

    const formattedWidget = {
        ...widget,
        content: widget.content ? JSON.parse(widget.content) : {},
        isEnabled: userPreferences.isEnabled !== undefined ? userPreferences.isEnabled : true,
        orderIndex: userPreferences.orderIndex !== undefined ? userPreferences.orderIndex : widget.order_index,
        customSettings: userPreferences.customSettings || {}
    };

    res.json({
        widget: formattedWidget
    });
}));

// Update user widget preferences
router.put('/:id/preferences', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isEnabled, orderIndex, customSettings } = req.body;
    const userId = req.user.id;

    // Check if widget exists
    const widget = await database.get(
        'SELECT id FROM widgets WHERE id = ? AND is_active = 1',
        [id]
    );
    if (!widget) {
        throw createNotFoundError('Widget not found');
    }

    // Check if preference exists
    const existingPreference = await database.get(
        'SELECT * FROM user_widget_preferences WHERE user_id = ? AND widget_id = ?',
        [userId, id]
    );

    if (existingPreference) {
        // Update existing preference
        const updates = [];
        const params = [];

        if (isEnabled !== undefined) {
            updates.push('is_enabled = ?');
            params.push(isEnabled);
        }
        if (orderIndex !== undefined) {
            updates.push('order_index = ?');
            params.push(orderIndex);
        }
        if (customSettings !== undefined) {
            updates.push('custom_settings = ?');
            params.push(JSON.stringify(customSettings));
        }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(userId, id);

            await database.run(
                `UPDATE user_widget_preferences SET ${updates.join(', ')} WHERE user_id = ? AND widget_id = ?`,
                params
            );
        }
    } else {
        // Create new preference
        await database.run(`
            INSERT INTO user_widget_preferences (user_id, widget_id, is_enabled, order_index, custom_settings)
            VALUES (?, ?, ?, ?, ?)
        `, [
            userId, 
            id, 
            isEnabled !== undefined ? isEnabled : true,
            orderIndex !== undefined ? orderIndex : 0,
            customSettings ? JSON.stringify(customSettings) : null
        ]);
    }

    res.json({
        message: 'Widget preferences updated successfully'
    });
}));

// Get user's widget preferences for a festival
router.get('/festival/:festivalId/preferences', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;
    const userId = req.user.id;

    // Check if festival exists
    const festival = await database.get(
        'SELECT id, name FROM festivals WHERE id = ? AND is_active = 1',
        [festivalId]
    );
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    // Get user preferences for all widgets in the festival
    const preferences = await database.all(`
        SELECT 
            uwp.widget_id,
            uwp.is_enabled,
            uwp.order_index,
            uwp.custom_settings,
            w.title,
            w.type
        FROM user_widget_preferences uwp
        JOIN widgets w ON uwp.widget_id = w.id
        WHERE uwp.user_id = ? AND w.festival_id = ?
        ORDER BY uwp.order_index ASC
    `, [userId, festivalId]);

    const formattedPreferences = preferences.map(pref => ({
        widgetId: pref.widget_id,
        widgetTitle: pref.title,
        widgetType: pref.type,
        isEnabled: pref.is_enabled,
        orderIndex: pref.order_index,
        customSettings: pref.custom_settings ? JSON.parse(pref.custom_settings) : {}
    }));

    res.json({
        festivalId,
        festivalName: festival.name,
        preferences: formattedPreferences
    });
}));

// Reset user's widget preferences for a festival
router.delete('/festival/:festivalId/preferences', asyncHandler(async (req, res) => {
    const { festivalId } = req.params;
    const userId = req.user.id;

    // Check if festival exists
    const festival = await database.get(
        'SELECT id, name FROM festivals WHERE id = ? AND is_active = 1',
        [festivalId]
    );
    if (!festival) {
        throw createNotFoundError('Festival not found');
    }

    // Delete user preferences for all widgets in the festival
    await database.run(`
        DELETE FROM user_widget_preferences 
        WHERE user_id = ? AND widget_id IN (
            SELECT id FROM widgets WHERE festival_id = ?
        )
    `, [userId, festivalId]);

    res.json({
        message: 'Widget preferences reset successfully'
    });
}));

module.exports = router;
