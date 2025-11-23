require('dotenv').config();
const request = require('supertest');
const { app } = require('./src/app');
const database = require('./src/database/database');

async function testEmailVerificationSimple() {
    try {
        console.log('🧪 Testing Email Verification System - Simple Test');
        console.log('=' .repeat(60));
        
        // Connect to database
        await database.connect();
        console.log('✅ Connected to database');

        // Clean up any existing test data
        await database.run('DELETE FROM email_verification_tokens WHERE email LIKE ?', ['%test%']);
        await database.run('DELETE FROM users WHERE email LIKE ?', ['%test%']);
        console.log('✅ Cleaned up existing test data');

        const testData = {
            username: 'testuser' + Date.now(),
            email: 'test' + Date.now() + '@example.com',
            password: 'password123',
            firstName: 'Test',
            lastName: 'User'
        };

        console.log('\n1. Testing user registration...');
        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send(testData);

        console.log('Registration status:', registerResponse.status);
        console.log('Registration message:', registerResponse.body.message);
        console.log('Requires verification:', registerResponse.body.requiresVerification);

        if (registerResponse.status === 201) {
            console.log('✅ User registration successful');
            
            // Check if user was created as unverified
            const user = await database.get(
                'SELECT is_verified FROM users WHERE email = ?',
                [testData.email]
            );
            console.log('User verification status:', user?.is_verified);
            
            // Check if verification token was created
            const tokenRecord = await database.get(
                'SELECT token FROM email_verification_tokens WHERE email = ?',
                [testData.email]
            );
            console.log('Verification token created:', !!tokenRecord?.token);
            
            if (tokenRecord?.token) {
                console.log('\n2. Testing email verification...');
                const verifyResponse = await request(app)
                    .post('/api/auth/verify-email')
                    .send({ token: tokenRecord.token });
                
                console.log('Verification status:', verifyResponse.status);
                console.log('Verification message:', verifyResponse.body.message);
                
                if (verifyResponse.status === 200) {
                    console.log('✅ Email verification successful');
                    
                    // Check if user is now verified
                    const verifiedUser = await database.get(
                        'SELECT is_verified FROM users WHERE email = ?',
                        [testData.email]
                    );
                    console.log('User verification status after verification:', verifiedUser?.is_verified);
                    
                    console.log('\n3. Testing login with verified user...');
                    const loginResponse = await request(app)
                        .post('/api/auth/login')
                        .send({
                            email: testData.email,
                            password: testData.password
                        });
                    
                    console.log('Login status:', loginResponse.status);
                    console.log('Login message:', loginResponse.body.message);
                    
                    if (loginResponse.status === 200) {
                        console.log('✅ Login with verified user successful');
                    } else {
                        console.log('❌ Login with verified user failed');
                    }
                } else {
                    console.log('❌ Email verification failed');
                }
            } else {
                console.log('❌ No verification token found');
            }
        } else {
            console.log('❌ User registration failed');
        }

        // Clean up test data
        await database.run('DELETE FROM email_verification_tokens WHERE email = ?', [testData.email]);
        await database.run('DELETE FROM users WHERE email = ?', [testData.email]);
        console.log('\n✅ Test data cleaned up');

        await database.disconnect();
        console.log('✅ Database disconnected');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        await database.disconnect();
    }
}

testEmailVerificationSimple();




