const express = require('express');
const Job = require('../models/Job');
const { auth } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { emitApplicationUpdate, emitNewApplication, emitJobUpdate } = require('../utils/socketService');

const router = express.Router();

// Get all jobs (public)
router.get('/', async (req, res) => {
  try {
    const jobs = await Job.find({ isActive: true })
      .populate('employer', 'name')
      .sort({ createdAt: -1 });
    
    res.json(jobs);
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single job
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('employer', 'name email phone');
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new job (employers only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only employers can create jobs' });
    }

    const {
      title,
      description,
      location,
      salary,
      type,
      requirements,
      skills,
      benefits
    } = req.body;

    const job = new Job({
      title,
      description,
      location,
      salary,
      type,
      requirements: requirements || [],
      skills: skills || [],
      benefits: benefits || '',
      employer: req.user.id
    });

    await job.save();
    await job.populate('employer', 'name');

    // Emit job creation event to employer
    emitJobUpdate(req.user.id, {
      jobId: job._id,
      action: 'created',
      job: job
    });

    res.status(201).json({
      message: 'Job created successfully',
      job
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Apply for job (students only)
router.post('/:id/apply', auth, async (req, res) => {
  try {
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'student') {
      return res.status(403).json({ message: 'Only students can apply for jobs' });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check if already applied
    const alreadyApplied = job.applicants.some(
      applicant => applicant.user.toString() === req.user.id
    );

    if (alreadyApplied) {
      return res.status(400).json({ message: 'You have already applied for this job' });
    }

    // Add applicant
    job.applicants.push({
      user: req.user.id,
      status: 'pending'
    });

    await job.save();
    await job.populate('employer', 'name');

    // Notify employer about the new application
    if (job.employer) {
      await createNotification(
        job.employer,
        `${req.user.name || 'A student'} applied for "${job.title}".`,
        'new_application',
        job._id
      );
      
      // Emit real-time event to employer
      emitNewApplication(job.employer._id.toString(), {
        jobId: job._id,
        jobTitle: job.title,
        applicantName: req.user.name,
        applicantId: req.user.id,
        appliedAt: new Date()
      });
    }

    res.json({ message: 'Application submitted successfully' });
  } catch (error) {
    console.error('Apply job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get jobs created by employer
router.get('/employer/my-jobs', auth, async (req, res) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only employers can view their jobs' });
    }

    const jobs = await Job.find({ employer: req.user.id })
      .populate('applicants.user', 'name email skills experience phone address')
      .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (error) {
    console.error('Get employer jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get jobs applied by student
router.get('/student/my-applications', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can view their applications' });
    }

    const jobs = await Job.find({
      'applicants.user': req.user.id
    })
      .populate('employer', 'name')
      .sort({ createdAt: -1 });

    // Filter to show only the user's applications
    const userApplications = jobs.map(job => {
      const userApplication = job.applicants.find(
        applicant => applicant.user.toString() === req.user.id
      );
      return {
        ...job.toObject(),
        applicationStatus: userApplication.status,
        appliedAt: userApplication.appliedAt
      };
    });

    res.json(userApplications);
  } catch (error) {
    console.error('Get student applications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark job as completed (employer only)
router.put('/:id/complete', auth, async (req, res) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only employers can mark jobs completed' });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.employer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only update your own jobs' });
    }

    job.completed = true;
    job.isActive = false;
    await job.save();

    res.json({ message: 'Job marked as completed' });
  } catch (error) {
    console.error('Complete job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update job status (employer only)
router.put('/:id/application/:applicationId/status', auth, async (req, res) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only employers can update application status' });
    }

    const { status } = req.body;
    const job = await Job.findById(req.params.id).populate('applicants.user', 'name email skills experience phone address');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.employer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only update applications for your own jobs' });
    }

    const application = job.applicants.id(req.params.applicationId);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    application.status = status;
    
    // If application is accepted, automatically reject all other pending applications
    if (status === 'accepted') {
      job.isActive = false;
      
      // Reject all other pending applications
      job.applicants.forEach(applicant => {
        if (applicant._id.toString() !== req.params.applicationId && applicant.status === 'pending') {
          applicant.status = 'rejected';
          
          // Create notification for rejected applicants
          if (applicant.user) {
            createNotification(
              applicant.user,
              `Your application for "${job.title}" has been reviewed. Unfortunately, we won't be moving forward with your application at this time.`,
              'application_rejected',
              job._id
            ).catch(err => console.error('Error creating rejection notification:', err));
          }
        }
      });
    }
    
    await job.save();

    // Create notification for the applicant
    const applicant = application.user;
    if (applicant) {
      let message = '';
      if (status === 'accepted') {
        message = `Congratulations! Your application for "${job.title}" has been accepted.`;
      } else if (status === 'rejected') {
        message = `Your application for "${job.title}" has been reviewed. Unfortunately, we won't be moving forward with your application at this time.`;
      }

      if (message) {
        await createNotification(
          applicant._id,
          message,
          status === 'accepted' ? 'application_accepted' : 'application_rejected',
          job._id
        );
        
        // Emit real-time application status update to student
        emitApplicationUpdate(applicant._id.toString(), job._id.toString(), {
          status,
          jobTitle: job.title,
          jobId: job._id
        });
      }
    }
    
    // Emit job update to employer (refresh their view)
    emitJobUpdate(req.user.id, {
      jobId: job._id,
      applicants: job.applicants,
      isActive: job.isActive
    });

    res.json({ message: 'Application status updated successfully' });
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update job details (employer only)
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only employers can update jobs' });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.employer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only update your own jobs' });
    }

    const updatedJob = await Job.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('employer', 'name');

    res.json({
      message: 'Job updated successfully',
      job: updatedJob
    });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
