import nodemailer from 'nodemailer';
import { buildMahallemFromAddress } from '../../utils/mailTemplate';

const SMTP_HOST = 'email-smtp.eu-north-1.amazonaws.com';
const SMTP_PORT = 465;
const SMTP_SECURE = true;

type SendEmailPayload = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

const getSmtpCredentials = () => {
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();

  if (!user || !pass) {
    throw new Error('Missing SMTP credentials. Set SMTP_USER and SMTP_PASS in environment variables.');
  }

  return { user, pass };
};

const createTransporter = () => {
  const { user, pass } = getSmtpCredentials();

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user,
      pass,
    },
  });
};

const getGlobalFrom = (fromOverride?: string) => {
  const defaultFrom = String(process.env.SMTP_FROM || '').trim();
  const selected = String(fromOverride || defaultFrom).trim();
  return buildMahallemFromAddress(selected);
};

export const sendEmail = async ({ to, subject, html, from }: SendEmailPayload) => {
  const normalizedFrom = getGlobalFrom(from);

  if (!to || !subject || !html) {
    throw new Error('sendMail requires to, subject, and html parameters.');
  }

  if (!normalizedFrom) {
    throw new Error('Missing SMTP_FROM. Set a verified sender email address.');
  }

  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: normalizedFrom,
    to,
    subject,
    html,
  });

  return {
    accepted: info.accepted,
    rejected: info.rejected,
    envelope: info.envelope,
    messageId: info.messageId,
  };
};

export const sendMail = async (
  to: string,
  subject: string,
  html: string,
  fromOverride?: string
) => {
  return sendEmail({ to, subject, html, from: fromOverride });
};
