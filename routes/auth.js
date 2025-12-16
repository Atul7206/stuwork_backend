const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { auth } = require('../middleware/auth');
const { sendOTPEmail, sendWelcomeEmail } = require('../services/emailService');

const router = express.Router();

/* ============================
   SEND OTP FOR REGISTRATION
============================ */
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await OTP.deleteMany({ email, purpose: 'registration' });

    await OTP.create({
      email,
      otp,
      purpose: 'registration'
    });

    const emailResult = await sendOTPEmail(email, otp);

    if (!emailResult.success) {
      return res.status(500).json({ message: 'Failed to send OTP email' });
    }

    return res.json({
      message: 'OTP sent successfully to your email',
      email
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ============================
   VERIFY OTP & REGISTER USER
============================ */
router.post('/verify-otp-register', async (req, res) => {
  try {
    const { name, email, password, role, skills, phone, otp } = req.body;

    if (!name || !email || !password || !otp) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const otpRecord = await OTP.findOne({
      email,
      otp,
      purpose: 'registration',
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    otpRecord.isUsed = true;
    await otpRecord.save();

    const user = new User({
      name,
      email,
      password,
      role: role || 'student',
      phone,
      skills: skills || [],
      isVerified: true
    });

    await user.save();

    await sendWelcomeEmail(email, name);

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ============================
   RESEND OTP
============================ */
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, purpose = 'registration' } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await OTP.deleteMany({ email, purpose });

    await OTP.create({
      email,
      otp,
      purpose
    });

    const emailResult = await sendOTPEmail(email, otp);

    if (!emailResult.success) {
      return res.status(500).json({ message: 'Failed to resend OTP email' });
    }

    return res.json({ message: 'OTP resent successfully' });

  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ============================
   FORGOT PASSWORD - SEND OTP
============================ */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await OTP.deleteMany({ email, purpose: 'password_reset' });

    await OTP.create({
      email,
      otp,
      purpose: 'password_reset'
    });

    const emailResult = await sendOTPEmail(email, otp);

    if (!emailResult.success) {
      return res.status(500).json({ message: 'Failed to send reset OTP email' });
    }

    return res.json({ message: 'Password reset OTP sent successfully' });

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ============================
   RESET PASSWORD
============================ */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const otpRecord = await OTP.findOne({
      email,
      otp,
      purpose: 'password_reset',
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    otpRecord.isUsed = true;
    await otpRecord.save();

    user.password = newPassword;
    await user.save();

    await OTP.deleteMany({ email, purpose: 'password_reset' });

    return res.json({ message: 'Password reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ============================
   LOGIN
============================ */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ============================
   PROFILE ROUTES
============================ */
router.get('/profile', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
});

router.put('/profile', auth, async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    req.body,
    { new: true }
  ).select('-password');

  res.json({ message: 'Profile updated', user });
});

module.exports = router;
