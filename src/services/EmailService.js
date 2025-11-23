const nodemailer = require('nodemailer');
const config = require('../config');
const database = require('../database/database');
const { v4: uuidv4 } = require('uuid');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    initializeTransporter() {
        // Only initialize if email credentials are provided
        if (config.EMAIL_USER && config.EMAIL_PASS) {
            this.transporter = nodemailer.createTransporter({
                host: config.EMAIL_HOST,
                port: config.EMAIL_PORT,
                secure: config.EMAIL_SECURE,
                auth: {
                    user: config.EMAIL_USER,
                    pass: config.EMAIL_PASS
                }
            });

            // Verify connection configuration
            this.transporter.verify((error, success) => {
                if (error) {
                    console.error('Email service configuration error:', error);
                } else {
                    console.log('Email service is ready to send messages');
                }
            });
        } else {
            console.warn('Email service not configured - EMAIL_USER and EMAIL_PASS environment variables not set');
        }
    }

    async sendVerificationEmail(userId, email, firstName) {
        if (!this.transporter) {
            throw new Error('Email service not configured');
        }

        try {
            // Generate verification token
            const token = await this.generateVerificationToken(userId, email);

            // Create verification URL
            const verificationUrl = `${config.EMAIL_VERIFICATION_URL}?token=${token}`;

            // Email content
            const subject = 'Verify Your Tiikii Festival Account';
            const htmlContent = this.getVerificationEmailTemplate(firstName, verificationUrl);
            const textContent = this.getVerificationEmailText(firstName, verificationUrl);

            // Send email
            const mailOptions = {
                from: config.EMAIL_FROM,
                to: email,
                subject: subject,
                text: textContent,
                html: htmlContent
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Verification email sent:', result.messageId);
            return result;

        } catch (error) {
            console.error('Error sending verification email:', error);
            throw error;
        }
    }

    async generateVerificationToken(userId, email) {
        const tokenId = uuidv4();
        const token = uuidv4();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + config.EMAIL_VERIFICATION_EXPIRY_HOURS);

        // Store token in database
        await database.run(
            `INSERT INTO email_verification_tokens (id, user_id, token, email, expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [tokenId, userId, token, email, expiresAt.toISOString()]
        );

        return token;
    }

    async verifyToken(token) {
        try {
            const tokenRecord = await database.get(
                `SELECT id, user_id, email, expires_at, used_at 
                 FROM email_verification_tokens 
                 WHERE token = ?`,
                [token]
            );

            if (!tokenRecord) {
                throw new Error('Invalid verification token');
            }

            if (tokenRecord.used_at) {
                throw new Error('Verification token has already been used');
            }

            const now = new Date();
            const expiresAt = new Date(tokenRecord.expires_at);

            if (now > expiresAt) {
                throw new Error('Verification token has expired');
            }

            return tokenRecord;
        } catch (error) {
            console.error('Error verifying token:', error);
            throw error;
        }
    }

    async markTokenAsUsed(tokenId) {
        await database.run(
            'UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?',
            [tokenId]
        );
    }

    async cleanupExpiredTokens() {
        try {
            const result = await database.run(
                'DELETE FROM email_verification_tokens WHERE expires_at < CURRENT_TIMESTAMP',
                []
            );
            console.log(`Cleaned up ${result.changes} expired verification tokens`);
            return result.changes;
        } catch (error) {
            console.error('Error cleaning up expired tokens:', error);
            throw error;
        }
    }

    getVerificationEmailTemplate(firstName, verificationUrl) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Account - Tiikii Festival</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }
                .content {
                    background: #f9f9f9;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                }
                .button {
                    display: inline-block;
                    background: #667eea;
                    color: white;
                    padding: 15px 30px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                    font-weight: bold;
                }
                .button:hover {
                    background: #5a6fd8;
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    color: #666;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Welcome to Tiikii Festival!</h1>
            </div>
            <div class="content">
                <h2>Hello ${firstName}!</h2>
                <p>Thank you for registering with Tiikii Festival. To complete your account setup, please verify your email address by clicking the button below:</p>
                
                <div style="text-align: center;">
                    <a href="${verificationUrl}" class="button">Verify Email Address</a>
                </div>
                
                <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background: #e9e9e9; padding: 10px; border-radius: 5px;">${verificationUrl}</p>
                
                <p><strong>Important:</strong> This verification link will expire in ${config.EMAIL_VERIFICATION_EXPIRY_HOURS} hours.</p>
                
                <p>If you didn't create an account with Tiikii Festival, please ignore this email.</p>
            </div>
            <div class="footer">
                <p>© 2024 Tiikii Festival. All rights reserved.</p>
                <p>This is an automated message, please do not reply to this email.</p>
            </div>
        </body>
        </html>
        `;
    }

    getVerificationEmailText(firstName, verificationUrl) {
        return `
Welcome to Tiikii Festival!

Hello ${firstName}!

Thank you for registering with Tiikii Festival. To complete your account setup, please verify your email address by visiting the following link:

${verificationUrl}

This verification link will expire in ${config.EMAIL_VERIFICATION_EXPIRY_HOURS} hours.

If you didn't create an account with Tiikii Festival, please ignore this email.

Best regards,
The Tiikii Festival Team

© 2024 Tiikii Festival. All rights reserved.
This is an automated message, please do not reply to this email.
        `;
    }

    // Test method to check if email service is working
    async testEmailConnection() {
        if (!this.transporter) {
            throw new Error('Email service not configured');
        }

        try {
            await this.transporter.verify();
            return true;
        } catch (error) {
            console.error('Email service test failed:', error);
            return false;
        }
    }
}

module.exports = new EmailService();




