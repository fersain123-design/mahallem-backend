import prisma from '../config/db';
import { sendPushNotificationToUser } from './pushNotificationService';

type CreateUserNotificationParams = {
  userId: string;
  title: string;
  message: string;
  type?:
    | 'ORDER_UPDATE'
    | 'PAYOUT_UPDATE'
    | 'ACCOUNT_UPDATE'
    | 'SYSTEM_MESSAGE'
    | 'PROMOTION_CREATED'
    | 'PROMOTION_APPROVED'
    | 'PROMOTION_REJECTED'
    | 'CAMPAIGN_APPROVED';
  route?: string;
  orderId?: string;
  notificationType?: string;
};

export const createUserNotificationAndPush = async (
  params: CreateUserNotificationParams
) => {
  const brandTitle = 'Mahallem';
  const pushBody = `${params.title}: ${params.message}`;

  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type || 'SYSTEM_MESSAGE',
    },
  });

  try {
    await sendPushNotificationToUser(params.userId, {
      title: brandTitle,
      subtitle: params.title,
      body: pushBody,
      imageUrl: 'https://mahallem.live/logo.png',
      data: {
        route: params.route || '/notifications',
        orderId: params.orderId,
        notificationType: params.notificationType || params.type || 'SYSTEM_MESSAGE',
        logoUrl: 'https://mahallem.live/logo.png',
        notificationId: notification.id,
      },
    });
  } catch (error) {
    console.warn('Push send failed (non-blocking):', error);
  }

  return notification;
};
