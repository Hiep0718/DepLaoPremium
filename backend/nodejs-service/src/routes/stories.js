import express from 'express';
import { getActiveStories, createStory } from '../controllers/storyController.js';

const router = express.Router();

// Get active stories
router.get('/', getActiveStories);

// Create a new story
router.post('/', createStory);

export default router;
