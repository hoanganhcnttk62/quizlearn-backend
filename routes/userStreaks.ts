import express from 'express';
import { isAuthenticated } from '../middleware/auth';
import { getUserStreak, restoreUserStreak } from '../controllers/userStreaks.controller';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Get user streak status & history
router.get('/streak', getUserStreak);

// Restore streak using XP points (only when missed exactly 1 day)
router.post('/restore', restoreUserStreak);

export default router;
