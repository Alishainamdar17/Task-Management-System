const express = require('express');
const router = express.Router();

const {
  createWorkspace,
  getWorkspaces,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
  addMember,
  updateMemberRole,
  removeMember,
  getMyWorkspaces
} = require('../controllers/workspaceController');

const { protect } = require('../middlewares/authMiddleware'); // assumes protect sets req.user

// Public to authenticated users
router.use(protect);

// CRUD
router.post('/', createWorkspace);          // POST /api/workspaces
router.get('/', getWorkspaces);             // GET  /api/workspaces  (all for admins, otherwise workspace list)
router.get('/me', getMyWorkspaces);         // GET  /api/workspaces/me  (workspaces where user is member/owner)
router.get('/:id', getWorkspaceById);       // GET  /api/workspaces/:id
router.put('/:id', updateWorkspace);        // PUT  /api/workspaces/:id
router.delete('/:id', deleteWorkspace);     // DELETE /api/workspaces/:id

// Members management
router.post('/:id/members', addMember);                 // POST   /api/workspaces/:id/members  { user, role }
router.put('/:id/members/:memberUserId', updateMemberRole); // PUT /api/workspaces/:id/members/:memberUserId { role }
router.delete('/:id/members/:memberUserId', removeMember); // DELETE /api/workspaces/:id/members/:memberUserId

module.exports = router;
