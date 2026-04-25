import { z } from 'zod';

export const InitializePaymentSchema = z.object({
  orderId: z.string().cuid(),
});

export const PaymentCallbackSchema = z.object({
  token: z.string().min(1),
  conversationId: z.string().optional(),
});

export const PaymentWebhookSchema = z.object({
  eventType: z.string().optional(),
  conversationId: z.string().optional(),
  token: z.string().optional(),
  paymentId: z.string().optional(),
  status: z.string().optional(),
  payload: z.record(z.any()).optional(),
});

export const PaymentRefundSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().trim().max(300).optional(),
  paymentItemId: z.string().cuid().optional(),
});

export const SubmerchantRegisterSchema = z.object({
  merchantType: z.string().trim().min(2).max(100).optional(),
  contactName: z.string().trim().min(2).max(140).optional(),
});

export const SubmerchantUpdateSchema = z.object({
  merchantType: z.string().trim().min(2).max(100).optional(),
  iban: z.string().trim().min(10).max(50).optional(),
  contactName: z.string().trim().min(2).max(140).optional(),
});

export type InitializePaymentInput = z.infer<typeof InitializePaymentSchema>;
export type PaymentCallbackInput = z.infer<typeof PaymentCallbackSchema>;
export type PaymentWebhookInput = z.infer<typeof PaymentWebhookSchema>;
export type PaymentRefundInput = z.infer<typeof PaymentRefundSchema>;
export type SubmerchantRegisterInput = z.infer<typeof SubmerchantRegisterSchema>;
export type SubmerchantUpdateInput = z.infer<typeof SubmerchantUpdateSchema>;
