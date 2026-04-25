import { Request, Response, NextFunction } from 'express';
import * as adminService from '../services/adminService';
import { AdminNeighborhoodDeliverySettingSchema } from '../utils/validationSchemas';

export const getVendorDeliveryOverview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await adminService.getVendorDeliveryOverview();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const approveVendorDeliveryCoverageChange = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vendorProfileId = String(req.params.id || '').trim();
    const updated = await adminService.approveVendorDeliveryCoverageChange(vendorProfileId);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const rejectVendorDeliveryCoverageChange = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vendorProfileId = String(req.params.id || '').trim();
    const updated = await adminService.rejectVendorDeliveryCoverageChange(vendorProfileId);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const updateVendorDeliverySettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vendorProfileId = String(req.params.id || '').trim();
    const raw = req.body || {};

    const payload: {
      deliveryMode?: 'seller' | 'platform';
      flatDeliveryFee?: number | null;
      freeOverAmount?: number | null;
      isActive?: boolean;
    } = {};

    if (raw.deliveryMode !== undefined) {
      const mode = String(raw.deliveryMode || '').trim().toLowerCase();
      if (mode !== 'seller' && mode !== 'platform') {
        res.status(400).json({ success: false, message: 'deliveryMode must be seller or platform' });
        return;
      }
      payload.deliveryMode = mode as 'seller' | 'platform';
    }

    if (raw.flatDeliveryFee !== undefined) {
      payload.flatDeliveryFee =
        raw.flatDeliveryFee === null || raw.flatDeliveryFee === ''
          ? null
          : Number(raw.flatDeliveryFee);
    }

    if (raw.freeOverAmount !== undefined) {
      payload.freeOverAmount =
        raw.freeOverAmount === null || raw.freeOverAmount === ''
          ? null
          : Number(raw.freeOverAmount);
    }

    if (raw.isActive !== undefined) {
      payload.isActive = Boolean(raw.isActive);
    }

    const updated = await adminService.updateVendorDeliverySettingsByAdmin(vendorProfileId, payload);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const getPlatformNeighborhoodDeliverySettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = String(req.query.q || '').trim();
    const data = await adminService.getPlatformNeighborhoodDeliverySettings(query || undefined);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const upsertPlatformNeighborhoodDeliverySetting = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = AdminNeighborhoodDeliverySettingSchema.parse(req.body);
    const data = await adminService.savePlatformNeighborhoodDeliverySetting(payload);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
