import { Router } from 'express';
import * as settingsService from '../services/settingsService';

const router = Router();

// Public (no-auth) settings needed by clients.
router.get('/', async (req, res, next) => {
  try {
    const settings = await settingsService.getSettings();
    res.status(200).json({
      success: true,
      data: {
        commissionRate: settings.commissionRate,
        platformDeliveryEnabled: Boolean(settings.platformDeliveryEnabled ?? false),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
