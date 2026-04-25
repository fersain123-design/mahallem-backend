"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserNotificationAndPush = void 0;
const db_1 = __importDefault(require("../config/db"));
const pushNotificationService_1 = require("./pushNotificationService");
const createUserNotificationAndPush = async (params) => {
    const brandTitle = 'Mahallem';
    const pushBody = `${params.title}: ${params.message}`;
    const notification = await db_1.default.notification.create({
        data: {
            userId: params.userId,
            title: params.title,
            message: params.message,
            type: params.type || 'SYSTEM_MESSAGE',
        },
    });
    try {
        await (0, pushNotificationService_1.sendPushNotificationToUser)(params.userId, {
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
    }
    catch (error) {
        console.warn('Push send failed (non-blocking):', error);
    }
    return notification;
};
exports.createUserNotificationAndPush = createUserNotificationAndPush;
