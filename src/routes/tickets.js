const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler, createValidationError, createNotFoundError } = require('../middleware/errorHandler');
const { requireSecurity, requireStaff } = require('../middleware/auth');
const ticketService = require('../services/TicketService');
const paymentService = require('../services/PaymentService');

const router = express.Router();

// Get user's tickets
router.get('/', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const filters = {
        status: req.query.status,
        festivalId: req.query.festivalId
    };

    const tickets = await ticketService.getUserTickets(userId, filters);
    res.json(tickets);
}));

// Get ticket by ID
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const ticket = await ticketService.getTicketById(id, userId);
    res.json({ ticket });
}));

// Purchase ticket with payment
router.post('/purchase', [
    body('festivalId')
        .notEmpty()
        .withMessage('Festival ID is required'),
    body('templateId')
        .notEmpty()
        .withMessage('Template ID is required'),
    body('holderName')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Holder name is required and must be less than 100 characters'),
    body('paymentMethod.type')
        .notEmpty()
        .withMessage('Payment method type is required'),
    body('paymentMethod.token')
        .notEmpty()
        .withMessage('Payment method token is required'),
    body('amount')
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be a positive number'),
    body('currency')
        .optional()
        .isLength({ min: 3, max: 3 })
        .withMessage('Currency must be a 3-letter code')
], asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array()[0].msg);
    }

    const { festivalId, templateId, holderName, paymentMethod, amount, currency, seatInfo } = req.body;
    const userId = req.user.id;

    const paymentData = {
        userId,
        festivalId,
        templateId,
        holderName,
        paymentMethod,
        amount,
        currency: currency || 'USD',
        seatInfo
    };

    const result = await paymentService.processTicketPayment(paymentData);

    res.status(201).json({
        message: 'Ticket purchased successfully',
        ...result
    });
}));

// Validate ticket (for entry) - Security personnel only
router.post('/validate/:qrPayload', requireSecurity, asyncHandler(async (req, res) => {
    const { qrPayload } = req.params;

    const validationResult = await ticketService.validateTicket(qrPayload);
    res.json(validationResult);
}));

// Get ticket templates for a festival (authenticated, full details)
router.get('/templates/:festivalId', requireStaff, asyncHandler(async (req, res) => {
    const { festivalId } = req.params;

    const templates = await ticketService.getTicketTemplates(festivalId);
    res.json(templates);
}));

// Transfer ticket
router.post('/:id/transfer', [
    body('newHolderName')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('New holder name is required and must be less than 100 characters')
], asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array()[0].msg);
    }

    const { id } = req.params;
    const { newHolderName } = req.body;
    const userId = req.user.id;

    const result = await ticketService.transferTicket(id, userId, newHolderName);
    res.json(result);
}));

// Cancel ticket
router.post('/:id/cancel', [
    body('reason')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Reason must be less than 500 characters')
], asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array()[0].msg);
    }

    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const result = await ticketService.cancelTicket(id, userId, reason);
    res.json(result);
}));

// Get payment history
router.get('/payments/history', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const filters = {
        status: req.query.status,
        festivalId: req.query.festivalId
    };

    const payments = await paymentService.getPaymentHistory(userId, filters);
    res.json(payments);
}));

// Get payment by ID
router.get('/payments/:paymentId', asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const payment = await paymentService.getPaymentById(paymentId, userId);
    res.json({ payment });
}));

// Refund payment
router.post('/payments/:paymentId/refund', [
    body('amount')
        .optional()
        .isFloat({ min: 0.01 })
        .withMessage('Refund amount must be a positive number'),
    body('reason')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Reason must be less than 500 characters')
], asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw createValidationError(errors.array()[0].msg);
    }

    const { paymentId } = req.params;
    const { amount, reason } = req.body;
    const userId = req.user.id;

    const result = await paymentService.refundPayment(paymentId, userId, amount, reason);
    res.json(result);
}));

module.exports = router;
