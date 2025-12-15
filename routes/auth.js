const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { auth } = require('../middleware/auth');
const { sendOTPEmail, sendWelcomeEmail, testEmailConfig } = require('../services/emailService');

const router = express.Router();

// Test email configuration
router.get('/test-email', async (req, res) => {
  try {
    const isValid = await testEmailConfig();
    if (isValid) {
      res.json({ 
        message: 'Email configuration is valid',
        status: 'success'
      });
    } else {
      res.status(500).json({ 
        message: 'Email configuration is invalid',
        status: 'error'
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      message: 'Email test failed: ' + error.message,
      status: 'error'
    });
  }
});

// Debug OTP records
router.get('/debug-otp/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const otpRecords = await OTP.find({ email, purpose: 'registration' }).sort({ createdAt: -1 });
    
    res.json({
      email,
      otpRecords: otpRecords.map(record => ({
        otp: record.otp,
        isUsed: record.isUsed,
        expiresAt: record.expiresAt,
        createdAt: record.createdAt,
        isExpired: record.expiresAt < new Date()
      }))
    });
  } catch (error) {
    console.error('Debug OTP error:', error);
    res.status(500).json({ message: 'Debug failed: ' + error.message });
  }
});

// Clear all OTPs for an email (for debugging)
router.delete('/clear-otp/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const result = await OTP.deleteMany({ email, purpose: 'registration' });
    
    res.json({
      message: `Cleared ${result.deletedCount} OTP records for ${email}`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Clear OTP error:', error);
    res.status(500).json({ message: 'Clear failed: ' + error.message });
  }
});

// Generate and send OTP for registration
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Test email configuration first
    const emailConfigValid = await testEmailConfig();
    if (!emailConfigValid) {
      return res.status(500).json({ 
        message: 'Email service not configured properly. Please check your email settings.' 
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing OTP for this email
    await OTP.deleteMany({ email, purpose: 'registration' });

    // Save new OTP
    const otpRecord = new OTP({
      email,
      otp,
      purpose: 'registration'
    });

    await otpRecord.save();

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp, 'registration');
    
    if (!emailResult.success) {
      console.error('Email sending failed:', emailResult.error);
      return res.status(500).json({ 
        message: 'Failed to send OTP email: ' + emailResult.error 
      });
    }

    res.json({
      message: 'OTP sent successfully to your email',
      email: email
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Verify OTP and register user
router.post('/verify-otp-register', async (req, res) => {
  try {
    const { name, email, password, role, skills, phone, otp } = req.body;

    // Validate required fields
    if (!name || !email || !password || !otp) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Debug: Log the verification attempt
    console.log('🔍 OTP Verification Debug:');
    console.log('Email:', email);
    console.log('OTP entered:', otp);
    console.log('Current time:', new Date());

    // Find all OTP records for this email
    const allOtps = await OTP.find({ email, purpose: 'registration' }).sort({ createdAt: -1 });
    console.log('All OTP records for this email:', allOtps.map(r => ({
      otp: r.otp,
      isUsed: r.isUsed,
      expiresAt: r.expiresAt,
      isExpired: r.expiresAt < new Date()
    })));

    // Verify OTP
    const otpRecord = await OTP.findOne({
      email,
      otp,
      purpose: 'registration',
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      console.log('❌ OTP verification failed');
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    console.log('✅ OTP verification successful');

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Create new user
    const user = new User({
      name,
      email,
      password,
      role: role || 'student',
      phone,
      skills: skills || []
    });

    await user.save();

    // Send welcome email
    await sendWelcomeEmail(email, name);

    // Create JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered and email verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Verify OTP registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, purpose = 'registration' } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Generate new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing OTP for this email
    await OTP.deleteMany({ email, purpose });

    // Save new OTP
    const otpRecord = new OTP({
      email,
      otp,
      purpose
    });

    await otpRecord.save();

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp, purpose);
    
    if (!emailResult.success) {
      return res.status(500).json({ message: 'Failed to send OTP email' });
    }

    res.json({
      message: 'OTP resent successfully to your email'
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Forgot password - send OTP
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email address' });
    }

    // Test email configuration first
    const emailConfigValid = await testEmailConfig();
    if (!emailConfigValid) {
      return res.status(500).json({ 
        message: 'Email service not configured properly. Please check your email settings.' 
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing OTP for this email
    await OTP.deleteMany({ email, purpose: 'password_reset' });

    // Save new OTP
    const otpRecord = new OTP({
      email,
      otp,
      purpose: 'password_reset'
    });

    await otpRecord.save();

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp, 'password_reset');
    
    if (!emailResult.success) {
      console.error('Email sending failed:', emailResult.error);
      return res.status(500).json({ 
        message: 'Failed to send reset email: ' + emailResult.error 
      });
    }

    res.json({
      message: 'Password reset OTP sent successfully to your email',
      email: email
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Reset password with OTP verification
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Validate required fields
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email address' });
    }

    // Debug: Log the verification attempt
    console.log('🔍 Password Reset OTP Verification Debug:');
    console.log('Email:', email);
    console.log('OTP entered:', otp);
    console.log('Current time:', new Date());

    // Find all OTP records for this email
    const allOtps = await OTP.find({ email, purpose: 'password_reset' }).sort({ createdAt: -1 });
    console.log('All password reset OTP records for this email:', allOtps.map(r => ({
      otp: r.otp,
      isUsed: r.isUsed,
      expiresAt: r.expiresAt,
      isExpired: r.expiresAt < new Date()
    })));

    // Verify OTP
    const otpRecord = await OTP.findOne({
      email,
      otp,
      purpose: 'password_reset',
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      console.log('❌ Password reset OTP verification failed');
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    console.log('✅ Password reset OTP verification successful');

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Update user password
    user.password = newPassword;
    await user.save();

    // Delete all password reset OTPs for this email
    await OTP.deleteMany({ email, purpose: 'password_reset' });

    res.json({
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.json({
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
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, skills, experience, phone, address } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (name) user.name = name;
    if (skills) user.skills = skills;
    if (experience) user.experience = experience;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills,
        experience: user.experience,
        phone: user.phone,
        address: user.address
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
