const nodemailer = require("nodemailer");

const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("⚠️ Email credentials missing. Console mode enabled.");
    return null;
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // MUST be false for 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });
};

const sendOTPEmail = async (email, otp) => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.log(`📧 OTP (Console Mode): ${otp}`);
      return { success: true };
    }

    await transporter.sendMail({
      from: `Stuwork <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email - Stuwork",
      html: `<h2>Your OTP is <b>${otp}</b></h2><p>Valid for 5 minutes.</p>`,
    });

    console.log("✅ OTP email sent successfully");
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending OTP email:", error.message);
    return { success: false };
  }
};

module.exports = { sendOTPEmail };
