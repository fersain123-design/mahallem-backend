export type MailLogStatus = 'success' | 'fail';

type LogMailParams = {
  to: string;
  subject: string;
  status: MailLogStatus;
  error?: unknown;
};

const normalizeError = (error?: unknown): string | undefined => {
  if (!error) {
    return undefined;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return JSON.stringify(error);
};

export const logMail = ({ to, subject, status, error }: LogMailParams): void => {
  const payload = {
    to,
    subject,
    status,
    error: normalizeError(error),
    timestamp: new Date().toISOString(),
  };

  console.log('[MAIL_LOG]', payload);
};
