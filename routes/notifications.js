const express = require('express');
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get user notifications
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .populate('relatedJob', 'title')
      .sort({ createdAt: -1 });
    
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notification as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create notification helper function
const createNotification = async (userId, message, type, relatedJobId = null) => {
  try {
    const notification = new Notification({
      user: userId,
      message,
      type,
      relatedJob: relatedJobId
    });
    await notification.save();
    
    // Populate related job for socket emission
    await notification.populate('relatedJob', 'title');
    
    // Emit real-time notification via Socket.io
    const { emitNotification } = require('../utils/socketService');
    emitNotification(userId, notification);
    
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
  }
};

module.exports = { router, createNotification };
