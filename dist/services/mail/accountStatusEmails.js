"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendUnsuspensionEmail = exports.sendSuspensionEmail = void 0;
const mailTemplate_1 = require("../../utils/mailTemplate");
const mailService_1 = require("./mailService");
const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const formatDisplayName = (name) => {
    const normalized = String(name || '').trim();
    return normalized.length > 0 ? normalized : 'Değerli Kullanıcımız';
};
const getPortalButton = (role) => {
    const href = role === 'VENDOR'
        ? String(process.env.SELLER_PORTAL_URL || 'http://localhost:3001')
        : String(process.env.CUSTOMER_PORTAL_URL || 'http://localhost:19006');
    const text = role === 'VENDOR' ? 'Satıcı Paneline Git' : 'Uygulamaya Git';
    return `<a href="${escapeHtml(href)}" style="${mailTemplate_1.PRIMARY_BUTTON_STYLE}" target="_blank" rel="noopener noreferrer">${text}</a>`;
};
const buildSuspensionHtml = ({ name, role, reason, shopName }) => {
    const displayName = escapeHtml(formatDisplayName(name));
    const reasonText = escapeHtml(String(reason || '').trim());
    const accountLabel = role === 'VENDOR' ? 'satıcı hesabınız' : 'müşteri hesabınız';
    const optionalShop = role === 'VENDOR' && String(shopName || '').trim().length > 0
        ? `<p style="margin:0 0 14px 0;color:#111827;"><strong>Mağaza:</strong> ${escapeHtml(String(shopName || '').trim())}</p>`
        : '';
    const content = `
    <h2 style="margin:0 0 14px 0;font-size:22px;line-height:1.3;color:#7f1d1d;">Hesabınız Geçici Olarak Askıya Alındı</h2>
    <p style="margin:0 0 14px 0;color:#111827;">Merhaba <strong>${displayName}</strong>,</p>
    <p style="margin:0 0 14px 0;color:#111827;">Platform güvenliği ve hizmet kalitesi kapsamında yapılan inceleme sonucunda <strong>${accountLabel}</strong> geçici olarak askıya alınmıştır.</p>
    ${optionalShop}
    <div style="margin:0 0 14px 0;padding:14px;border:1px solid #fecaca;border-radius:10px;background:#fff1f2;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.02em;color:#b91c1c;font-weight:700;margin-bottom:6px;">Askıya Alma Gerekçesi</div>
      <div style="font-size:14px;line-height:1.6;color:#111827;">${reasonText}</div>
    </div>
    <p style="margin:0 0 14px 0;color:#111827;">Bu süreçte hesabınıza giriş yapamayabilir veya bazı özellikleri kullanamayabilirsiniz. İnceleme tamamlandığında size bilgilendirme gönderilecektir.</p>
    <p style="margin:0 0 20px 0;color:#111827;">Kararın hatalı olduğunu düşünüyorsanız, bu e-postayı yanıtlayarak veya destek kanallarımız üzerinden bizimle iletişime geçebilirsiniz.</p>
    <div style="margin:0 0 16px 0;">${getPortalButton(role)}</div>
    <p style="margin:0;color:#6b7280;font-size:12px;">Referans: ACC-SUSPENSION-${Date.now()}</p>
  `;
    return (0, mailTemplate_1.buildMailTemplate)({
        title: 'Mahallem Hesap Askıya Alma Bildirimi',
        preheader: 'Hesabınız geçici olarak askıya alındı. Gerekçe ve sonraki adımlar bu e-postada yer alır.',
        content,
    });
};
const buildUnsuspensionHtml = ({ name, role, shopName }) => {
    const displayName = escapeHtml(formatDisplayName(name));
    const accountLabel = role === 'VENDOR' ? 'satıcı hesabınız' : 'müşteri hesabınız';
    const optionalShop = role === 'VENDOR' && String(shopName || '').trim().length > 0
        ? `<p style="margin:0 0 14px 0;color:#111827;"><strong>Mağaza:</strong> ${escapeHtml(String(shopName || '').trim())}</p>`
        : '';
    const content = `
    <h2 style="margin:0 0 14px 0;font-size:22px;line-height:1.3;color:#14532d;">Hesabınız Yeniden Aktif</h2>
    <p style="margin:0 0 14px 0;color:#111827;">Merhaba <strong>${displayName}</strong>,</p>
    <p style="margin:0 0 14px 0;color:#111827;">Yapılan değerlendirme sonucunda <strong>${accountLabel}</strong> yeniden aktif hale getirilmiştir.</p>
    ${optionalShop}
    <div style="margin:0 0 14px 0;padding:14px;border:1px solid #bbf7d0;border-radius:10px;background:#f0fdf4;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.02em;color:#166534;font-weight:700;margin-bottom:6px;">Durum Güncellemesi</div>
      <div style="font-size:14px;line-height:1.6;color:#111827;">Hesabınız şu anda aktif ve platform hizmetlerini normal şekilde kullanabilirsiniz.</div>
    </div>
    <p style="margin:0 0 20px 0;color:#111827;">Güvenli ve sorunsuz bir deneyim için platform kurallarına uygun şekilde kullanımınıza devam etmenizi rica ederiz.</p>
    <div style="margin:0 0 16px 0;">${getPortalButton(role)}</div>
    <p style="margin:0;color:#6b7280;font-size:12px;">Referans: ACC-REOPEN-${Date.now()}</p>
  `;
    return (0, mailTemplate_1.buildMailTemplate)({
        title: 'Mahallem Hesap Yeniden Aktivasyon Bildirimi',
        preheader: 'Hesabınız yeniden aktif hale getirildi. Uygulamaya güvenle devam edebilirsiniz.',
        content,
    });
};
const sendSuspensionEmail = async (input) => {
    const to = String(input.to || '').trim().toLowerCase();
    if (!to)
        return;
    const subject = input.role === 'VENDOR'
        ? 'Mahallem | Satıcı Hesabınız Geçici Olarak Askıya Alındı'
        : 'Mahallem | Hesabınız Geçici Olarak Askıya Alındı';
    const html = buildSuspensionHtml(input);
    await (0, mailService_1.sendEmail)({ to, subject, html });
};
exports.sendSuspensionEmail = sendSuspensionEmail;
const sendUnsuspensionEmail = async (input) => {
    const to = String(input.to || '').trim().toLowerCase();
    if (!to)
        return;
    const subject = input.role === 'VENDOR'
        ? 'Mahallem | Satıcı Hesabınız Yeniden Aktif'
        : 'Mahallem | Hesabınız Yeniden Aktif';
    const html = buildUnsuspensionHtml(input);
    await (0, mailService_1.sendEmail)({ to, subject, html });
};
exports.sendUnsuspensionEmail = sendUnsuspensionEmail;
