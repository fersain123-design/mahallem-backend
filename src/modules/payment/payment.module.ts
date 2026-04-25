import { Router } from 'express';
import paymentRoutes from './payment.routes';

export const createPaymentModule = (): Router => {
  const router = Router();
  router.use('/', paymentRoutes);
  return router;
};
