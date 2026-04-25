"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSellerAdminSupportMessageEmail = exports.sendSellerNewMessageEmail = void 0;
const mailTemplate_1 = require("../../utils/mailTemplate");
const mailService_1 = require("./mailService");
const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const truncate = (value, max = 300) => {
    const text = String(value || '').trim();
    if (text.length <= max)
        return text;
    return `${text.slice(0, max - 1)}…`;
};
const resolveSellerPanelBaseUrl = () => String(process.env.SELLER_PORTAL_URL || 'http://localhost:3001').replace(/\/+$/, '');
const sendSellerNewMessageEmail = async (input) => {
    const to = String(input.to || '').trim().toLowerCase();
    if (!to)
        return;
    const sellerName = String(input.sellerName || '').trim() || 'Değerli Satıcımız';
    const customerName = String(input.customerName || '').trim() || 'Müşteri';
    const shopName = String(input.shopName || '').trim();
    const messageText = truncate(String(input.messageText || '').trim(), 500);
    const panelUrl = `${resolveSellerPanelBaseUrl()}/support-messages/${encodeURIComponent(String(input.conversationId || '').trim())}`;
    const subject = input.isSupport
        ? 'Mahallem | Destek Konuşmasında Yeni Mesajınız Var'
        : 'Mahallem | Yeni Müşteri Mesajınız Var';
    const content = `
    <h2 style="margin:0 0 14px 0;font-size:22px;line-height:1.3;color:#0a5c36;">Yeni Mesaj Bildirimi</h2>
    <p style="margin:0 0 14px 0;color:#111827;">Merhaba <strong>${escapeHtml(sellerName)}</strong>,</p>
    <p style="margin:0 0 14px 0;color:#111827;">${escapeHtml(customerName)} tarafından size yeni bir mesaj gönderildi.</p>
    ${shopName ? `<p style="margin:0 0 14px 0;color:#111827;"><strong>Mağaza:</strong> ${escapeHtml(shopName)}</p>` : ''}

    <div style="margin:0 0 16px 0;padding:14px;border:1px solid #d1fae5;border-radius:10px;background:#f0fdf4;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.02em;color:#047857;font-weight:700;margin-bottom:8px;">Son Mesaj</div>
      <div style="font-size:14px;line-height:1.6;color:#111827;">${messageText ? escapeHtml(messageText) : input.hasImage ? 'Müşteri bir görsel gönderdi.' : 'Yeni mesaj alındı.'}</div>
    </div>

    <p style="margin:0 0 18px 0;color:#111827;">Mesajı gecikmeden görüntülemek ve yanıtlamak için aşağıdaki butonu kullanabilirsiniz.</p>

    <div style="margin:0 0 16px 0;">
      <a href="${escapeHtml(panelUrl)}" style="${mailTemplate_1.PRIMARY_BUTTON_STYLE}" target="_blank" rel="noopener noreferrer">Mesajı Görüntüle</a>
    </div>

    <p style="margin:0;color:#6b7280;font-size:12px;">Bu bildirim, müşteri iletişimlerini kaçırmamanız için otomatik olarak gönderilmiştir.</p>
  `;
    const html = (0, mailTemplate_1.buildMailTemplate)({
        title: 'Mahallem Yeni Mesaj Bildirimi',
        preheader: 'Satıcı panelinizde yeni bir mesaj var. Hızlıca görüntülemek için e-postadaki butonu kullanın.',
        content,
    });
    await (0, mailService_1.sendEmail)({ to, subject, html });
};
exports.sendSellerNewMessageEmail = sendSellerNewMessageEmail;
const sendSellerAdminSupportMessageEmail = async (input) => {
    const to = String(input.to || '').trim().toLowerCase();
    if (!to)
        return;
    const sellerName = String(input.sellerName || '').trim() || 'Değerli Satıcımız';
    const messageText = truncate(String(input.messageText || '').trim(), 500);
    const panelUrl = `${resolveSellerPanelBaseUrl()}/messages`;
    const content = `
    <h2 style="margin:0 0 14px 0;font-size:22px;line-height:1.3;color:#0a5c36;">Destek Ekibinden Yeni Mesaj</h2>
    <p style="margin:0 0 14px 0;color:#111827;">Merhaba <strong>${escapeHtml(sellerName)}</strong>,</p>
    <p style="margin:0 0 14px 0;color:#111827;">Mahallem destek ekibi size yeni bir mesaj gönderdi.</p>

    <div style="margin:0 0 16px 0;padding:14px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.02em;color:#1d4ed8;font-weight:700;margin-bottom:8px;">Destek Mesajı</div>
      <div style="font-size:14px;line-height:1.6;color:#111827;">${messageText ? escapeHtml(messageText) : input.hasImage ? 'Destek ekibi bir görsel gönderdi.' : 'Yeni mesaj alındı.'}</div>
    </div>

    <p style="margin:0 0 18px 0;color:#111827;">Detayları görmek ve yanıt vermek için aşağıdaki butonu kullanabilirsiniz.</p>

    <div style="margin:0 0 16px 0;">
      <a href="${escapeHtml(panelUrl)}" style="${mailTemplate_1.PRIMARY_BUTTON_STYLE}" target="_blank" rel="noopener noreferrer">Mesajı Görüntüle</a>
    </div>

    <p style="margin:0;color:#6b7280;font-size:12px;">Bu bildirim, destek taleplerini kaçırmamanız için otomatik olarak gönderilmiştir.</p>
  `;
    const html = (0, mailTemplate_1.buildMailTemplate)({
        title: 'Mahallem Destek Mesaj Bildirimi',
        preheader: 'Destek ekibi size yeni bir mesaj gönderdi. Hızlıca görüntülemek için butonu kullanın.',
        content,
    });
    await (0, mailService_1.sendEmail)({
        to,
        subject: 'Mahallem | Destek Ekibinden Yeni Mesajınız Var',
        html,
    });
};
exports.sendSellerAdminSupportMessageEmail = sendSellerAdminSupportMessageEmail;
