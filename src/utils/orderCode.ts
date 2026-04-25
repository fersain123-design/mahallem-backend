export const toOrderCode = (orderId?: string | null): string => {
  const raw = String(orderId || '').trim();
  if (!raw) return '';
  return raw.slice(-6).toUpperCase();
};

export const attachOrderCode = <T extends { id?: unknown }>(order: T): T & { orderCode: string; order_code: string } => {
  const code = toOrderCode(String(order?.id || ''));
  return {
    ...order,
    orderCode: code,
    order_code: code,
  };
};

export const attachOrderCodeList = <T extends { id?: unknown }>(orders: T[]): Array<T & { orderCode: string; order_code: string }> => {
  return orders.map((item) => attachOrderCode(item));
};
