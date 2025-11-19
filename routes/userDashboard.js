import express from 'express';
const router = express.Router();

// Admin UI for user management
router.get('/', (req, res) => {
  try {
    res.render('users');
  } catch (err) {
    res.status(500).send('خطأ في تحميل صفحة المستخدمين');
  }
});

export default router;
