import { SellerApprovedMailData } from '../../mailEvents';
import { createLayout } from '../layout';
import { PRIMARY_BUTTON_STYLE } from '../../../../utils/mailTemplate';

export const sellerApprovedTemplate = (data: SellerApprovedMailData): string => {
  const sellerName = data.name?.trim() || 'Değerli Satıcımız';

  return createLayout(`
    <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:bold;color:#111827;">Başvurun onaylandı</h1>
    <p style="margin:0 0 12px 0;font-size:14px;color:#444;">Tebrikler ${sellerName}, satıcı hesabın onaylandı ve aktif edildi.</p>
    <p style="margin:0 0 12px 0;font-size:14px;color:#444;">Artık ürünlerini dijital vitrine taşıyarak mahallendeki müşterilerle daha hızlı ve güvenli şekilde buluşabilirsin.</p>
    <div style="margin:0 0 18px 0;padding:14px;border-radius:8px;background:#f8f9ff;border:1px solid #e8eaff;">
      <p style="margin:0 0 6px 0;font-size:14px;color:#444;">• Ürünlerini vitrine çıkar ve yerel müşterilere görün</p>
      <p style="margin:0 0 6px 0;font-size:14px;color:#444;">• Siparişlerini tek panelden hızlıca yönet</p>
      <p style="margin:0;font-size:14px;color:#444;">• Ödeme süreçlerini şeffaf şekilde takip et</p>
    </div>
    <a href="https://mahallem.live/seller" style="${PRIMARY_BUTTON_STYLE}">Paneline Git</a>
    <p style="margin:14px 0 0 0;font-size:14px;color:#444;">Mahallem ile büyüyen yerel esnaf ağımızın değerli bir parçası olduğun için teşekkür ederiz.</p>
  `);
};
