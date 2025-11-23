require('dotenv').config();
const emailService = require('./src/services/EmailService');
const database = require('./src/database/database');

async function testEmailVerification() {
    try {
        console.log('Testing email verification with s.v.alpizar0106@gmail.com...');
        
        // Connect to database
        await database.connect();
        console.log('Connected to database');

        // Test user data
        const testUserId = 'test-user-' + Date.now();
        const testEmail = 's.v.alpizar0106@gmail.com';
        const testFirstName = 'Sergio';

        console.log('Testing email service configuration...');
        
        // Test if email service is configured
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.log('❌ Email service not configured. Please set EMAIL_USER and EMAIL_PASS in .env file');
            console.log('Example .env configuration:');
            console.log('EMAIL_HOST=smtp.gmail.com');
            console.log('EMAIL_PORT=587');
            console.log('EMAIL_SECURE=false');
            console.log('EMAIL_USER=your-email@gmail.com');
            console.log('EMAIL_PASS=your-app-password');
            console.log('EMAIL_FROM=your-email@gmail.com');
            return;
        }

        // Test email connection
        const isEmailConfigured = await emailService.testEmailConnection();
        if (!isEmailConfigured) {
            console.log('❌ Email service connection failed. Please check your email credentials.');
            return;
        }

        console.log('✅ Email service is configured and working');

        // Test sending verification email
        console.log('Sending verification email...');
        await emailService.sendVerificationEmail(testUserId, testEmail, testFirstName);
        console.log('✅ Verification email sent successfully!');

        // Test token generation and verification
        console.log('Testing token generation...');
        const token = await emailService.generateVerificationToken(testUserId, testEmail);
        console.log('✅ Token generated:', token.substring(0, 20) + '...');

        // Test token verification
        console.log('Testing token verification...');
        const tokenRecord = await emailService.verifyToken(token);
        console.log('✅ Token verified successfully');
        console.log('Token details:', {
            userId: tokenRecord.user_id,
            email: tokenRecord.email,
            expiresAt: tokenRecord.expires_at
        });

        // Test marking token as used
        console.log('Testing token usage...');
        await emailService.markTokenAsUsed(tokenRecord.id);
        console.log('✅ Token marked as used');

        // Test that used token cannot be used again
        try {
            await emailService.verifyToken(token);
            console.log('❌ Used token should not be verifiable');
        } catch (error) {
            console.log('✅ Used token correctly rejected:', error.message);
        }

        console.log('\n🎉 All email verification tests passed!');
        console.log('Check your email at s.v.alpizar0106@gmail.com for the verification email.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Full error:', error);
    } finally {
        // Clean up test data
        try {
            await database.run('DELETE FROM email_verification_tokens WHERE user_id LIKE ?', ['test-user-%']);
            console.log('Test data cleaned up');
        } catch (cleanupError) {
            console.log('Cleanup error (non-critical):', cleanupError.message);
        }
        
        await database.disconnect();
        console.log('Database disconnected');
    }
}

// Run the test
testEmailVerification();




