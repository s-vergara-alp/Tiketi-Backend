require('dotenv').config();
const request = require('supertest');
const { app } = require('./src/app');
const database = require('./src/database/database');

async function simpleTest() {
    try {
        console.log('🧪 Testing Email Verification System with s.v.alpizar0106@gmail.com');
        console.log('=' .repeat(60));
        
        // Connect to database
        await database.connect();
        console.log('✅ Connected to database');

        // Clean up any existing test data
        await database.run('DELETE FROM email_verification_tokens WHERE email = ?', ['s.v.alpizar0106@gmail.com']);
        await database.run('DELETE FROM users WHERE email = ?', ['s.v.alpizar0106@gmail.com']);
        console.log('✅ Cleaned up existing test data');

        const testData = {
            username: 'testuser' + Date.now(),
            email: 's.v.alpizar0106@gmail.com',
            password: 'password123',
            firstName: 'Sergio',
            lastName: 'Alpizar'
        };

        console.log('\n📝 Test Data:');
        console.log('Username:', testData.username);
        console.log('Email:', testData.email);
        console.log('Name:', testData.firstName, testData.lastName);

        // Test 1: Registration
        console.log('\n1️⃣ Testing User Registration...');
        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send(testData);

        console.log('Status:', registerResponse.status);
        console.log('Message:', registerResponse.body.message);
        
        if (registerResponse.status === 201) {
            console.log('✅ Registration successful');
            console.log('User verified:', registerResponse.body.user.is_verified);
            console.log('Requires verification:', registerResponse.body.requiresVerification);
        } else {
            console.log('❌ Registration failed:', registerResponse.body.error?.message);
            return;
        }

        // Test 2: Login with unverified user
        console.log('\n2️⃣ Testing Login with Unverified User...');
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: testData.email,
                password: testData.password
            });

        console.log('Status:', loginResponse.status);
        console.log('Message:', loginResponse.body.message);
        
        if (loginResponse.status === 403) {
            console.log('✅ Login correctly rejected for unverified user');
            console.log('Requires verification:', loginResponse.body.requiresVerification);
        } else {
            console.log('❌ Login should have been rejected');
        }

        // Test 3: Check if verification token was generated
        console.log('\n3️⃣ Checking Verification Token...');
        const tokenRecord = await database.get(
            'SELECT * FROM email_verification_tokens WHERE email = ? ORDER BY created_at DESC LIMIT 1',
            [testData.email]
        );

        if (tokenRecord) {
            console.log('✅ Verification token found');
            console.log('Token ID:', tokenRecord.id);
            console.log('Token (first 20 chars):', tokenRecord.token.substring(0, 20) + '...');
            console.log('Expires at:', tokenRecord.expires_at);

            // Test 4: Email verification
            console.log('\n4️⃣ Testing Email Verification...');
            const verifyResponse = await request(app)
                .post('/api/auth/verify-email')
                .send({
                    token: tokenRecord.token
                });

            console.log('Status:', verifyResponse.status);
            console.log('Message:', verifyResponse.body.message);
            
            if (verifyResponse.status === 200) {
                console.log('✅ Email verification successful');
                console.log('User verified:', verifyResponse.body.user.is_verified);
                console.log('Auth token provided:', !!verifyResponse.body.token);
            } else {
                console.log('❌ Email verification failed:', verifyResponse.body.error?.message);
            }

            // Test 5: Login after verification
            console.log('\n5️⃣ Testing Login After Verification...');
            const loginAfterVerifyResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testData.email,
                    password: testData.password
                });

            console.log('Status:', loginAfterVerifyResponse.status);
            console.log('Message:', loginAfterVerifyResponse.body.message);
            
            if (loginAfterVerifyResponse.status === 200) {
                console.log('✅ Login successful after verification');
                console.log('User verified:', loginAfterVerifyResponse.body.user.is_verified);
            } else {
                console.log('❌ Login failed after verification:', loginAfterVerifyResponse.body.error?.message);
            }

        } else {
            console.log('❌ No verification token found');
        }

        // Test 6: Resend verification
        console.log('\n6️⃣ Testing Resend Verification...');
        const resendResponse = await request(app)
            .post('/api/auth/resend-verification')
            .send({
                email: testData.email
            });

        console.log('Status:', resendResponse.status);
        console.log('Message:', resendResponse.body.message);
        
        if (resendResponse.status === 200) {
            console.log('✅ Resend verification successful');
        } else if (resendResponse.status === 400 && resendResponse.body.error?.message?.includes('already verified')) {
            console.log('✅ Resend correctly rejected for already verified user');
        } else {
            console.log('❌ Resend verification failed:', resendResponse.body.error?.message);
        }

        console.log('\n🎉 Email Verification System Test Complete!');
        console.log('\n📧 Email Configuration Status:');
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            console.log('✅ Email service is configured');
            console.log('📨 Check your email at s.v.alpizar0106@gmail.com for verification emails');
        } else {
            console.log('⚠️  Email service not configured');
            console.log('📝 To enable email sending, add to .env file:');
            console.log('   EMAIL_HOST=smtp.gmail.com');
            console.log('   EMAIL_PORT=587');
            console.log('   EMAIL_USER=your-email@gmail.com');
            console.log('   EMAIL_PASS=your-app-password');
            console.log('   EMAIL_FROM=your-email@gmail.com');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Full error:', error);
    } finally {
        // Clean up test data
        try {
            await database.run('DELETE FROM email_verification_tokens WHERE email = ?', ['s.v.alpizar0106@gmail.com']);
            await database.run('DELETE FROM users WHERE email = ?', ['s.v.alpizar0106@gmail.com']);
            console.log('\n🧹 Test data cleaned up');
        } catch (cleanupError) {
            console.log('Cleanup error (non-critical):', cleanupError.message);
        }
        
        await database.disconnect();
        console.log('🔌 Database disconnected');
    }
}

// Run the test
simpleTest();




