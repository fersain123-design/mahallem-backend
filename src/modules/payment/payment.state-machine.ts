import { PaymentRecordStatus } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';

const transitions: Record<PaymentRecordStatus, PaymentRecordStatus[]> = {
  CREATED: ['INITIALIZED', 'FAILED', 'CANCELLED'],
  INITIALIZED: ['PENDING', 'PAID', 'FAILED', 'REVIEW', 'CANCELLED'],
  PENDING: ['PAID', 'FAILED', 'REVIEW', 'CANCELLED'],
  REVIEW: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['REFUNDED'],
  REFUNDED: [],
  FAILED: [],
  CANCELLED: [],
};

export const canTransition = (
  from: PaymentRecordStatus,
  to: PaymentRecordStatus
): boolean => {
  if (from === to) return true;
  return transitions[from].includes(to);
};

export const assertTransition = (
  from: PaymentRecordStatus,
  to: PaymentRecordStatus
): void => {
  if (!canTransition(from, to)) {
    throw new AppError(409, `Invalid payment status transition: ${from} -> ${to}`);
  }
};
