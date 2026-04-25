export const toMoney = (value: unknown): number => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return Number(amount.toFixed(2));
};

export const clampCommissionRate = (value: unknown): number => {
  const rate = Number(value || 0);
  if (!Number.isFinite(rate)) return 0;
  return Math.min(Math.max(rate, 0), 100);
};

type FinancialOrderItemLike = {
  subtotal?: unknown;
  commissionRateSnapshot?: unknown;
  commissionAmount?: unknown;
  vendorNetAmount?: unknown;
};

export const resolveOrderItemFinancials = (
  orderItem: FinancialOrderItemLike,
  fallbackCommissionRate: number = 0
) => {
  const subtotal = toMoney(orderItem?.subtotal);
  const storedRate = clampCommissionRate(orderItem?.commissionRateSnapshot);
  const storedCommission = Number(orderItem?.commissionAmount);
  const storedVendorNet = Number(orderItem?.vendorNetAmount);
  const hasStoredFinancials =
    subtotal === 0 ||
    (Number.isFinite(storedCommission) && storedCommission > 0) ||
    (Number.isFinite(storedVendorNet) && storedVendorNet > 0) ||
    storedRate > 0;

  const rate = hasStoredFinancials ? storedRate : clampCommissionRate(fallbackCommissionRate);
  const commissionAmount = hasStoredFinancials && Number.isFinite(storedCommission)
    ? toMoney(storedCommission)
    : toMoney(subtotal * (rate / 100));
  const vendorNetAmount = hasStoredFinancials && Number.isFinite(storedVendorNet) && storedVendorNet >= 0
    ? toMoney(storedVendorNet)
    : toMoney(subtotal - commissionAmount);

  return {
    subtotal,
    commissionRate: rate,
    commissionAmount,
    vendorNetAmount,
  };
};