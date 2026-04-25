type BuildMailTemplateInput = {
  content: string;
  title?: string;
  preheader?: string;
};

const DEFAULT_TITLE = 'Mahallem';
const DEFAULT_PREHEADER =
  'Mahallem, mahalle esnafini musterilerle guvenli ve surdurulebilir sekilde bulusturan yerel ticaret platformudur.';

export const PRIMARY_BUTTON_STYLE =
  'background:#f59e0b;background-image:linear-gradient(90deg,#f59e0b 0%,#0a5c36 100%);color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-size:14px;font-weight:700;';

export const buildMailTemplate = ({
  content,
  title = DEFAULT_TITLE,
  preheader = DEFAULT_PREHEADER,
}: BuildMailTemplateInput): string => {
  return `
    <!doctype html>
    <html lang="tr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
      </head>
      <body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:#ffffff;border-radius:12px;padding:24px;border:1px solid #f3e8cf;box-shadow:0 6px 24px rgba(15,23,42,0.06);">
                <tr>
                  <td style="padding:0 0 16px 0;">
                    <div style="height:6px;border-radius:999px;background:linear-gradient(90deg,#f59e0b 0%,#f97316 45%,#0a5c36 100%);"></div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:18px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                      <tr>
                        <td style="width:52px;height:52px;border-radius:999px;background:#f59e0b;color:#ffffff;text-align:center;vertical-align:middle;font-size:30px;line-height:52px;font-weight:800;font-family:Arial,sans-serif;">M</td>
                        <td style="padding-left:10px;font-size:28px;line-height:1;color:#111827;font-weight:700;font-family:Arial,sans-serif;">Mahallem</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 16px 0;">
                    <div style="padding:12px 14px;border-radius:10px;background:linear-gradient(90deg,#fff7ed 0%,#ecfdf5 100%);border:1px solid #fde68a;font-size:13px;color:#374151;line-height:1.5;">
                      ${preheader}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#444;line-height:1.6;">
                    ${content}
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:24px;border-top:1px solid #eceff5;font-size:12px;color:#9aa3b2;line-height:1.6;">
                    <div>Bu e-posta otomatik olarak gonderilmistir.</div>
                    <div>© Mahallem</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

export const buildMahallemFromAddress = (rawSender: string): string => {
  const sender = String(rawSender || '').trim();

  if (!sender) {
    return '';
  }

  return /^mahallem\s*</i.test(sender) ? sender : `Mahallem <${sender}>`;
};