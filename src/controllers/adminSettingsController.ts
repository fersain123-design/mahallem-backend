import { Request, Response, NextFunction } from 'express';
import * as settingsService from '../services/settingsService';
import { AppError } from '../middleware/errorHandler';

type SettingKey =
  | 'commission_rate'
  | 'min_order_amount'
  | 'platform_min_basket_amount'
  | 'max_order_amount'
  | 'currency'
  | 'default_store_fee'
  | 'platform_delivery_fee'
  | 'platform_delivery_enabled';

const toKeyValueList = (settings: any) => {
  const list: Array<{ key: SettingKey; value: string }> = [
    { key: 'commission_rate', value: String(settings?.commissionRate ?? '') },
    { key: 'min_order_amount', value: String(settings?.minOrderAmount ?? '') },
    { key: 'platform_min_basket_amount', value: String(settings?.minOrderAmount ?? '') },
    { key: 'max_order_amount', value: String(settings?.maxOrderAmount ?? '') },
    { key: 'currency', value: String(settings?.currency ?? '') },
    { key: 'default_store_fee', value: String(settings?.defaultStoreFee ?? '') },
    { key: 'platform_delivery_fee', value: String(settings?.defaultStoreFee ?? '') },
    {
      key: 'platform_delivery_enabled',
      value: String(Boolean(settings?.platformDeliveryEnabled ?? false)),
    },
  ];
  return list;
};

export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const settings = await settingsService.getSettings();
    res.status(200).json({ success: true, data: { settings: toKeyValueList(settings) } });
  } catch (error) {
    next(error);
  }
};

export const updateSettingByKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const keyRaw = String(req.params.key || '').trim();
    const value = req.body?.value;

    if (!keyRaw) throw new AppError(400, 'Setting key is required');

    // Only allow known keys; the admin UI currently sends values as strings.
    const key = keyRaw as SettingKey;

    if (key === 'commission_rate') {
      const commissionRate = typeof value === 'number' ? value : Number(String(value).trim());
      const updated = await settingsService.updateSettings({ commissionRate });
      res.status(200).json({ success: true, data: { key, value: String(updated.commissionRate) } });
      return;
    }

    if (key === 'min_order_amount' || key === 'platform_min_basket_amount') {
      const minOrderAmount = typeof value === 'number' ? value : Number(String(value).trim());
      const updated = await settingsService.updateSettings({ minOrderAmount });
      res.status(200).json({ success: true, data: { key, value: String(updated.minOrderAmount) } });
      return;
    }

    if (key === 'max_order_amount') {
      const maxOrderAmount = typeof value === 'number' ? value : Number(String(value).trim());
      const updated = await settingsService.updateSettings({ maxOrderAmount });
      res.status(200).json({ success: true, data: { key, value: String(updated.maxOrderAmount) } });
      return;
    }

    if (key === 'currency') {
      const currency = String(value ?? '').trim();
      const updated = await settingsService.updateSettings({ currency });
      res.status(200).json({ success: true, data: { key, value: String(updated.currency) } });
      return;
    }

    if (key === 'default_store_fee' || key === 'platform_delivery_fee') {
      const defaultStoreFee = typeof value === 'number' ? value : Number(String(value).trim());
      const updated = await settingsService.updateSettings({ defaultStoreFee });
      res
        .status(200)
        .json({ success: true, data: { key, value: String(updated.defaultStoreFee) } });
      return;
    }

    if (key === 'platform_delivery_enabled') {
      const normalized = String(value ?? '').trim().toLowerCase();
      const platformDeliveryEnabled =
        typeof value === 'boolean'
          ? value
          : normalized === 'true' || normalized === '1' || normalized === 'yes';

      const updated = await settingsService.updateSettings({ platformDeliveryEnabled });
      res.status(200).json({
        success: true,
        data: { key, value: String(Boolean(updated.platformDeliveryEnabled)) },
      });
      return;
    }

    throw new AppError(400, `Unknown setting key: ${keyRaw}`);
  } catch (error) {
    next(error);
  }
};
