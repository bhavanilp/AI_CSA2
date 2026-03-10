import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { config } from '../config/index';
import { query } from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const result = await query(`SELECT * FROM admin_users WHERE email = $1`, [email]);

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];
    const isPasswordValid = await bcryptjs.compare(password, user.password_hash);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate tokens
    const accessToken = jwt.sign(
      {
        userId: user.id,
        organizationId: user.organization_id,
        role: user.role,
      },
      config.auth.jwt_secret,
      { expiresIn: config.auth.jwt_expiry }
    );

    const refreshToken = jwt.sign(
      {
        userId: user.id,
        organizationId: user.organization_id,
      },
      config.auth.jwt_secret,
      { expiresIn: config.auth.refresh_token_expiry }
    );

    // Update last_login
    await query(`UPDATE admin_users SET last_login = NOW() WHERE id = $1`, [user.id]);

    res.status(200).json({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: config.auth.jwt_expiry,
      user: {
        user_id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  })
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    try {
      const decoded = jwt.verify(refresh_token, config.auth.jwt_secret) as any;

      const accessToken = jwt.sign(
        {
          userId: decoded.userId,
          organizationId: decoded.organizationId,
        },
        config.auth.jwt_secret,
        { expiresIn: config.auth.jwt_expiry }
      );

      res.status(200).json({
        access_token: accessToken,
        expires_in: config.auth.jwt_expiry,
      });
    } catch (error) {
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  })
);

// POST /api/auth/logout
router.post(
  '/logout',
  asyncHandler(async (_req: Request, res: Response) => {
    // TODO: Implement token blacklisting if needed
    res.status(204).end();
  })
);

export default router;
