import { Request, Response, NextFunction } from 'express';
import {
  AdminCampaignStatusSchema,
  SellerCampaignSchema,
} from '../utils/validationSchemas';
import * as sellerCampaignService from '../services/sellerCampaignService';

export const getVendorSellerCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = await sellerCampaignService.getVendorCampaigns(req.user.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createVendorSellerCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const body = SellerCampaignSchema.parse(req.body);
    const data = await sellerCampaignService.createVendorCampaign(req.user.userId, body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateVendorSellerCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const campaignId = String(req.params.id || '').trim();
    if (!campaignId) {
      res.status(400).json({ success: false, message: 'Campaign id is required' });
      return;
    }

    const body = SellerCampaignSchema.parse(req.body);
    const data = await sellerCampaignService.updateVendorCampaign(req.user.userId, campaignId, body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const deleteVendorSellerCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const campaignId = String(req.params.id || '').trim();
    if (!campaignId) {
      res.status(400).json({ success: false, message: 'Campaign id is required' });
      return;
    }

    await sellerCampaignService.deleteVendorCampaign(req.user.userId, campaignId);
    res.status(200).json({ success: true, data: { id: campaignId } });
  } catch (error) {
    next(error);
  }
};

export const getAdminSellerCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const endingInDays =
      typeof req.query.endingInDays === 'string'
        ? Number(req.query.endingInDays)
        : undefined;

    const data = await sellerCampaignService.getAdminCampaigns({ status, endingInDays });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateAdminSellerCampaignStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const campaignId = String(req.params.id || '').trim();
    if (!campaignId) {
      res.status(400).json({ success: false, message: 'Campaign id is required' });
      return;
    }

    const body = AdminCampaignStatusSchema.parse(req.body);
    const data = await sellerCampaignService.updateAdminCampaignStatus({
      campaignId,
      status: body.status,
      rejectReason: body.rejectReason,
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
