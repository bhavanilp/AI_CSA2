import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index';
import logger from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      organizationId?: string;
      userRole?: string;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.auth.jwt_secret) as any;
    req.userId = decoded.userId;
    req.organizationId = decoded.organizationId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    logger.error(`Auth middleware error: ${error}`);
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const adminMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};

export const optionalAuthMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, config.auth.jwt_secret) as any;
      req.userId = decoded.userId;
      req.organizationId = decoded.organizationId;
      req.userRole = decoded.role;
    } catch (error) {
      logger.error(`Optional auth middleware error: ${error}`);
    }
  }

  next();
};
