import express from 'express';
import {
  createHundel,
  getHundels,
  getHundelById,
  updateHundel,
  deleteHundel
} from '../controllers/hundelController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const router = express.Router();

// Public: list and get
router.get('/', getHundels);
router.get('/:id', getHundelById);

// Protected: create/update/delete (admin or editor roles)
router.post('/', authenticate, authorizeRoles('admin','secretary'), createHundel);
router.put('/:id', authenticate, authorizeRoles('admin','secretary'), updateHundel);
router.delete('/:id', authenticate, authorizeRoles('admin'), deleteHundel);

export default router;
