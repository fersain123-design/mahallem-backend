import { OrderDeliveredMailData } from '../../mailEvents';
import { createLayout } from '../layout';
import { PRIMARY_BUTTON_STYLE } from '../../../../utils/mailTemplate';

export const orderDeliveredTemplate = (data: OrderDeliveredMailData): string => {
  const customerName = data.name?.trim() || 'Değerli Müşterimiz';
  const orderId = data.orderId?.trim() || '-';

  return createLayout(`
    <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:bold;color:#111827;">Siparişin teslim edildi</h1>
    <p style="margin:0 0 10px 0;font-size:14px;color:#444;">Merhaba ${customerName}, siparişin başarıyla teslim edildi.</p>
    <p style="margin:0 0 12px 0;font-size:14px;color:#444;">Tercihin için teşekkür ederiz. Bu siparişinle mahallendeki esnafın dijitalde daha güçlü olmasına doğrudan katkı sağladın.</p>
    <div style="margin:0 0 16px 0;padding:14px;border-radius:8px;background:#f8f9ff;border:1px solid #e8eaff;">
      <p style="margin:0 0 6px 0;font-size:14px;color:#444;"><strong>Sipariş Özeti</strong></p>
      <p style="margin:0;font-size:14px;color:#444;">Sipariş No: <strong>${orderId}</strong></p>
    </div>
    <p style="margin:0 0 18px 0;font-size:14px;color:#444;">Mahallem'de her sipariş, mahalle yaşamını canlandırır ve yerel üretimi destekler. Güvenin bizim için çok değerli.</p>
    <a href="https://mahallem.live/orders" style="${PRIMARY_BUTTON_STYLE}">Siparişlerini Gör</a>
    <p style="margin:14px 0 0 0;font-size:14px;color:#444;">Sipariş deneyimini değerlendirerek hem diğer müşterilere hem de esnafa yol gösterebilirsin.</p>
  `);
};
