import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwtUtils';
import prisma from '../config/db';

const ACCOUNT_SUSPEND_REASON_PREFIX = '[SUSPENDED]';
const SUSPENDED_VENDOR_MESSAGE =
  'Hesabınız kötüye kullanıldığı için askıya alınmıştır. Size bir e-posta gönderdik.';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7);

    const decoded = verifyToken(token);
    req.user = decoded;

    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, isActive: true, role: true, deactivationReason: true },
    });

    if (!dbUser) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    if (dbUser.isActive === false) {
      const reason = String(dbUser.deactivationReason || '').trim();
      if (reason.startsWith(ACCOUNT_SUSPEND_REASON_PREFIX)) {
        res.status(403).json({ success: false, message: SUSPENDED_VENDOR_MESSAGE });
        return;
      }
      res.status(403).json({ success: false, message: 'Account is deactivated' });
      return;
    }

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};
