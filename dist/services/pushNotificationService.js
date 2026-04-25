"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotificationToUser = exports.sendPushNotificationToTokens = exports.isExpoPushToken = void 0;
const db_1 = __importDefault(require("../config/db"));
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const extractInvalidTokens = (tickets, sentTokens) => {
    const invalid = new Set();
    tickets.forEach((ticket, index) => {
        const detailsError = String(ticket?.details?.error || '').trim();
        const explicitToken = String(ticket?.details?.expoPushToken || '').trim();
        const fallbackToken = sentTokens[index] || '';
        if (detailsError === 'DeviceNotRegistered') {
            if (explicitToken)
                invalid.add(explicitToken);
            else if (fallbackToken)
                invalid.add(fallbackToken);
        }
    });
    return Array.from(invalid);
};
const isExpoPushToken = (value) => {
    return /^ExponentPushToken\[[^\]]+\]$/.test(String(value || '').trim());
};
exports.isExpoPushToken = isExpoPushToken;
const sendPushNotificationToTokens = async (tokens, payload) => {
    const validTokens = tokens.map((t) => String(t || '').trim()).filter(exports.isExpoPushToken);
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
        priority: 'high',
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
    let responseBody = null;
    let tickets = [];
    try {
        responseBody = JSON.parse(text);
        const parsedData = responseBody?.data;
        tickets = Array.isArray(parsedData) ? parsedData : [];
    }
    catch {
        responseBody = text;
    }
    const invalidTokens = extractInvalidTokens(tickets, validTokens);
    if (invalidTokens.length > 0) {
        await db_1.default.userDeviceToken.updateMany({
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
exports.sendPushNotificationToTokens = sendPushNotificationToTokens;
const sendPushNotificationToUser = async (userId, payload) => {
    const tokens = await db_1.default.userDeviceToken.findMany({
        where: {
            userId,
            isActive: true,
        },
        select: {
            token: true,
        },
    });
    return (0, exports.sendPushNotificationToTokens)(tokens.map((item) => item.token), payload);
};
exports.sendPushNotificationToUser = sendPushNotificationToUser;
