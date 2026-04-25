"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRequestedTemplate = void 0;
const layout_1 = require("../layout");
const mailTemplate_1 = require("../../../../utils/mailTemplate");
const paymentRequestedTemplate = (data) => {
    const amount = data.amount ?? '-';
    return (0, layout_1.createLayout)(`
    <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:bold;color:#111827;">Ödeme talebin alındı</h1>
    <p style="margin:0 0 10px 0;font-size:14px;color:#444;">Ödeme talebin başarıyla alındı ve finans sistemimize işlendi.</p>
    <p style="margin:0 0 12px 0;font-size:14px;color:#444;">Mahallem'de ödeme süreçleri satıcı güvenini korumak, operasyonel sürekliliği sağlamak ve tüm taraflar için şeffaf bir ticaret akışı oluşturmak amacıyla adım adım yürütülür.</p>
    <div style="margin:0 0 14px 0;padding:14px;border-radius:8px;background:#f8f9ff;border:1px solid #e8eaff;">
      <p style="margin:0 0 6px 0;font-size:14px;color:#444;"><strong>Talep Tutarı</strong></p>
      <p style="margin:0;font-size:14px;color:#444;"><strong>${amount}</strong></p>
    </div>
    <div style="margin:0 0 14px 0;padding:14px;border-radius:8px;background:#eef2ff;border:1px solid #c7d2fe;">
      <p style="margin:0 0 8px 0;font-size:14px;color:#3730a3;"><strong>Süreç Durumu</strong></p>
      <p style="margin:0 0 6px 0;font-size:14px;color:#3730a3;">1. Talep alındı ve finans kontrol kuyruğuna eklendi</p>
      <p style="margin:0 0 6px 0;font-size:14px;color:#3730a3;">2. İşlem doğrulaması ve ödeme uygunluğu kontrol ediliyor</p>
      <p style="margin:0;font-size:14px;color:#3730a3;">3. Onay sonrası ödeme transferi başlatılıyor</p>
    </div>
    <p style="margin:0 0 16px 0;font-size:14px;color:#444;">Transfer tamamlandığında sana ayrıca “Ödemen hesabına gönderildi” bildirimi ileteceğiz.</p>
    <a href="https://mahallem.live/seller/payments" style="${mailTemplate_1.PRIMARY_BUTTON_STYLE}">Ödeme Geçmişini Gör</a>
  `);
};
exports.paymentRequestedTemplate = paymentRequestedTemplate;
