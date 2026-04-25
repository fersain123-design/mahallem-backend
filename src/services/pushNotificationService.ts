import prisma from '../config/db';

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  subtitle?: string;
  imageUrl?: string;
  sound?: string;
  channelId?: string;
};

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

type ExpoPushTicket = {
  status?: string;
  message?: string;
  details?: {
    error?: string;
    expoPushToken?: string;
  };
};

const extractInvalidTokens = (tickets: ExpoPushTicket[], sentTokens: string[]) => {
  const invalid = new Set<string>();

  tickets.forEach((ticket, index) => {
    const detailsError = String(ticket?.details?.error || '').trim();
    const explicitToken = String(ticket?.details?.expoPushToken || '').trim();
    const fallbackToken = sentTokens[index] || '';
    if (detailsError === 'DeviceNotRegistered') {
      if (explicitToken) invalid.add(explicitToken);
      else if (fallbackToken) invalid.add(fallbackToken);
    }
  });

  return Array.from(invalid);
};

export const isExpoPushToken = (value: string): boolean => {
  return /^ExponentPushToken\[[^\]]+\]$/.test(String(value || '').trim());
};

export const sendPushNotificationToTokens = async (
  tokens: string[],
  payload: PushPayload
) => {
  const validTokens = tokens.map((t) => String(t || '').trim()).filter(isExpoPushToken);
  if (validTokens.length === 0) {
    return { sent: 0, response: null };
  }

  const notificationType = String(payload.data?.notificationType || '').trim().toUpperCase();
  const isCampaignNotification = notificationType === 'CAMPAIGN_APPROVED' || notificationType === 'PROMOTION_APPROVED';
  const resolvedSound = String(payload.sound || '').trim() || (isCampaignNotification ? 'kampanya-bildirim.mpeg' : 'default');
  const resolvedChannelId = String(payload.channelId || '').trim() || (isCampaignNotification ? 'campaign-alerts' : 'default');

  const messages = validTokens.map((token) => ({
    to: token,
    sound: resolvedSound,
    channelId: resolvedChannelId,
    priority: 'high' as const,
    title: payload.title,
    subtitle: payload.subtitle,
    body: payload.body,
    data: payload.data || {},
    ...(payload.imageUrl ? { richContent: { image: payload.imageUrl } } : {}),
  }));

  const res = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const text = await res.text();
  let responseBody: unknown = null;
  let tickets: ExpoPushTicket[] = [];
  try {
    responseBody = JSON.parse(text);
    const parsedData = (responseBody as any)?.data;
    tickets = Array.isArray(parsedData) ? parsedData : [];
  } catch {
    responseBody = text;
  }

  const invalidTokens = extractInvalidTokens(tickets, validTokens);
  if (invalidTokens.length > 0) {
    await prisma.userDeviceToken.updateMany({
      where: {
        token: { in: invalidTokens },
      },
      data: {
        isActive: false,
        lastSeenAt: new Date(),
      },
    });
  }

  const accepted = tickets.filter((ticket) => String(ticket?.status || '').toLowerCase() === 'ok').length;
  const failed = tickets.filter((ticket) => String(ticket?.status || '').toLowerCase() === 'error').length;

  return {
    sent: validTokens.length,
    accepted,
    failed,
    invalidTokens,
    response: responseBody,
  };
};

export const sendPushNotificationToUser = async (
  userId: string,
  payload: PushPayload
) => {
  const tokens = await prisma.userDeviceToken.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: {
      token: true,
    },
  });

  return sendPushNotificationToTokens(
    tokens.map((item) => item.token),
    payload
  );
};
