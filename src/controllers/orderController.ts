import { Request, Response, NextFunction } from 'express';
import * as orderService from '../services/orderService';
import {
  CreateOrderSchema,
  UpdateOrderStatusSchema,
} from '../utils/validationSchemas';

export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authUser = (req as any).user as { userId: string } | undefined;

    if (!authUser) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = CreateOrderSchema.parse(req.body);
    const order = await orderService.createOrder(authUser.userId, data);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const getCustomerOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authUser = (req as any).user as { userId: string } | undefined;

    if (!authUser) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const orders = await orderService.getCustomerOrders(authUser.userId);
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

export const getVendorOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authUser = (req as any).user as { userId: string } | undefined;

    if (!authUser) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const orders = await orderService.getVendorOrdersByUserId(authUser.userId);
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authUser = (req as any).user as { userId: string } | undefined;

    if (!authUser) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const data = UpdateOrderStatusSchema.parse(req.body);
    const order = await orderService.updateOrderStatus(id, authUser.userId, data.status);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authUser = (req as any).user as { userId: string } | undefined;

    if (!authUser) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const order = await orderService.getOrderById(id, authUser.userId);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const cancelCustomerOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.status(403).json({
      success: false,
      message: 'Sipariş iptali müşteri tarafından yapılamaz. İptal işlemi yalnızca satıcı veya admin tarafından yapılabilir.',
    });
  } catch (error) {
    next(error);
  }
};