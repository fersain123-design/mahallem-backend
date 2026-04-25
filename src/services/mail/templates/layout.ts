import { buildMailTemplate } from '../../../utils/mailTemplate';

export const createLayout = (content: string): string => {
  return buildMailTemplate({ content });
};
