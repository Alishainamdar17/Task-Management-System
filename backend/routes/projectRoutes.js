// backend/routes/projectRoutes.js
const express = require('express');
const router = express.Router();

const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addMemberToProject,
  removeMemberFromProject,
  updateProjectMembers,
  getProjectsByWorkspace,
  getMyProjects,
  updateProjectStatus,
} = require('../controllers/projectController');

const { getTasks } = require('../controllers/taskController'); // ✅ import tasks controller
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

// CRUD
router.post('/', createProject);                // POST   /api/projects
router.get('/', getProjects);                   // GET    /api/projects  (filters: ?status=&tag=&workspace=)
router.get('/me', getMyProjects);               // GET    /api/projects/me  (projects where user is a member)
router.get('/workspace/:workspaceId', getProjectsByWorkspace); // GET /api/projects/workspace/:workspaceId

// ✅ Tasks inside a project
router.get('/:projectId/tasks', getTasks);      // GET /api/projects/:projectId/tasks

router.get('/:id', getProjectById);             // GET    /api/projects/:id
router.put('/:id', updateProject);              // PUT    /api/projects/:id
router.delete('/:id', deleteProject);           // DELETE /api/projects/:id

// Members
router.post('/:id/members', addMemberToProject);       // POST   /api/projects/:id/members  { userId }
router.put('/:id/members', updateProjectMembers);      // PUT    /api/projects/:id/members  { members: [userId,...] }
router.delete('/:id/members/:memberId', removeMemberFromProject); // DELETE /api/projects/:id/members/:memberId

// Status update
router.put('/:id/status', updateProjectStatus);        // PUT /api/projects/:id/status { status }

module.exports = router;
