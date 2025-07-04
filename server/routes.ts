import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { 
  insertExperienceSchema,
  insertEducationSchema,
  insertSkillSchema,
  insertCompanySchema,
  insertJobSchema,
  insertJobApplicationSchema,
  insertConnectionSchema,
  insertMessageSchema,
  insertGroupSchema,
  insertVendorSchema,
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Configure multer for image uploads (company logos, profile pictures)
const imageUpload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, PNG, and GIF images are allowed'));
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for images
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication FIRST before any other routes
  setupAuth(app);
  
  // Serve static files from uploads directory
  app.use('/uploads', express.static('uploads'));
  
  // Public routes (before auth middleware)
  
  // Get open jobs and vendors for a company (public endpoint)
  app.get('/api/companies/:id/details', async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      // Get active jobs for the company
      const jobs = await storage.getJobsByCompany(companyId);
      const openJobs = jobs.filter((job: any) => job.isActive === true);

      // Get vendors for the company
      const vendors = await storage.getClientVendors(companyId);

      res.json({
        openJobs,
        vendors
      });
    } catch (error) {
      console.error("Error fetching company details:", error);
      res.status(500).json({ message: "Failed to fetch company details" });
    }
  });

  // Test database connection endpoint
  app.get('/api/test-db-connection', async (req, res) => {
    try {
      const result = await storage.getUserByEmail('test@example.com');
      res.json({ 
        status: 'success', 
        userFound: !!result,
        userEmail: result?.email || 'not found'
      });
    } catch (error) {
      res.status(500).json({ status: 'error', error: error.message });
    }
  });

  // Authentication middleware for session-based auth
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.session?.user) {
      req.user = req.session.user; // Set user on request object
      return next();
    }
    res.status(401).json({ message: "Authentication required" });
  };

  const customAuth = isAuthenticated;



  // Global search endpoint
  app.get('/api/search', async (req, res) => {
    try {
      const query = (req.query.q || req.query.query) as string;
      if (!query || query.trim().length < 3) {
        return res.json({ companies: [], jobs: [] });
      }

      // Search companies and jobs in parallel
      const [companies, jobs] = await Promise.all([
        storage.searchCompanies(query, 10),
        storage.searchJobs(query, {}, 10)
      ]);

      res.json({
        companies: companies || [],
        jobs: jobs || []
      });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Profile routes
  app.get('/api/profile/:id', async (req, res) => {
    try {
      const profile = await storage.getUserProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.put('/api/profile', customAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const updateData = req.body;
      const user = await storage.updateUserProfile(userId, updateData);
      res.json(user);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Experience routes
  app.get('/api/experiences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const experiences = await storage.getUserExperiences(userId);
      res.json(experiences);
    } catch (error) {
      console.error("Error fetching experiences:", error);
      res.status(500).json({ message: "Failed to fetch experiences" });
    }
  });

  app.post('/api/experiences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertExperienceSchema.parse({ ...req.body, userId });
      const experience = await storage.addExperience(validatedData);
      res.json(experience);
    } catch (error) {
      console.error("Error adding experience:", error);
      res.status(500).json({ message: "Failed to add experience" });
    }
  });

  app.put('/api/experiences/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const experience = await storage.updateExperience(id, req.body);
      res.json(experience);
    } catch (error) {
      console.error("Error updating experience:", error);
      res.status(500).json({ message: "Failed to update experience" });
    }
  });

  app.delete('/api/experiences/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteExperience(id);
      res.json({ message: "Experience deleted successfully" });
    } catch (error) {
      console.error("Error deleting experience:", error);
      res.status(500).json({ message: "Failed to delete experience" });
    }
  });

  // Education routes
  app.get('/api/education', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const education = await storage.getUserEducation(userId);
      res.json(education);
    } catch (error) {
      console.error("Error fetching education:", error);
      res.status(500).json({ message: "Failed to fetch education" });
    }
  });

  app.post('/api/education', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertEducationSchema.parse({ ...req.body, userId });
      const education = await storage.addEducation(validatedData);
      res.json(education);
    } catch (error) {
      console.error("Error adding education:", error);
      res.status(500).json({ message: "Failed to add education" });
    }
  });

  app.put('/api/education/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const education = await storage.updateEducation(id, req.body);
      res.json(education);
    } catch (error) {
      console.error("Error updating education:", error);
      res.status(500).json({ message: "Failed to update education" });
    }
  });

  app.delete('/api/education/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEducation(id);
      res.json({ message: "Education deleted successfully" });
    } catch (error) {
      console.error("Error deleting education:", error);
      res.status(500).json({ message: "Failed to delete education" });
    }
  });

  // Skills routes
  app.get('/api/skills', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const skills = await storage.getUserSkills(userId);
      res.json(skills);
    } catch (error) {
      console.error("Error fetching skills:", error);
      res.status(500).json({ message: "Failed to fetch skills" });
    }
  });

  app.post('/api/skills', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertSkillSchema.parse({ ...req.body, userId });
      const skill = await storage.addSkill(validatedData);
      res.json(skill);
    } catch (error) {
      console.error("Error adding skill:", error);
      res.status(500).json({ message: "Failed to add skill" });
    }
  });

  app.delete('/api/skills/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSkill(id);
      res.json({ message: "Skill deleted successfully" });
    } catch (error) {
      console.error("Error deleting skill:", error);
      res.status(500).json({ message: "Failed to delete skill" });
    }
  });

  // Get ALL companies for job creation dropdown
  app.get('/api/companies/all', async (req, res) => {
    try {
      const companies = await storage.getCompanies(50000); // Load all companies
      res.json(companies);
    } catch (error) {
      console.error("Error fetching all companies:", error);
      res.status(500).json({ message: "Failed to fetch all companies" });
    }
  });

  // Company routes - Get all companies for job creation
  app.get('/api/companies/all', async (req, res) => {
    try {
      const companies = await storage.getCompanies(50000); // Get all approved companies
      res.json(companies);
    } catch (error) {
      console.error("Error fetching all companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  // Company routes - Get companies with optional search
  app.get('/api/companies', async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 0;
      
      console.log(`DEBUG ROUTE: /api/companies called with query="${query}", limit=${limit}`);
      
      if (query && query !== 'undefined' && query.length >= 2) {
        // Search with dynamic limit - higher for job creation
        const searchLimit = limit > 100 ? Math.min(limit, 1000) : 100;
        console.log(`DEBUG ROUTE: Calling searchCompanies with query="${query}", searchLimit=${searchLimit}`);
        const companies = await storage.searchCompanies(query, searchLimit);
        console.log(`DEBUG ROUTE: searchCompanies returned ${companies.length} companies`);
        res.json(companies);
      } else if (limit > 0) {
        // Allow high limits for complete company access
        const actualLimit = limit >= 50000 ? 50000 : limit;
        console.log(`DEBUG ROUTE: limit=${limit}, actualLimit=${actualLimit}`);
        console.log(`DEBUG ROUTE: Calling getCompanies with limit=${actualLimit}`);
        const companies = await storage.getCompanies(actualLimit);
        console.log(`DEBUG ROUTE: getCompanies returned ${companies.length} companies`);
        res.json(companies);
      } else {
        // No query and no limit - return reasonable sample
        console.log(`DEBUG ROUTE: Returning sample of companies`);
        const companies = await storage.getCompanies(100);
        res.json(companies);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  // Get pending companies (admin only) - Must come before /:id route
  app.get('/api/companies/pending', async (req: any, res) => {
    try {
      // Temporarily bypass auth for testing
      const pendingCompanies = await storage.getPendingCompanies();
      res.json(pendingCompanies);
    } catch (error) {
      console.error("Error fetching pending companies:", error);
      res.status(500).json({ message: "Failed to fetch pending companies" });
    }
  });

  app.get('/api/companies/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }
      const company = await storage.getCompany(id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  // Company logo upload route
  app.post('/api/upload/company-logo', imageUpload.single('logo'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const ext = path.extname(req.file.originalname);
      const filename = `company-logo-${timestamp}${ext}`;
      const logoUrl = `/logos/${filename}`;

      // Rename file to have proper extension
      const oldPath = req.file.path;
      const newPath = path.join('logos', filename);
      
      fs.renameSync(oldPath, newPath);

      res.json({ logoUrl });
    } catch (error) {
      console.error("Error uploading company logo:", error);
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  app.post('/api/companies', async (req: any, res) => {
    try {
      // Use admin user for testing
      const userId = "admin-krupa";
      const validatedData = insertCompanySchema.parse({ ...req.body, userId });
      const company = await storage.createCompany(validatedData);
      res.json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  // Update company status (admin only)
  app.patch('/api/companies/:id/status', async (req: any, res) => {
    try {
      // Use admin user for testing
      const userId = "admin-krupa";
      
      const companyId = parseInt(req.params.id);
      const { status, approvedBy } = req.body;
      
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }
      
      const company = await storage.updateCompanyStatus(companyId, status, approvedBy || userId);
      res.json(company);
    } catch (error) {
      console.error("Error updating company status:", error);
      res.status(500).json({ message: "Failed to update company status" });
    }
  });

  // Approve company
  app.put('/api/companies/:id/approve', async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const userId = "admin-krupa";
      
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }
      
      const company = await storage.updateCompanyStatus(companyId, "approved", userId);
      res.json(company);
    } catch (error) {
      console.error("Error approving company:", error);
      res.status(500).json({ message: "Failed to approve company" });
    }
  });

  // Reject company
  app.put('/api/companies/:id/reject', async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const userId = "admin-krupa";
      
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }
      
      const company = await storage.updateCompanyStatus(companyId, "rejected", userId);
      res.json(company);
    } catch (error) {
      console.error("Error rejecting company:", error);
      res.status(500).json({ message: "Failed to reject company" });
    }
  });

  // Admin stats endpoint
  app.get('/api/admin/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userEmail = req.user.email;
      
      // Check if user is admin
      if (userEmail !== 'krupas@vedsoft.com' && userEmail !== 'krupashankar@gmail.com') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get basic stats
      const jobs = await storage.getJobs({}, 1000);
      const activeJobs = jobs.filter((job: any) => job.status !== 'closed').length;
      
      res.json({
        activeJobs,
        totalUsers: 0,
        revenue: 0,
        activeSessions: 0
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Vendor management routes (temporary bypass for testing)
  app.post('/api/vendors', async (req: any, res) => {
    try {
      const vendorData = {
        ...req.body,
        createdBy: 'admin-krupa', // temporary for testing
      };

      const vendor = await storage.addVendor(vendorData);
      res.json(vendor);
    } catch (error) {
      console.error("Error adding vendor:", error);
      res.status(500).json({ message: "Failed to add vendor" });
    }
  });

  // Get vendors for a company (temporary bypass for testing)
  app.get('/api/companies/:id/vendors', async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      const vendors = await storage.getClientVendors(companyId);
      res.json(vendors);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.put('/api/companies/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.updateCompany(id, req.body);
      res.json(company);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  // Individual job route
  app.get('/api/jobs/:id', async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      res.json(job);
    } catch (error) {
      console.error('Error fetching job:', error);
      res.status(500).json({ error: 'Failed to fetch job' });
    }
  });

  // Job routes
  app.get('/api/jobs', async (req, res) => {
    try {
      const filters = {
        jobType: req.query.jobType as string,
        experienceLevel: req.query.experienceLevel as string,
        location: req.query.location as string,
        companyId: req.query.companyId ? parseInt(req.query.companyId as string) : undefined,
      };
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      console.log('Jobs API called with filters:', filters, 'limit:', limit);
      
      if (req.query.search) {
        console.log('Searching jobs with query:', req.query.search);
        const jobs = await storage.searchJobs(req.query.search as string, filters);
        console.log('Search returned', jobs.length, 'jobs');
        res.json(jobs);
      } else {
        console.log('Getting all jobs with filters');
        const jobs = await storage.getJobs(filters, limit);
        console.log('getJobs returned', jobs.length, 'jobs');
        res.json(jobs);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  app.get('/api/jobs/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  app.put('/api/jobs/:id', isAuthenticated, async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const jobData = insertJobSchema.parse(req.body);
      
      const updatedJob = await storage.updateJob(jobId, jobData);
      res.json(updatedJob);
    } catch (error) {
      console.error('Error updating job:', error);
      res.status(500).json({ error: 'Failed to update job' });
    }
  });

  app.post('/api/jobs', async (req: any, res) => {
    try {
      // Use admin user for testing
      const userId = "admin-krupa";
      console.log("Creating job with data:", req.body);
      console.log("User ID:", userId);
      
      // Auto-generate location from city, state, country and map jobType to employmentType
      const jobData = { 
        ...req.body, 
        recruiterId: userId,
        employmentType: req.body.jobType || "full_time" // Map jobType to employmentType for database
      };
      if (jobData.city && jobData.state && jobData.country) {
        jobData.location = `${jobData.city}, ${jobData.state}, ${jobData.country}`;
      }
      
      const validatedData = insertJobSchema.parse(jobData);
      console.log("Validated data:", validatedData);
      
      const job = await storage.createJob(validatedData);
      res.json(job);
    } catch (error) {
      console.error("Error creating job:", error);
      console.error("Error details:", error.message);
      if (error.errors) {
        console.error("Validation errors:", error.errors);
      }
      res.status(500).json({ 
        message: "Failed to create job", 
        error: error.message,
        details: error.errors || []
      });
    }
  });

  app.put('/api/jobs/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.updateJob(id, req.body);
      res.json(job);
    } catch (error) {
      console.error("Error updating job:", error);
      res.status(500).json({ message: "Failed to update job" });
    }
  });

  app.delete('/api/jobs/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteJob(id);
      res.json({ message: "Job deleted successfully" });
    } catch (error) {
      console.error("Error deleting job:", error);
      res.status(500).json({ message: "Failed to delete job" });
    }
  });

  // Job Application routes
  app.get('/api/applications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log("Fetching applications for user:", userId);
      const applications = await storage.getUserJobApplications(userId);
      console.log("Applications found:", applications.length);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.get('/api/jobs/:id/applications', isAuthenticated, async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const applications = await storage.getJobApplications(jobId);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching job applications:", error);
      res.status(500).json({ message: "Failed to fetch job applications" });
    }
  });

  app.post('/api/applications', isAuthenticated, upload.single('resume'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const resumeUrl = req.file ? `/uploads/${req.file.filename}` : null;
      
      const validatedData = insertJobApplicationSchema.parse({
        ...req.body,
        jobId: parseInt(req.body.jobId),
        applicantId: userId,
        resumeUrl,
      });
      
      const application = await storage.createJobApplication(validatedData);
      res.json(application);
    } catch (error) {
      console.error("Error creating application:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid application data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create application" });
    }
  });

  app.patch('/api/applications/:id/status', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const application = await storage.updateJobApplicationStatus(id, status);
      res.json(application);
    } catch (error) {
      console.error("Error updating application status:", error);
      res.status(500).json({ message: "Failed to update application status" });
    }
  });

  app.delete('/api/applications/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteJobApplication(id);
      res.json({ message: "Application withdrawn successfully" });
    } catch (error) {
      console.error("Error withdrawing application:", error);
      res.status(500).json({ message: "Failed to withdraw application" });
    }
  });

  // Connection routes
  app.get('/api/connections', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const connections = await storage.getUserConnections(userId);
      res.json(connections);
    } catch (error) {
      console.error("Error fetching connections:", error);
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  app.get('/api/connection-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const requests = await storage.getConnectionRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching connection requests:", error);
      res.status(500).json({ message: "Failed to fetch connection requests" });
    }
  });

  app.post('/api/connections', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertConnectionSchema.parse({
        ...req.body,
        requesterId: userId,
      });
      const connection = await storage.createConnection(validatedData);
      res.json(connection);
    } catch (error) {
      console.error("Error creating connection:", error);
      res.status(500).json({ message: "Failed to create connection" });
    }
  });

  app.put('/api/connections/:id/status', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const connection = await storage.updateConnectionStatus(id, status);
      res.json(connection);
    } catch (error) {
      console.error("Error updating connection status:", error);
      res.status(500).json({ message: "Failed to update connection status" });
    }
  });

  // Message routes
  app.get('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get('/api/messages/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const otherUserId = req.params.userId;
      const messages = await storage.getUserMessages(userId, otherUserId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertMessageSchema.parse({
        ...req.body,
        senderId: userId,
      });
      const message = await storage.createMessage(validatedData);
      res.json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.put('/api/messages/:id/read', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const message = await storage.markMessageAsRead(id);
      res.json(message);
    } catch (error) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  // Group routes
  app.get('/api/groups', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const groups = await storage.getGroups(limit);
      res.json(groups);
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  app.get('/api/user/groups', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const groups = await storage.getUserGroups(userId);
      res.json(groups);
    } catch (error) {
      console.error("Error fetching user groups:", error);
      res.status(500).json({ message: "Failed to fetch user groups" });
    }
  });

  app.post('/api/groups', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertGroupSchema.parse({
        ...req.body,
        createdBy: userId,
      });
      const group = await storage.createGroup(validatedData);
      res.json(group);
    } catch (error) {
      console.error("Error creating group:", error);
      res.status(500).json({ message: "Failed to create group" });
    }
  });

  app.post('/api/groups/:id/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const groupId = parseInt(req.params.id);
      await storage.joinGroup(groupId, userId);
      res.json({ message: "Successfully joined group" });
    } catch (error) {
      console.error("Error joining group:", error);
      res.status(500).json({ message: "Failed to join group" });
    }
  });

  // Global Search API - Search both companies and jobs
  app.get('/api/search/:query', async (req, res) => {
    try {
      const query = req.params.query;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      if (!query || query.length < 2) {
        return res.json({ companies: [], jobs: [] });
      }

      // Search companies and jobs in parallel
      const [companies, jobs] = await Promise.all([
        storage.searchCompanies(query, limit),
        storage.searchJobs(query, { limit })
      ]);

      res.json({
        companies: companies || [],
        jobs: jobs || [],
        total: (companies?.length || 0) + (jobs?.length || 0)
      });
    } catch (error) {
      console.error("Error in global search:", error);
      res.status(500).json({ 
        message: "Failed to perform search",
        companies: [],
        jobs: []
      });
    }
  });

  // Vendor Management Routes
  app.get('/api/clients/:id/vendors', isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      const vendors = await storage.getClientVendors(clientId);
      res.json(vendors);
    } catch (error) {
      console.error("Error fetching client vendors:", error);
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.post('/api/vendors', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertVendorSchema.parse(req.body);
      const vendor = await storage.addVendor({
        ...validatedData,
        addedBy: req.user.id,
      });
      res.status(201).json(vendor);
    } catch (error) {
      console.error("Error adding vendor:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid vendor data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add vendor" });
    }
  });

  // Location API endpoints
  app.get('/api/countries', async (req, res) => {
    try {
      const countries = await storage.getCountries();
      res.json(countries);
    } catch (error) {
      console.error("Error fetching countries:", error);
      res.status(500).json({ message: "Failed to fetch countries" });
    }
  });

  app.get('/api/states/:countryId', async (req, res) => {
    try {
      const countryId = parseInt(req.params.countryId);
      if (isNaN(countryId)) {
        return res.status(400).json({ message: "Invalid country ID" });
      }
      const states = await storage.getStatesByCountry(countryId);
      res.json(states);
    } catch (error) {
      console.error("Error fetching states:", error);
      res.status(500).json({ message: "Failed to fetch states" });
    }
  });

  app.get('/api/cities/:stateId', async (req, res) => {
    try {
      const stateId = parseInt(req.params.stateId);
      if (isNaN(stateId)) {
        return res.status(400).json({ message: "Invalid state ID" });
      }
      const cities = await storage.getCitiesByState(stateId);
      res.json(cities);
    } catch (error) {
      console.error("Error fetching cities:", error);
      res.status(500).json({ message: "Failed to fetch cities" });
    }
  });

  // Admin Routes - Platform Admin can approve vendors and edit jobs
  app.get('/api/admin/vendors/pending', isAuthenticated, async (req, res) => {
    try {
      const pendingVendors = await storage.getPendingVendors();
      res.json(pendingVendors);
    } catch (error) {
      console.error("Error fetching pending vendors:", error);
      res.status(500).json({ message: "Failed to fetch pending vendors" });
    }
  });

  app.patch('/api/admin/vendors/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const vendorId = parseInt(req.params.id);
      const { status } = req.body;
      const vendor = await storage.updateVendorStatus(vendorId, status, req.user.id);
      res.json(vendor);
    } catch (error) {
      console.error("Error updating vendor status:", error);
      res.status(500).json({ message: "Failed to update vendor status" });
    }
  });

  app.patch('/api/admin/jobs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const validatedData = insertJobSchema.partial().parse(req.body);
      const job = await storage.updateJob(jobId, validatedData);
      res.json(job);
    } catch (error) {
      console.error("Error updating job:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid job data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update job" });
    }
  });

  app.patch('/api/admin/companies/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { status } = req.body;
      const company = await storage.updateCompany(companyId, { status });
      res.json(company);
    } catch (error) {
      console.error("Error updating company status:", error);
      res.status(500).json({ message: "Failed to update company status" });
    }
  });

  // Category routes
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', isAuthenticated, async (req: any, res) => {
    try {
      const category = await storage.createCategory(req.body);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  // Location routes
  app.get('/api/countries', async (req, res) => {
    try {
      const countries = await storage.getCountries();
      res.json(countries);
    } catch (error) {
      console.error("Error fetching countries:", error);
      res.status(500).json({ message: "Failed to fetch countries" });
    }
  });

  app.get('/api/states/:countryId', async (req, res) => {
    try {
      const { countryId } = req.params;
      const states = await storage.getStatesByCountry(parseInt(countryId));
      res.json(states);
    } catch (error) {
      console.error("Error fetching states:", error);
      res.status(500).json({ message: "Failed to fetch states" });
    }
  });

  app.get('/api/cities/:stateId', async (req, res) => {
    try {
      const { stateId } = req.params;
      const cities = await storage.getCitiesByState(parseInt(stateId));
      res.json(cities);
    } catch (error) {
      console.error("Error fetching cities:", error);
      res.status(500).json({ message: "Failed to fetch cities" });
    }
  });

  // Image upload endpoint for company logos
  app.post('/api/upload/company-logo', isAuthenticated, imageUpload.single('logo'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const logoUrl = `/uploads/${req.file.filename}`;
      res.json({ logoUrl });
    } catch (error) {
      console.error("Error uploading company logo:", error);
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static('uploads'));

  const httpServer = createServer(app);
  return httpServer;
}
