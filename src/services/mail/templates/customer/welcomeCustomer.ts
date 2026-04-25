import { UserRegisteredMailData } from '../../mailEvents';
import { createLayout } from '../layout';
import { PRIMARY_BUTTON_STYLE } from '../../../../utils/mailTemplate';

export const welcomeCustomerTemplate = (data: UserRegisteredMailData): string => {
  const customerName = data.name?.trim() || 'Değerli Müşterimiz';

  return createLayout(`
    <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:bold;color:#111827;">Hoş geldin ${customerName}</h1>
    <p style="margin:0 0 12px 0;font-size:14px;color:#444;">Mahallem'e katıldığın için çok mutluyuz. Bu platformda verdiğin her sipariş, mahallendeki esnafın güçlenmesine ve yerel ekonominin canlı kalmasına katkı sağlar.</p>
    <p style="margin:0 0 14px 0;font-size:14px;color:#444;">Amacımız; müşterilere güvenilir alışveriş deneyimi sunarken, yerel işletmelerin dijitalde görünür ve güçlü olmasını sağlamak.</p>
    <div style="margin:0 0 18px 0;padding:14px;border-radius:8px;background:#f8f9ff;border:1px solid #e8eaff;">
      <p style="margin:0 0 8px 0;font-size:14px;color:#444;"><strong>Mahallem deneyiminde seni bekleyenler:</strong></p>
      <p style="margin:0 0 6px 0;font-size:14px;color:#444;">• Mahallene yakın esnaftan taze ve güvenilir ürünler</p>
      <p style="margin:0 0 6px 0;font-size:14px;color:#444;">• Hızlı teslimat, güvenli ödeme, şeffaf sipariş takibi</p>
      <p style="margin:0;font-size:14px;color:#444;">• Her siparişte yerel işletmelere doğrudan destek</p>
    </div>
    <a href="https://mahallem.live" style="${PRIMARY_BUTTON_STYLE}">Alışverişe Başla</a>
    <p style="margin:14px 0 0 0;font-size:14px;color:#444;">Birlikte, güvenli alışveriş kültürünü mahalle mahalle büyütüyoruz.</p>
  `);
};
