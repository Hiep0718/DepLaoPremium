import express from 'express';
import { registerToken, removeToken } from '../controllers/notificationController.js';

const router = express.Router();

router.post('/device-token', registerToken);
router.delete('/device-token', removeToken);

export default router;
