import nodemailer from 'nodemailer';

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });
    }

    async sendPasswordReset(email, resetToken) {
        try {
            const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: email,
                subject: 'Password Reset Request - AI Support',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: 'Georgia', serif; color: #2B2B2B; }
                            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
                            .header { border-bottom: 2px solid #8B7355; padding-bottom: 20px; margin-bottom: 30px; }
                            .title { font-size: 32px; color: #2B2B2B; margin: 0; }
                            .content { line-height: 1.6; }
                            .button { 
                                display: inline-block;
                                background-color: #8B7355;
                                color: white;
                                padding: 12px 30px;
                                text-decoration: none;
                                border-radius: 4px;
                                margin: 20px 0;
                            }
                            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #D4CFC5; color: #4A4A4A; font-size: 14px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1 class="title">Password Reset</h1>
                            </div>
                            <div class="content">
                                <p>Hello,</p>
                                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                                <a href="${resetUrl}" class="button">Reset Password</a>
                                <p>If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
                                <p>This link will expire in 1 hour for security reasons.</p>
                            </div>
                            <div class="footer">
                                <p>Best regards,<br>The AI Support Team</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            await this.transporter.sendMail(mailOptions);
            return { success: true };

        } catch (error) {
            console.error('Email Service Error:', error);
            return { success: false, error: error.message };
        }
    }

    
    async sendEscalationNotification(userEmail, conversationSummary, additionalNotes) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: process.env.SUPPORT_TEAM_EMAIL,
                subject: `Escalated Support Request from ${userEmail}`,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: 'Georgia', serif; color: #2B2B2B; }
                            .container { max-width: 700px; margin: 0 auto; padding: 40px 20px; }
                            .header { background-color: #8B7355; color: white; padding: 20px; margin-bottom: 30px; }
                            .title { font-size: 28px; margin: 0; }
                            .section { margin-bottom: 25px; }
                            .section-title { font-size: 18px; color: #8B7355; margin-bottom: 10px; }
                            .summary { background-color: #F7F4EF; padding: 20px; border-left: 3px solid #8B7355; }
                            .info { color: #4A4A4A; margin-bottom: 5px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1 class="title">🚨 Escalated Support Request</h1>
                            </div>
                            
                            <div class="section">
                                <div class="section-title">Customer Information</div>
                                <p class="info"><strong>Email:</strong> ${userEmail}</p>
                                <p class="info"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                            </div>

                            <div class="section">
                                <div class="section-title">Conversation Summary</div>
                                <div class="summary">
                                    ${conversationSummary}
                                </div>
                            </div>

                            ${additionalNotes ? `
                                <div class="section">
                                    <div class="section-title">Additional Notes</div>
                                    <p>${additionalNotes}</p>
                                </div>
                            ` : ''}

                            <div class="section">
                                <p><strong>Action Required:</strong> Please reach out to the customer at ${userEmail} to resolve their issue.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            await this.transporter.sendMail(mailOptions);
            return { success: true };

        } catch (error) {
            console.error('Escalation Email Error:', error);
            return { success: false, error: error.message };
        }
    }
    async sendConversationSummary(userEmail, summary) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: userEmail,
                subject: 'Your Support Conversation Summary',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: 'Georgia', serif; color: #2B2B2B; }
                            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
                            .header { border-bottom: 2px solid #8B7355; padding-bottom: 20px; margin-bottom: 30px; }
                            .title { font-size: 32px; color: #2B2B2B; margin: 0; }
                            .summary { background-color: #F7F4EF; padding: 20px; line-height: 1.6; }
                            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #D4CFC5; color: #4A4A4A; font-size: 14px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1 class="title">Conversation Summary</h1>
                            </div>
                            <p>Hello,</p>
                            <p>Thank you for contacting our support team. Here's a summary of your recent conversation:</p>
                            <div class="summary">
                                ${summary}
                            </div>
                            <p>Our support team will reach out to you shortly to assist with your request.</p>
                            <div class="footer">
                                <p>Best regards,<br>The AI Support Team</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            await this.transporter.sendMail(mailOptions);
            return { success: true };

        } catch (error) {
            console.error('Summary Email Error:', error);
            return { success: false, error: error.message };
        }
    }
}

export const emailService = new EmailService();