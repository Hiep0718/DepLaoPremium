import express from 'express';
import { getFeed, createPost, toggleLike } from '../controllers/postController.js';
// If auth middleware is needed, import it
// import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all posts (feed)
router.get('/', getFeed);

// Create a new post
router.post('/', createPost);

// Toggle like on a post
router.post('/:postId/like', toggleLike);

export default router;
