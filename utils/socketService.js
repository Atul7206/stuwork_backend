// Socket.io service utility for emitting events
const emitNotification = (userId, notification) => {
  if (global.io) {
    global.io.to(`user:${userId}`).emit('new_notification', notification);
    console.log(`📬 Notification sent to user: ${userId}`);
  }
};

const emitApplicationUpdate = (userId, jobId, applicationData) => {
  if (global.io) {
    global.io.to(`user:${userId}`).emit('application_update', {
      jobId,
      ...applicationData
    });
    console.log(`📝 Application update sent to user: ${userId}`);
  }
};

const emitJobUpdate = (userId, jobData) => {
  if (global.io) {
    global.io.to(`user:${userId}`).emit('job_update', jobData);
    console.log(`💼 Job update sent to user: ${userId}`);
  }
};

const emitNewApplication = (employerId, applicationData) => {
  if (global.io) {
    global.io.to(`user:${employerId}`).emit('new_application', applicationData);
    console.log(`📥 New application notification sent to employer: ${employerId}`);
  }
};

module.exports = {
  emitNotification,
  emitApplicationUpdate,
  emitJobUpdate,
  emitNewApplication
};



