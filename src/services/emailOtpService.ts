import { sendEmail } from './mail/mailService';
import { createLayout } from './mail/templates/layout';

export const sendOTPEmail = async (email: string, otpCode: string): Promise<void> => {
  const to = String(email || '').trim().toLowerCase();
  const code = String(otpCode || '').trim();

  if (!to) {
    throw new Error('Email is required for OTP delivery.');
  }

  if (!/^\d{6}$/.test(code)) {
    throw new Error('OTP code must be 6 digits.');
  }

  const subject = 'Mahallem Guvenlik Dogrulama Kodunuz';
  const html = createLayout(`
    <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:bold;color:#111827;">Dogrulama Kodunuz Hazir</h1>
    <p style="margin:0 0 14px 0;font-size:14px;line-height:1.7;color:#1f2937;">
      Merhaba,<br />
      Mahallem hesabiniz icin sifre sifirlama istegi aldik. Islemi tamamlamak icin asagidaki tek kullanimlik dogrulama kodunu kullanin.
    </p>
    <div style="margin:18px 0 16px; padding:18px; border:1px dashed #86efac; background:#f0fdf4; border-radius:12px; text-align:center;">
      <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.8px; font-weight:700; color:#166534; text-transform:uppercase;">Tek Kullanimlik Kod</p>
      <p style="margin:0; font-size:34px; letter-spacing:7px; font-weight:800; color:#14532d;">${code}</p>
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px; border-collapse:separate; border-spacing:0; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">
      <tr>
        <td style="padding:10px 12px; font-size:13px; color:#374151; background:#f9fafb; width:42%;">Gecerlilik Suresi</td>
        <td style="padding:10px 12px; font-size:13px; color:#111827; font-weight:700;">5 dakika</td>
      </tr>
      <tr>
        <td style="padding:10px 12px; font-size:13px; color:#374151; background:#f9fafb; width:42%; border-top:1px solid #e5e7eb;">Islem Tipi</td>
        <td style="padding:10px 12px; font-size:13px; color:#111827; font-weight:700; border-top:1px solid #e5e7eb;">Sifre Sifirlama</td>
      </tr>
    </table>
    <p style="margin:16px 0 0; font-size:13px; line-height:1.7; color:#4b5563;">
      Bu talep size ait degilse kodu kimseyle paylasmayin ve bu e-postayi yok sayin. Hesabinizin guvenligi bizim icin onceliklidir.
    </p>
  `);

  await sendEmail({ to, subject, html });
};
