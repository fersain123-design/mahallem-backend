import { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import {
  InitializePaymentSchema,
  PaymentRefundSchema,
  SubmerchantRegisterSchema,
  SubmerchantUpdateSchema,
} from './payment.dto';
import { paymentService } from './payment.service';
import { AppError } from '../../middleware/errorHandler';

const getAuth = (req: Request): { userId: string; role: UserRole } => {
  const auth = req.user;
  if (!auth) {
    throw new AppError(401, 'Unauthorized');
  }
  return { userId: auth.userId, role: auth.role };
};

export const initializePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = getAuth(req);
    const payload = InitializePaymentSchema.parse(req.body);
    const data = await paymentService.initializePayment(auth.userId, payload, req.ip);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getPaymentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = getAuth(req);
    const { id } = req.params;
    const data = await paymentService.getPaymentById(auth, id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const refundPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = getAuth(req);
    const { id } = req.params;
    const payload = PaymentRefundSchema.parse(req.body || {});
    const data = await paymentService.refundPayment(auth, id, payload);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const registerSubmerchant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = getAuth(req);
    const { vendorId } = req.params;
    const payload = SubmerchantRegisterSchema.parse(req.body || {});
    const data = await paymentService.registerSubmerchant(auth, vendorId, payload);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateSubmerchant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = getAuth(req);
    const { vendorId } = req.params;
    const payload = SubmerchantUpdateSchema.parse(req.body || {});
    const data = await paymentService.updateSubmerchant(auth, vendorId, payload);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
