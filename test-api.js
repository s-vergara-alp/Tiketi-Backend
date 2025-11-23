require('dotenv').config();
const request = require('supertest');
const { app } = require('./src/app');
const database = require('./src/database/database');

async function testEmailVerificationAPI() {
    let testEmail;
    try {
        console.log('Testing email verification API endpoints...');
        
        // Connect to database
        await database.connect();
        console.log('Connected to database');

        // Clean up any existing test data
        const uniqueId = Date.now();
        testEmail = 's.v.alpizar0106+' + uniqueId + '@gmail.com';
        await database.run('DELETE FROM email_verification_tokens WHERE email = ?', [testEmail]);
        await database.run('DELETE FROM users WHERE email = ?', [testEmail]);

        console.log('\n1. Testing user registration...');
        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send({
                username: 'testuser' + uniqueId,
                email: testEmail,
                password: 'password123',
                firstName: 'Sergio',
                lastName: 'Alpizar'
            });

        console.log('Registration status:', registerResponse.status);
        console.log('Registration response:', registerResponse.body.message);
        
        if (registerResponse.status === 201) {
            console.log('✅ User registered successfully');
            console.log('User verified status:', registerResponse.body.user.is_verified);
            console.log('Requires verification:', registerResponse.body.requiresVerification);
        } else {
            console.log('❌ Registration failed:', registerResponse.body);
            return;
        }

        console.log('\n2. Testing login with unverified user...');
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: testEmail,
                password: 'password123'
            });

        console.log('Login status:', loginResponse.status);
        console.log('Login response:', loginResponse.body.message);
        
        if (loginResponse.status === 403) {
            console.log('✅ Login correctly rejected for unverified user');
            console.log('Requires verification:', loginResponse.body.requiresVerification);
        } else {
            console.log('❌ Login should have been rejected for unverified user');
        }

        console.log('\n3. Testing verification token generation...');
        const tokenRecord = await database.get(
            'SELECT * FROM email_verification_tokens WHERE email = ? ORDER BY created_at DESC LIMIT 1',
            [testEmail]
        );

        if (tokenRecord) {
            console.log('✅ Verification token generated');
            console.log('Token ID:', tokenRecord.id);
            console.log('Token (first 20 chars):', tokenRecord.token.substring(0, 20) + '...');
            console.log('Expires at:', tokenRecord.expires_at);

            console.log('\n4. Testing email verification endpoint...');
            const verifyResponse = await request(app)
                .post('/api/auth/verify-email')
                .send({
                    token: tokenRecord.token
                });

            console.log('Verification status:', verifyResponse.status);
            console.log('Verification response:', verifyResponse.body.message);
            
            if (verifyResponse.status === 200) {
                console.log('✅ Email verification successful');
                console.log('User verified status:', verifyResponse.body.user.is_verified);
                console.log('Auth token provided:', !!verifyResponse.body.token);
            } else {
                console.log('❌ Email verification failed:', verifyResponse.body);
            }

            console.log('\n5. Testing login with verified user...');
            const loginAfterVerifyResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testEmail,
                    password: 'password123'
                });

            console.log('Login after verification status:', loginAfterVerifyResponse.status);
            console.log('Login after verification response:', loginAfterVerifyResponse.body.message);
            
            if (loginAfterVerifyResponse.status === 200) {
                console.log('✅ Login successful after verification');
                console.log('User verified status:', loginAfterVerifyResponse.body.user.is_verified);
            } else {
                console.log('❌ Login failed after verification:', loginAfterVerifyResponse.body);
            }

        } else {
            console.log('❌ No verification token found');
        }

        console.log('\n6. Testing resend verification endpoint...');
        const resendResponse = await request(app)
            .post('/api/auth/resend-verification')
            .send({
                email: testEmail
            });

        console.log('Resend status:', resendResponse.status);
        console.log('Resend response:', resendResponse.body.message);
        
        if (resendResponse.status === 200) {
            console.log('✅ Resend verification successful');
        } else if (resendResponse.status === 400 && resendResponse.body.error.includes('already verified')) {
            console.log('✅ Resend correctly rejected for already verified user');
        } else {
            console.log('❌ Resend verification failed:', resendResponse.body);
        }

        console.log('\n🎉 Email verification API tests completed!');
        console.log('\nNote: To test actual email sending, configure email credentials in .env file:');
        console.log('EMAIL_HOST=smtp.gmail.com');
        console.log('EMAIL_PORT=587');
        console.log('EMAIL_SECURE=false');
        console.log('EMAIL_USER=your-email@gmail.com');
        console.log('EMAIL_PASS=your-app-password');
        console.log('EMAIL_FROM=your-email@gmail.com');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Full error:', error);
    } finally {
        // Clean up test data
        try {
            await database.run('DELETE FROM email_verification_tokens WHERE email = ?', [testEmail]);
            await database.run('DELETE FROM users WHERE email = ?', [testEmail]);
            console.log('\nTest data cleaned up');
        } catch (cleanupError) {
            console.log('Cleanup error (non-critical):', cleanupError.message);
        }
        
        await database.disconnect();
        console.log('Database disconnected');
    }
}

// Run the test
testEmailVerificationAPI();
