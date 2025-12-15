const nodemailer = require('nodemailer');

// Create transporter for sending emails
const createTransporter = () => {
  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('⚠️ Email credentials not configured. Using console mode for testing.');
    return null; // Return null to indicate console mode
  }

  // Try multiple email services
  const emailUser = process.env.EMAIL_USER;
  
  // Check if it's a Gmail account
  if (emailUser.includes('@gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  
  // Check if it's an Outlook/Hotmail account
  if (emailUser.includes('@outlook.com') || emailUser.includes('@hotmail.com')) {
    return nodemailer.createTransport({
      service: 'hotmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  
  // For other email providers, use SMTP
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    
    // If no transporter (console mode), return true for testing
    if (!transporter) {
      console.log('✅ Running in console mode - OTP will be logged to console');
      return true;
    }
    
    await transporter.verify();
    console.log('✅ Email configuration is valid');
    return true;
  } catch (error) {
    console.error('❌ Email configuration error:', error.message);
    return false;
  }
};

// Send OTP email
const sendOTPEmail = async (email, otp, purpose = 'registration') => {
  try {
    const transporter = createTransporter();
    
    // If no transporter (console mode), log OTP to console
    if (!transporter) {
      console.log('\n' + '='.repeat(50));
      console.log('📧 OTP EMAIL (Console Mode)');
      console.log('='.repeat(50));
      console.log(`To: ${email}`);
      console.log(`Subject: Verify Your Email - Stuwork Registration`);
      console.log(`OTP Code: ${otp}`);
      console.log('='.repeat(50));
      console.log('⚠️  This OTP is valid for 5 minutes');
      console.log('⚠️  Enter this code in the verification form');
      console.log('='.repeat(50) + '\n');
      
      return { success: true, messageId: 'console-mode' };
    }
    
    const subject = purpose === 'registration' 
      ? 'Verify Your Email - Stuwork Registration'
      : 'Password Reset OTP - Stuwork';
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Stuwork</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Student Work Management System</p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #374151; margin-top: 0;">
            ${purpose === 'registration' ? 'Verify Your Email Address' : 'Reset Your Password'}
          </h2>
          
          <p style="color: #6b7280; line-height: 1.6;">
            ${purpose === 'registration' 
              ? 'Thank you for registering with Stuwork! To complete your registration, please verify your email address using the OTP below:'
              : 'You requested a password reset. Use the OTP below to reset your password:'
            }
          </p>
          
          <div style="background-color: white; border: 2px solid #4F46E5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <h3 style="color: #4F46E5; font-size: 32px; letter-spacing: 8px; margin: 0; font-family: monospace;">
              ${otp}
            </h3>
          </div>
          
          <p style="color: #6b7280; line-height: 1.6;">
            <strong>Important:</strong>
            <ul style="color: #6b7280;">
              <li>This OTP is valid for 5 minutes only</li>
              <li>Do not share this OTP with anyone</li>
              <li>If you didn't request this, please ignore this email</li>
            </ul>
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 14px; margin: 0;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </div>
      </div>
    `;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: htmlContent
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('OTP email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return { success: false, error: error.message };
  }
};

// Send welcome email after successful verification
const sendWelcomeEmail = async (email, name) => {
  try {
    const transporter = createTransporter();
    
    // If no transporter (console mode), skip welcome email
    if (!transporter) {
      console.log(`\n🎉 Welcome ${name}! Email verification completed successfully.`);
      return { success: true, messageId: 'console-mode' };
    }
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Stuwork</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Student Work Management System</p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #374151; margin-top: 0;">Welcome to Stuwork, ${name}!</h2>
          
          <p style="color: #6b7280; line-height: 1.6;">
            Your email has been successfully verified and your account is now active. 
            You can now start exploring job opportunities and managing your applications.
          </p>
          
          <div style="background-color: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #4F46E5; margin-top: 0;">What you can do next:</h3>
            <ul style="color: #6b7280; line-height: 1.8;">
              <li>Complete your profile with skills and experience</li>
              <li>Browse available job opportunities</li>
              <li>Apply for jobs that match your interests</li>
              <li>Track your application status</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Go to Dashboard
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 14px; margin: 0;">
              Thank you for choosing Stuwork!
            </p>
          </div>
        </div>
      </div>
    `;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to Stuwork - Email Verified Successfully!',
      html: htmlContent
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOTPEmail,
  sendWelcomeEmail,
  testEmailConfig
};