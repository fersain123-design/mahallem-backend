import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import {
  ForgotPasswordSchema,
  LoginSchema,
  RegisterSchema,
  RequestLoginOtpSchema,
  ResetPasswordSchema,
  VerifyLoginOtpSchema,
  VerifyOtpSchema,
} from '../utils/validationSchemas';

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = RegisterSchema.parse(req.body);
    const result = await authService.registerUser(data);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = LoginSchema.parse(req.body);
    const result = await authService.loginUser(data);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const requestLoginOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = RequestLoginOtpSchema.parse(req.body);
    const result = await authService.requestLoginOtp(data, {
      ip: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyLoginOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = VerifyLoginOtpSchema.parse(req.body);
    const result = await authService.verifyLoginOtp(data);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const user = await authService.getCurrentUser(req.user.userId);
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const loginWithGoogle = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const idToken = String(req.body?.token || req.body?.idToken || req.body?.credential || '').trim();

    if (!idToken) {
      res.status(400).json({
        success: false,
        message: 'Google token is required',
      });
      return;
    }

    const result = await authService.loginWithGoogle(idToken);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const loginWithSupabase = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const accessToken = String(req.body?.token || req.body?.accessToken || '').trim();

    if (!accessToken) {
      res.status(400).json({
        success: false,
        message: 'Supabase token is required',
      });
      return;
    }

    const result = await authService.loginWithSupabaseAccessToken(accessToken);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = ForgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(data, {
      ip: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = VerifyOtpSchema.parse(req.body);
    const result = await authService.verifyPasswordResetOtp(data);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = ResetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(data);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
