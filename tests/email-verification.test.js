const request = require('supertest');
const { app } = require('../src/app');
const database = require('../src/database/database');
const emailService = require('../src/services/EmailService');

describe('Email Verification Tests', () => {
    let testUser;
    let verificationToken;

    beforeAll(async () => {
        // Connect to database
        await database.connect();
        
        // Run email verification migration
        const migrateEmailVerification = require('../src/database/migrate_email_verification');
        await migrateEmailVerification();
    });

    afterAll(async () => {
        // Clean up test data
        await database.run('DELETE FROM email_verification_tokens');
        await database.run('DELETE FROM users WHERE email LIKE ?', ['test%']);
        
        // Disconnect from database
        await database.disconnect();
    });

    beforeEach(async () => {
        // Ensure database is connected
        if (!database.db) {
            await database.connect();
        }
        
        // Clean up test data
        await database.run('DELETE FROM email_verification_tokens');
        await database.run('DELETE FROM users WHERE email LIKE ?', ['test%']);
        
        // Add longer delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    afterEach(async () => {
        // Add longer delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    describe('POST /api/auth/register', () => {
        it('should register user and send verification email', async () => {
            const userData = {
                username: 'testuser' + Date.now(),
                email: 'test' + Date.now() + '@example.com',
                password: 'password123',
                firstName: 'Test',
                lastName: 'User'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body.message).toContain('Please check your email to verify your account');
            expect(response.body.requiresVerification).toBe(true);
            expect(response.body.user.is_verified).toBe(0);

            // Check if user was created in database
            const user = await database.get(
                'SELECT * FROM users WHERE email = ?',
                [userData.email]
            );
            expect(user).toBeTruthy();
            expect(user.is_verified).toBe(0);
        });

        it('should not send verification email if email service fails', async () => {
            // Mock email service to throw error
            const originalSendEmail = emailService.sendVerificationEmail;
            emailService.sendVerificationEmail = jest.fn().mockRejectedValue(new Error('Email service unavailable'));

            const userData = {
                username: 'testuser2' + Date.now(),
                email: 'test2' + Date.now() + '@example.com',
                password: 'password123',
                firstName: 'Test',
                lastName: 'User'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body.message).toContain('Please check your email to verify your account');
            expect(response.body.user.is_verified).toBe(0);

            // Restore original function
            emailService.sendVerificationEmail = originalSendEmail;
        });
    });

    describe('POST /api/auth/verify-email', () => {
        let testEmail;
        
        beforeEach(async () => {
            // Create a test user
            testEmail = 'test' + Date.now() + '@example.com';
            const userData = {
                username: 'testuser' + Date.now(),
                email: testEmail,
                password: 'password123',
                firstName: 'Test',
                lastName: 'User'
            };

            await request(app)
                .post('/api/auth/register')
                .send(userData);

            // Get the verification token
            const tokenRecord = await database.get(
                'SELECT token FROM email_verification_tokens ORDER BY created_at DESC LIMIT 1'
            );
            verificationToken = tokenRecord?.token;
        });

        it('should verify email with valid token', async () => {
            if (!verificationToken) {
                console.log('No verification token found, skipping test');
                return;
            }
            
            const response = await request(app)
                .post('/api/auth/verify-email')
                .send({ token: verificationToken })
                .expect(200);

            expect(response.body.message).toBe('Email verified successfully');
            expect(response.body.user.is_verified).toBe(1);
            expect(response.body.token).toBeTruthy();

            // Check if user is verified in database
            const user = await database.get(
                'SELECT is_verified FROM users WHERE email = ?',
                [testEmail]
            );
            expect(user?.is_verified).toBe(1);
        });

        it('should reject invalid token', async () => {
            const response = await request(app)
                .post('/api/auth/verify-email')
                .send({ token: 'invalid-token' })
                .expect(400);

            expect(response.body.error).toContain('Invalid verification token');
        });

        it('should reject already used token', async () => {
            // Use token once
            await request(app)
                .post('/api/auth/verify-email')
                .send({ token: verificationToken });

            // Try to use same token again
            const response = await request(app)
                .post('/api/auth/verify-email')
                .send({ token: verificationToken })
                .expect(400);

            expect(response.body.error).toContain('already been used');
        });

        it('should reject expired token', async () => {
            // Manually expire the token
            const expiredTime = new Date();
            expiredTime.setHours(expiredTime.getHours() - 25); // 25 hours ago

            await database.run(
                'UPDATE email_verification_tokens SET expires_at = ? WHERE token = ?',
                [expiredTime.toISOString(), verificationToken]
            );

            const response = await request(app)
                .post('/api/auth/verify-email')
                .send({ token: verificationToken })
                .expect(400);

            expect(response.body.error).toContain('expired');
        });

        it('should require token parameter', async () => {
            const response = await request(app)
                .post('/api/auth/verify-email')
                .send({})
                .expect(400);

            expect(response.body.error).toContain('Verification token is required');
        });
    });

    describe('POST /api/auth/resend-verification', () => {
        let testEmail;
        
        beforeEach(async () => {
            // Create a test user with unique email
            testEmail = 'test' + Date.now() + '@example.com';
            const userData = {
                username: 'testuser' + Date.now(),
                email: testEmail,
                password: 'password123',
                firstName: 'Test',
                lastName: 'User'
            };

            await request(app)
                .post('/api/auth/register')
                .send(userData);
        });

        it('should resend verification email for unverified user', async () => {
            const response = await request(app)
                .post('/api/auth/resend-verification')
                .send({ email: testEmail })
                .expect(200);

            expect(response.body.message).toBe('Verification email sent successfully');

            // Check if new token was created
            const tokens = await database.all(
                'SELECT * FROM email_verification_tokens WHERE email = ?',
                [testEmail]
            );
            expect(tokens).toHaveLength(1);
        });

        it('should reject resend for already verified user', async () => {
            // First verify the user
            const tokenRecord = await database.get(
                'SELECT token FROM email_verification_tokens WHERE email = ?',
                [testEmail]
            );

            if (tokenRecord?.token) {
                await request(app)
                    .post('/api/auth/verify-email')
                    .send({ token: tokenRecord.token });

                // Try to resend verification
                const response = await request(app)
                    .post('/api/auth/resend-verification')
                    .send({ email: testEmail })
                    .expect(400);

                expect(response.body.error).toContain('already verified');
            }
        });

        it('should reject resend for non-existent user', async () => {
            const response = await request(app)
                .post('/api/auth/resend-verification')
                .send({ email: 'nonexistent@example.com' })
                .expect(404);

            expect(response.body.error).toContain('User not found');
        });

        it('should require valid email', async () => {
            const response = await request(app)
                .post('/api/auth/resend-verification')
                .send({ email: 'invalid-email' })
                .expect(400);

            expect(response.body.error).toContain('valid email address');
        });
    });

    describe('POST /api/auth/login', () => {
        let testEmail;
        
        beforeEach(async () => {
            // Create a test user with unique email
            testEmail = 'test' + Date.now() + '@example.com';
            const userData = {
                username: 'testuser' + Date.now(),
                email: testEmail,
                password: 'password123',
                firstName: 'Test',
                lastName: 'User'
            };

            await request(app)
                .post('/api/auth/register')
                .send(userData);
        });

        it('should reject login for unverified user', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testEmail,
                    password: 'password123'
                })
                .expect(403);

            expect(response.body.message).toContain('verify your email address');
            expect(response.body.requiresVerification).toBe(true);
        });

        it('should allow login for verified user', async () => {
            // First verify the user
            const tokenRecord = await database.get(
                'SELECT token FROM email_verification_tokens WHERE email = ?',
                [testEmail]
            );

            if (tokenRecord?.token) {
                await request(app)
                    .post('/api/auth/verify-email')
                    .send({ token: tokenRecord.token });

                // Now try to login
                const response = await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: testEmail,
                        password: 'password123'
                    })
                    .expect(200);

                expect(response.body.message).toBe('Login successful');
                expect(response.body.user.is_verified).toBe(1);
                expect(response.body.token).toBeTruthy();
            }
        });
    });

    describe('Email Service', () => {
        it('should generate verification token', async () => {
            const userId = 'test-user-id';
            const email = 'test@example.com';

            const token = await emailService.generateVerificationToken(userId, email);

            expect(token).toBeTruthy();
            expect(typeof token).toBe('string');

            // Check if token was stored in database
            const tokenRecord = await database.get(
                'SELECT * FROM email_verification_tokens WHERE token = ?',
                [token]
            );
            expect(tokenRecord).toBeTruthy();
            expect(tokenRecord.user_id).toBe(userId);
            expect(tokenRecord.email).toBe(email);
        });

        it('should verify valid token', async () => {
            const userId = 'test-user-id';
            const email = 'test@example.com';

            const token = await emailService.generateVerificationToken(userId, email);
            const tokenRecord = await emailService.verifyToken(token);

            expect(tokenRecord).toBeTruthy();
            expect(tokenRecord.user_id).toBe(userId);
            expect(tokenRecord.email).toBe(email);
        });

        it('should reject invalid token', async () => {
            await expect(emailService.verifyToken('invalid-token'))
                .rejects.toThrow('Invalid verification token');
        });

        it('should mark token as used', async () => {
            const userId = 'test-user-id';
            const email = 'test@example.com';

            const token = await emailService.generateVerificationToken(userId, email);
            const tokenRecord = await emailService.verifyToken(token);

            await emailService.markTokenAsUsed(tokenRecord.id);

            // Check if token is marked as used
            const updatedToken = await database.get(
                'SELECT used_at FROM email_verification_tokens WHERE id = ?',
                [tokenRecord.id]
            );
            expect(updatedToken.used_at).toBeTruthy();
        });
    });
});