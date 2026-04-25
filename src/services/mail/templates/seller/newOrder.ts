import { NewOrderMailData } from '../../mailEvents';
import { createLayout } from '../layout';
import { PRIMARY_BUTTON_STYLE } from '../../../../utils/mailTemplate';

export const newOrderTemplate = (data: NewOrderMailData): string => {
  const orderId = data.orderId?.trim() || '-';
  const items = Array.isArray(data.items) ? data.items : [];

  const formatMoney = (value?: number) => {
    const amount = Number(value || 0);
    return `₺${amount.toFixed(2)}`;
  };

  const itemRows = items
    .map((item) => {
      const name = String(item.name || 'Ürün').trim() || 'Ürün';
      const quantity = Number(item.quantity || 0);
      const unit = String(item.unit || 'adet').trim() || 'adet';
      const unitPrice = Number(item.unitPrice || 0);
      const subtotal = Number(
        typeof item.subtotal === 'number' ? item.subtotal : unitPrice * quantity
      );

      return `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">${name}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:center;">${quantity} ${unit}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;">${formatMoney(unitPrice)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;">${formatMoney(subtotal)}</td>
        </tr>
      `;
    })
    .join('');

  const productTotal = Number(data.productTotal || 0);
  const deliveryFee = Number(data.deliveryFee || 0);
  const totalPrice = Number(data.totalPrice || productTotal + deliveryFee);

  const summaryBlock = `
    <div style="margin:12px 0 16px 0;padding:12px;border-radius:8px;background:#f9fafb;border:1px solid #e5e7eb;">
      <p style="margin:0 0 6px 0;font-size:14px;color:#374151;">Ürün Toplamı: <strong>${formatMoney(productTotal)}</strong></p>
      <p style="margin:0 0 6px 0;font-size:14px;color:#374151;">Teslimat Ücreti: <strong>${formatMoney(deliveryFee)}</strong></p>
      <p style="margin:0;font-size:15px;color:#111827;">Genel Toplam: <strong>${formatMoney(totalPrice)}</strong></p>
    </div>
  `;

  return createLayout(`
    <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:bold;color:#111827;">Yeni sipariş aldın 🚀</h1>
    <p style="margin:0 0 10px 0;font-size:14px;color:#444;">Harika haber. Mahallendeki bir müşteri mağazandan sipariş verdi. Hızlı hazırlık ve doğru teslimat, mağazana duyulan güveni güçlendirir.</p>
    <div style="margin:0 0 16px 0;padding:14px;border-radius:8px;background:#f8f9ff;border:1px solid #e8eaff;">
      <p style="margin:0 0 6px 0;font-size:14px;color:#444;"><strong>Sipariş Detayı</strong></p>
      <p style="margin:0;font-size:14px;color:#444;">Sipariş No: <strong>${orderId}</strong></p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:0 0 6px 0;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #d1d5db;font-size:13px;color:#374151;">Ürün</th>
          <th style="text-align:center;padding:8px;border-bottom:2px solid #d1d5db;font-size:13px;color:#374151;">Miktar</th>
          <th style="text-align:right;padding:8px;border-bottom:2px solid #d1d5db;font-size:13px;color:#374151;">Birim Fiyat</th>
          <th style="text-align:right;padding:8px;border-bottom:2px solid #d1d5db;font-size:13px;color:#374151;">Tutar</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || '<tr><td colspan="4" style="padding:10px 8px;font-size:14px;color:#6b7280;">Sipariş kalemi bulunamadı.</td></tr>'}
      </tbody>
    </table>
    ${summaryBlock}
    <a href="https://mahallem.live/seller/orders" style="${PRIMARY_BUTTON_STYLE}">Siparişi Gör</a>
    <p style="margin:14px 0 0 0;font-size:14px;color:#444;">Bu sipariş, mahalle ekonomisine katkının yeni bir adımı.</p>
  `);
};
