import { NextFunction, Request, Response } from 'express';
import { PaymentCallbackSchema, PaymentWebhookSchema } from './payment.dto';
import { paymentService } from './payment.service';

const resolveSignature = (req: Request): string | undefined => {
  const signature = req.header('x-iyzi-signature') || req.header('x-iyzico-signature');
  return signature ? String(signature) : undefined;
};

export const paymentCallback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = PaymentCallbackSchema.parse(req.body || {});
    const data = await paymentService.handleCallback(payload);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const paymentWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = PaymentWebhookSchema.parse(req.body || {});
    const signature = resolveSignature(req);
    const data = await paymentService.handleWebhook(payload, signature);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
