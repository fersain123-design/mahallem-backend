"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMail = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const mailTemplate_1 = require("../../utils/mailTemplate");
const SMTP_HOST = 'email-smtp.eu-north-1.amazonaws.com';
const SMTP_PORT = 465;
const SMTP_SECURE = true;
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
    return nodemailer_1.default.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
            user,
            pass,
        },
    });
};
const getGlobalFrom = (fromOverride) => {
    const defaultFrom = String(process.env.SMTP_FROM || '').trim();
    const selected = String(fromOverride || defaultFrom).trim();
    return (0, mailTemplate_1.buildMahallemFromAddress)(selected);
};
const sendEmail = async ({ to, subject, html, from }) => {
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
exports.sendEmail = sendEmail;
const sendMail = async (to, subject, html, fromOverride) => {
    return (0, exports.sendEmail)({ to, subject, html, from: fromOverride });
};
exports.sendMail = sendMail;
