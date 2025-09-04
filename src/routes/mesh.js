const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/errors').asyncHandler;
const meshNetworkService = require('../services/MeshNetworkService');
const estadiasService = require('../services/EstadiasService');
const { body, param, query, validationResult } = require('express-validator');
const { createValidationError } = require('../utils/errors');

// --- Mesh Network Endpoints ---

/**
 * @route POST /api/mesh/peers
 * @desc Register or update a mesh peer's information.
 * @access Private (authenticated users only)
 */
router.post('/peers', [
    body('id').isString().notEmpty().withMessage('Peer ID is required'),
    body('noise_public_key').isString().notEmpty().withMessage('Noise Public Key is required'),
    body('signing_public_key').isString().notEmpty().withMessage('Signing Public Key is required'),
    body('nickname').isString().notEmpty().withMessage('Nickname is required'),
    body('is_connected').optional().isBoolean().withMessage('is_connected must be a boolean'),
    body('is_reachable').optional().isBoolean().withMessage('is_reachable must be a boolean'),
    body('metadata').optional().isObject().withMessage('Metadata must be an object'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array());
    }
    const peer = await meshNetworkService.upsertPeer(req.body);
    res.status(200).json({ success: true, data: peer });
}));

/**
 * @route GET /api/mesh/peers
 * @desc Get all known mesh peers.
 * @access Private (authenticated users only)
 */
router.get('/peers', asyncHandler(async (req, res) => {
    const peers = await meshNetworkService.getAllPeers();
    res.status(200).json({ success: true, data: peers });
}));

/**
 * @route GET /api/mesh/peers/:id
 * @desc Get a specific mesh peer by ID.
 * @access Private (authenticated users only)
 */
router.get('/peers/:id', [
    param('id').isString().notEmpty().withMessage('Peer ID is required'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array());
    }
    const peer = await meshNetworkService.getPeerById(req.params.id);
    if (!peer) {
        return res.status(404).json({ error: { message: 'Mesh peer not found' } });
    }
    res.status(200).json({ success: true, data: peer });
}));

/**
 * @route POST /api/mesh/messages
 * @desc Store a message received or sent over the mesh network.
 * @access Private (authenticated users only)
 */
router.post('/messages', [
    body('sender_id').isString().notEmpty().withMessage('Sender ID is required'),
    body('content').isString().notEmpty().withMessage('Message content is required'),
    body('recipient_id').optional().isString().withMessage('Recipient ID must be a string'),
    body('is_private').optional().isBoolean().withMessage('is_private must be a boolean'),
    body('is_encrypted').optional().isBoolean().withMessage('is_encrypted must be a boolean'),
    body('delivery_status').optional().isIn(['pending', 'sent', 'delivered', 'read', 'failed']).withMessage('Invalid delivery status'),
    body('metadata').optional().isObject().withMessage('Metadata must be an object'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array());
    }
    const message = await meshNetworkService.storeMeshMessage(req.body);
    res.status(201).json({ success: true, data: message });
}));

/**
 * @route GET /api/mesh/messages/:peerId
 * @desc Get messages for a specific peer (either as sender or recipient).
 * @access Private (authenticated users only)
 */
router.get('/messages/:peerId', [
    param('peerId').isString().notEmpty().withMessage('Peer ID is required'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be an integer between 1 and 500'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array());
    }
    const messages = await meshNetworkService.getMessagesForPeer(req.params.peerId, req.query);
    res.status(200).json({ success: true, data: messages });
}));

/**
 * @route PUT /api/mesh/messages/:id/status
 * @desc Update the delivery status of a mesh message.
 * @access Private (authenticated users only)
 */
router.put('/messages/:id/status', [
    param('id').isString().notEmpty().withMessage('Message ID is required'),
    body('status').isIn(['pending', 'sent', 'delivered', 'read', 'failed']).withMessage('Invalid delivery status'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array());
    }
    await meshNetworkService.updateMessageDeliveryStatus(req.params.id, req.body.status);
    res.status(200).json({ success: true, message: 'Message status updated' });
}));

// --- Estadias System Endpoints ---

/**
 * @route POST /api/mesh/estadias
 * @desc Create a new estadia (stay) for a user at a festival.
 * @access Private (authenticated users only)
 */
router.post('/estadias', [
    body('user_id').isString().notEmpty().withMessage('User ID is required'),
    body('festival_id').isString().notEmpty().withMessage('Festival ID is required'),
    body('room_id').isString().notEmpty().withMessage('Room ID is required'),
    body('access_code').isString().notEmpty().withMessage('Access Code is required'),
    body('start_time').isISO8601().withMessage('Start Time must be a valid ISO 8601 date'),
    body('end_time').isISO8601().withMessage('End Time must be a valid ISO 8601 date'),
    body('metadata').optional().isObject().withMessage('Metadata must be an object'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array());
    }
    const estadia = await estadiasService.createEstadia(req.body);
    res.status(201).json({ success: true, data: estadia });
}));

/**
 * @route GET /api/mesh/estadias/:id
 * @desc Get a specific estadia by ID.
 * @access Private (authenticated users only)
 */
router.get('/estadias/:id', [
    param('id').isString().notEmpty().withMessage('Estadia ID is required'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array());
    }
    const estadia = await estadiasService.getEstadiaById(req.params.id);
    if (!estadia) {
        return res.status(404).json({ error: { message: 'Estadia not found' } });
    }
    res.status(200).json({ success: true, data: estadia });
}));

/**
 * @route GET /api/mesh/estadias/user/:userId
 * @desc Get all estadias for a specific user.
 * @access Private (authenticated users only)
 */
router.get('/estadias/user/:userId', [
    param('userId').isString().notEmpty().withMessage('User ID is required'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array());
    }
    const estadias = await estadiasService.getUserEstadias(req.params.userId);
    res.status(200).json({ success: true, data: estadias });
}));

/**
 * @route PUT /api/mesh/estadias/:id/status
 * @desc Update the status of an estadia.
 * @access Private (authenticated users only)
 */
router.put('/estadias/:id/status', [
    param('id').isString().notEmpty().withMessage('Estadia ID is required'),
    body('status').isIn(['active', 'checked_in', 'checked_out', 'cancelled', 'expired']).withMessage('Invalid estadia status'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array());
    }
    const updatedEstadia = await estadiasService.updateEstadiaStatus(req.params.id, req.body.status);
    res.status(200).json({ success: true, data: updatedEstadia });
}));

/**
 * @route POST /api/mesh/estadias/access/validate
 * @desc Validate an access code for a specific room.
 * @access Private (authenticated users only)
 */
router.post('/estadias/access/validate', [
    body('access_code').isString().notEmpty().withMessage('Access Code is required'),
    body('room_id').isString().notEmpty().withMessage('Room ID is required'),
    body('user_id').isString().notEmpty().withMessage('User ID is required'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array());
    }
    const result = await estadiasService.validateRoomAccess(req.body.access_code, req.body.room_id, req.body.user_id);
    res.status(200).json({ success: true, data: result });
}));

module.exports = router;
