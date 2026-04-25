import { SellerApplicationMailData } from '../../mailEvents';
import { createLayout } from '../layout';
import { PRIMARY_BUTTON_STYLE } from '../../../../utils/mailTemplate';

export const sellerApplicationTemplate = (data: SellerApplicationMailData): string => {
  const fullName = `${String(data.firstName || '').trim()} ${String(data.lastName || '').trim()}`.trim() || 'Değerli Satıcımız';

  return createLayout(`
    <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:bold;color:#111827;">Başvurun alındı</h1>
    <p style="margin:0 0 10px 0;font-size:14px;color:#444;">Merhaba ${fullName}, satıcı başvurun başarıyla alındı ve değerlendirme sürecin başlatıldı.</p>
    <p style="margin:0 0 14px 0;font-size:14px;color:#444;">Mahallem'de hedefimiz, mahalle esnafını güvenilir bir yapıda müşterilerle buluşturmaktır. Bu nedenle her başvuru kalite, güven ve sürdürülebilir ticaret kriterlerine göre detaylı olarak incelenir.</p>
    <div style="margin:0 0 14px 0;padding:14px;border-radius:8px;background:#f0fdf4;border:1px solid #bbf7d0;">
      <p style="margin:0 0 8px 0;font-size:14px;color:#166534;"><strong>Değerlendirme Süreci</strong></p>
      <p style="margin:0 0 6px 0;font-size:14px;color:#166534;">1. Başvuru bilgileri kalite ve güven standartlarına göre incelenir</p>
      <p style="margin:0 0 6px 0;font-size:14px;color:#166534;">2. Mağaza profili ve operasyon uygunluğu değerlendirilir</p>
      <p style="margin:0;font-size:14px;color:#166534;">3. Onaylanan başvuruların paneli aktif edilerek satış süreci başlatılır</p>
    </div>
    <p style="margin:0 0 16px 0;font-size:14px;color:#444;">Başvurun onaylandığında mağazan aktif edilir ve mahallendeki müşterilere görünür hale gelirsin.</p>
    <a href="https://mahallem.live/seller" style="${PRIMARY_BUTTON_STYLE}">Satıcı Panelini Gör</a>
  `);
};
