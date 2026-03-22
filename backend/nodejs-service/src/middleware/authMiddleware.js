import jwt from 'jsonwebtoken';
import axios from 'axios';

/**
 * Auth Middleware cho Node.js Messaging Service
 * Verify JWT token trực tiếp bằng shared secret (nhanh hơn gọi Spring Boot API).
 * Fallback: gọi Spring Boot /api/auth/validate nếu cần.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT trực tiếp bằng shared secret
    const jwtSecret = process.env.JWT_SECRET;

    if (jwtSecret) {
      try {
        const decoded = jwt.verify(token, jwtSecret);

        // Chỉ cho phép access token
        if (decoded.type !== 'access') {
          return res.status(401).json({
            success: false,
            message: 'Invalid token type. Access token required.',
          });
        }

        req.user = {
          phone: decoded.sub,
          tokenType: decoded.type,
        };

        return next();
      } catch (jwtError) {
        console.error('[Auth] JWT verification failed:', jwtError.message);
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token',
        });
      }
    }

    // Fallback: gọi Spring Boot /api/auth/validate
    const springBootUrl = process.env.SPRING_BOOT_URL || 'http://localhost:8082';

    const response = await axios.post(`${springBootUrl}/api/auth/validate`, {
      token,
    });

    if (response.data && response.data.success) {
      req.user = response.data.data;
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'Token validation failed',
    });
  } catch (error) {
    console.error('[Auth] Authentication error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

export default authMiddleware;
