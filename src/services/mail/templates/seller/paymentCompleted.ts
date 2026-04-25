import { PaymentCompletedMailData } from '../../mailEvents';
import { createLayout } from '../layout';
import { PRIMARY_BUTTON_STYLE } from '../../../../utils/mailTemplate';

export const paymentCompletedTemplate = (data: PaymentCompletedMailData): string => {
  const amount = data.amount ?? '-';

  return createLayout(`
    <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:bold;color:#111827;">Ödemen hesabına gönderildi</h1>
    <p style="margin:0 0 10px 0;font-size:14px;color:#444;">Ödeme işlemin başarıyla tamamlandı ve tutar hesabına gönderildi.</p>
    <p style="margin:0 0 12px 0;font-size:14px;color:#444;">Mahallem finans altyapısı, tüm ödeme adımlarını kayıt altına alarak satıcılar için güvenilir ve takip edilebilir bir süreç sunar.</p>
    <div style="margin:0 0 14px 0;padding:14px;border-radius:8px;background:#f8f9ff;border:1px solid #e8eaff;">
      <p style="margin:0 0 6px 0;font-size:14px;color:#444;"><strong>Gönderilen Tutar</strong></p>
      <p style="margin:0;font-size:14px;color:#444;"><strong>${amount}</strong></p>
    </div>
    <div style="margin:0 0 14px 0;padding:14px;border-radius:8px;background:#f0fdf4;border:1px solid #bbf7d0;">
      <p style="margin:0 0 6px 0;font-size:14px;color:#166534;"><strong>Bilgilendirme</strong></p>
      <p style="margin:0;font-size:14px;color:#166534;">Banka sistemlerine bağlı olarak yansıma süresi kısa farklılıklar gösterebilir.</p>
    </div>
    <p style="margin:0 0 16px 0;font-size:14px;color:#444;">Mahalle esnafını güçlendiren iş ortaklığın için teşekkür ederiz.</p>
    <a href="https://mahallem.live/seller/payments" style="${PRIMARY_BUTTON_STYLE}">Ödeme Hareketlerini Gör</a>
  `);
};
