import express from 'express';
import uiAuth from '../middlewares/uiAuth.js';

const router = express.Router();

// Protect all admin UI routes
router.use(uiAuth);

// Render Hundel admin list page
router.get('/', (req, res) => {
  res.render('hundels/index');
});

// Render create page
router.get('/new', (req, res) => {
  res.render('hundels/new');
});

// Render edit page (client will fetch the item by id)
router.get('/:id/edit', (req, res) => {
  res.render('hundels/edit', { id: req.params.id });
});

export default router;
