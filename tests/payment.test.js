const paymentService = require('../src/services/PaymentService');
const database = require('../src/database/database');
const { ValidationError, BusinessLogicError } = require('../src/utils/errors');

describe('Payment Service Tests', () => {
    let testUser;
    let testFestival;
    let testTemplate;

    beforeEach(async () => {
        // Use the seeded test data from setup
        testUser = {
            id: 'test-user-base',
            username: 'testuser',
            email: 'test@example.com',
            password_hash: 'hashed_password',
            first_name: 'Test',
            last_name: 'User'
        };

        testFestival = {
            id: 'test-festival-base',
            name: 'Test Festival',
            description: 'A test festival',
            venue: 'Test Venue',
            start_date: '2024-07-01 10:00:00',
            end_date: '2024-07-03 22:00:00',
            latitude: 40.7128,
            longitude: -74.0060,
            latitude_delta: 0.01,
            longitude_delta: 0.01,
            primary_color: '#FF0000',
            secondary_color: '#00FF00',
            accent_color: '#0000FF',
            background_color: '#FFFFFF',
            is_active: 1
        };

        testTemplate = {
            id: 'test-template-base',
            festival_id: 'test-festival-base',
            name: 'Test Template',
            description: 'A test ticket template',
            price: 99.99,
            currency: 'USD',
            benefits: JSON.stringify(['Test benefit 1', 'Test benefit 2']),
            max_quantity: 1000,
            current_quantity: 0,
            is_available: 1
        };
    });

    afterEach(async () => {
        // Clean up test data (but don't delete the seeded base data)
        await database.run('DELETE FROM payments');
        await database.run('DELETE FROM refunds');
        await database.run('DELETE FROM tickets');
    });

  describe('Payment Processing', () => {
    it('should process payment successfully', async () => {
      const paymentData = {
        userId: testUser.id,
        festivalId: testFestival.id,
        templateId: testTemplate.id,
        amount: 99.99,
        currency: 'USD',
        paymentMethodType: 'credit_card',
        paymentMethodToken: 'tok_test_123'
      };

      const result = await paymentService.processTicketPayment(paymentData);

      expect(result).toBeDefined();
      expect(result.paymentId).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.amount).toBe(99.99);
    });

    it('should handle payment failure', async () => {
      const paymentData = {
        userId: testUser.id,
        festivalId: testFestival.id,
        templateId: testTemplate.id,
        amount: 99.99,
        currency: 'USD',
        paymentMethodType: 'credit_card',
        paymentMethodToken: 'tok_fail_123' // This should trigger failure
      };

      await expect(paymentService.processTicketPayment(paymentData)).rejects.toThrow();
    });

    it('should validate payment data', async () => {
      const invalidPaymentData = {
        userId: '',
        festivalId: testFestival.id,
        templateId: testTemplate.id,
        amount: -10, // Invalid amount
        currency: 'USD',
        paymentMethodType: 'credit_card',
        paymentMethodToken: 'tok_test_123'
      };

      await expect(paymentService.processTicketPayment(invalidPaymentData)).rejects.toThrow(ValidationError);
    });
  });

  describe('Payment History', () => {
    it('should return payment history for user', async () => {
      const userId = testUser.id;
      
      // Create test payments using the seeded data
      await database.run(`
        INSERT INTO payments (id, user_id, festival_id, template_id, amount, currency, payment_method_type, payment_method_token, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, ['pay1', userId, testFestival.id, testTemplate.id, 50.00, 'USD', 'credit_card', 'tok1', 'success']);

      await database.run(`
        INSERT INTO payments (id, user_id, festival_id, template_id, amount, currency, payment_method_type, payment_method_token, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, ['pay2', userId, testFestival.id, testTemplate.id, 75.00, 'USD', 'credit_card', 'tok2', 'success']);

      await database.run(`
        INSERT INTO payments (id, user_id, festival_id, template_id, amount, currency, payment_method_type, payment_method_token, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, ['pay1', userId, 'fest1', 'temp1', 50.00, 'USD', 'credit_card', 'tok1', 'success']);

      await database.run(`
        INSERT INTO payments (id, user_id, festival_id, template_id, amount, currency, payment_method_type, payment_method_token, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, ['pay2', userId, 'fest2', 'temp2', 75.00, 'USD', 'credit_card', 'tok2', 'success']);

      const history = await paymentService.getPaymentHistory(userId);

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('pay1');
      expect(history[1].id).toBe('pay2');
    });

    it('should return empty history for user with no payments', async () => {
      const history = await paymentService.getPaymentHistory('non-existent-user');
      expect(history).toHaveLength(0);
    });
  });

  describe('Payment Retrieval', () => {
    it('should return specific payment by ID', async () => {
      const paymentId = 'test-payment';
      const userId = testUser.id;
      
      // Create test payment using the seeded data

      await database.run(`
        INSERT INTO payments (id, user_id, festival_id, template_id, amount, currency, payment_method_type, payment_method_token, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [paymentId, userId, testFestival.id, testTemplate.id, 50.00, 'USD', 'credit_card', 'tok1', 'success']);

      const payment = await paymentService.getPaymentById(paymentId);

      expect(payment).toBeDefined();
      expect(payment.id).toBe(paymentId);
      expect(payment.amount).toBe(50.00);
      expect(payment.status).toBe('success');
    });

    it('should return null for non-existent payment', async () => {
      const payment = await paymentService.getPaymentById('non-existent-payment');
      expect(payment).toBeNull();
    });
  });

  describe('Refund Processing', () => {
    it('should process refund successfully', async () => {
      const paymentId = 'test-payment';
      const userId = testUser.id;
      
      // Create test payment using the seeded data

      await database.run(`
        INSERT INTO payments (id, user_id, festival_id, template_id, amount, currency, payment_method_type, payment_method_token, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [paymentId, userId, testFestival.id, testTemplate.id, 50.00, 'USD', 'credit_card', 'tok1', 'success']);

      const refundData = {
        paymentId,
        amount: 50.00,
        reason: 'Customer request'
      };

      const result = await paymentService.refundPayment(refundData);

      expect(result).toBeDefined();
      expect(result.refundId).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.amount).toBe(50.00);
    });

    it('should handle refund failure', async () => {
      const refundData = {
        paymentId: 'non-existent-payment',
        amount: 50.00,
        reason: 'Customer request'
      };

      await expect(paymentService.refundPayment(refundData)).rejects.toThrow();
    });

    it('should validate refund data', async () => {
      const invalidRefundData = {
        paymentId: '',
        amount: -10, // Invalid amount
        reason: 'Customer request'
      };

      await expect(paymentService.refundPayment(invalidRefundData)).rejects.toThrow(ValidationError);
    });
  });

  describe('Payment Validation', () => {
    it('should validate payment method types', async () => {
      const validTypes = ['credit_card', 'debit_card', 'bank_transfer'];
      
      validTypes.forEach(type => {
        expect(paymentService.validatePaymentMethodType(type)).toBe(true);
      });
    });

    it('should reject invalid payment method types', async () => {
      const invalidTypes = ['invalid_type', '', null, undefined];
      
      invalidTypes.forEach(type => {
        expect(paymentService.validatePaymentMethodType(type)).toBe(false);
      });
    });

    it('should validate payment amounts', async () => {
      const validAmounts = [0.01, 1.00, 100.00, 999.99];
      
      validAmounts.forEach(amount => {
        expect(paymentService.validatePaymentAmount(amount)).toBe(true);
      });
    });

    it('should reject invalid payment amounts', async () => {
      const invalidAmounts = [-1, 0, -0.01, 1000.01];
      
      invalidAmounts.forEach(amount => {
        expect(paymentService.validatePaymentAmount(amount)).toBe(false);
      });
    });
  });

  describe('Gateway Integration', () => {
    it('should handle successful gateway response', async () => {
      const paymentData = {
        amount: 100.00,
        currency: 'USD',
        paymentMethodToken: 'tok_success_123'
      };

      const result = await paymentService.processPaymentWithGateway(paymentData);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
    });

    it('should handle gateway failure', async () => {
      const paymentData = {
        amount: 100.00,
        currency: 'USD',
        paymentMethodToken: 'tok_fail_123'
      };

      await expect(paymentService.processPaymentWithGateway(paymentData)).rejects.toThrow();
    });

    it('should handle gateway timeout', async () => {
      const paymentData = {
        amount: 100.00,
        currency: 'USD',
        paymentMethodToken: 'tok_timeout_123'
      };

      await expect(paymentService.processPaymentWithGateway(paymentData)).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error by passing invalid data
      const invalidPaymentData = {
        userId: null,
        festivalId: null,
        templateId: null,
        amount: null,
        currency: null,
        paymentMethodType: null,
        paymentMethodToken: null
      };

      await expect(paymentService.processTicketPayment(invalidPaymentData)).rejects.toThrow();
    });

    it('should handle business logic errors', async () => {
      const paymentData = {
        userId: testUser.id,
        festivalId: testFestival.id,
        templateId: testTemplate.id,
        amount: 0, // Invalid amount
        currency: 'USD',
        paymentMethodType: 'credit_card',
        paymentMethodToken: 'tok_test_123'
      };

      await expect(paymentService.processTicketPayment(paymentData)).rejects.toThrow(BusinessLogicError);
    });
  });
});
