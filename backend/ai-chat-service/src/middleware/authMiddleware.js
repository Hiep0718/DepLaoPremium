import jwt from 'jsonwebtoken';

/**
 * Auth Middleware — verify JWT token (shared secret với spring-boot-api)
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access token is required' });
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, jwtSecret);

    if (decoded.type !== 'access') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    req.user = { phone: decoded.sub, tokenType: decoded.type };
    return next();
  } catch (error) {
    console.error('[AI-Chat][Auth] JWT error:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export default authMiddleware;
