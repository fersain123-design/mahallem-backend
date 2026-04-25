import { Request, Response, NextFunction } from 'express';
import * as settingsService from '../services/settingsService';
import { AppError } from '../middleware/errorHandler';

export const getSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized');
    }

    const settings = await settingsService.getSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized');
    }

    const settings = await settingsService.updateSettings(req.body);
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export const getCommissionRate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized');
    }

    const rate = await settingsService.getCommissionRate();
    res.status(200).json({ success: true, data: { commissionRate: rate } });
  } catch (error) {
    next(error);
  }
};

export const updateCommissionRate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized');
    }

    const { rate } = req.body;
    if (typeof rate !== 'number') {
      throw new AppError(400, 'Commission rate must be a number');
    }

    const settings = await settingsService.updateCommissionRate(rate);
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};
