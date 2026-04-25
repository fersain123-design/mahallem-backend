import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import * as deliveryFeeService from '../services/deliveryFeeService';
import { UpdateDeliveryFeeBandsSchema } from '../utils/validationSchemas';

export const getDeliveryFeeBands = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');
    const bands = await deliveryFeeService.getDeliveryFeeBands();
    res.status(200).json({ success: true, data: { bands } });
  } catch (error) {
    next(error);
  }
};

export const updateDeliveryFeeBands = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const parsed = UpdateDeliveryFeeBandsSchema.parse(req.body);
    await deliveryFeeService.updateDeliveryFeeBands(parsed.bands);

    const bands = await deliveryFeeService.getDeliveryFeeBands();
    res.status(200).json({ success: true, data: { bands } });
  } catch (error) {
    next(error);
  }
};
