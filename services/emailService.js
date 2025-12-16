const nodemailer = require("nodemailer");

/**
 * Create Nodemailer transporter (PRODUCTION SAFE)
 */
const createTransporter = () => {
  // If email credentials are missing → console mode
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("⚠️ Email credentials not configured. Using console mode.");
    return null;
  }

  // ✅ Explicit SMTP configuration (WORKS on Render)
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // MUST be false for port 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // App Password (NO SPACES)
    },
  });
};

/**
 * Verify email configuration
 */
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.log("✅ Console mode enabled (email skipped)");
      return true;
    }

    await transporter.verify();
    console.log("✅ Email configuration is valid");
    return true;
  } catch (error) {
    console.error("❌ Email configuration error:", error.message);
    return false;
  }
};

/**
 * Send OTP email
 */
const sendOTPEmail = async (email, otp, purpose = "registration") => {
  try {
    const transporter = createTransporter();

    // Console mode (email disabled)
    if (!transporter) {
      console.log("========== OTP (Console Mode) ==========");
      console.log("To:", email);
      console.log("OTP:", otp);
      console.log("========================================");
      return { success: true, messageId: "console-mode" };
    }

    const subject =
      purpose === "registration"
        ? "Verify Your Email - Stuwork"
        : "Password Reset OTP - Stuwork";

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Stuwork</h2>
        <p>Your OTP is:</p>
        <h1 style="letter-spacing: 6px;">${otp}</h1>
        <p>This OTP is valid for 5 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `;

    const result = await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.EMAIL_USER,
      to: email,
      subject,
      html,
    });

    console.log("✅ OTP email sent:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("❌ Error sending OTP email:", error.message);

    // IMPORTANT: Do NOT block registration
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome email (after verification)
 */
const sendWelcomeEmail = async (email, name) => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.log(`🎉 Welcome ${name}! (Console mode)`);
      return { success: true, messageId: "console-mode" };
    }

    const frontendUrl =
      process.env.FRONTEND_URL || "http://localhost:3000";

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome to Stuwork, ${name} 🎉</h2>
        <p>Your account has been successfully verified.</p>
        <a href="${frontendUrl}/dashboard">Go to Dashboard</a>
      </div>
    `;

    const result = await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to Stuwork!",
      html,
    });

    console.log("✅ Welcome email sent:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("❌ Error sending welcome email:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOTPEmail,
  sendWelcomeEmail,
  testEmailConfig,
};
