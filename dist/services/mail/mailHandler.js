"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMailEvent = void 0;
const mailService_1 = require("./mailService");
const mailEvents_1 = require("./mailEvents");
const mailLogger_1 = require("./mailLogger");
const orderDelivered_1 = require("./templates/customer/orderDelivered");
const welcomeCustomer_1 = require("./templates/customer/welcomeCustomer");
const newOrder_1 = require("./templates/seller/newOrder");
const paymentCompleted_1 = require("./templates/seller/paymentCompleted");
const paymentRequested_1 = require("./templates/seller/paymentRequested");
const sellerApplication_1 = require("./templates/seller/sellerApplication");
const sellerApproved_1 = require("./templates/seller/sellerApproved");
const getDispatchPayload = (event, data) => {
    const to = String(data.email || '').trim();
    if (!to) {
        throw new Error(`Missing recipient email for mail event: ${event}`);
    }
    switch (event) {
        case mailEvents_1.MailEvents.USER_REGISTERED:
            return {
                to,
                subject: 'Mahallem’e Hoş Geldin',
                html: (0, welcomeCustomer_1.welcomeCustomerTemplate)(data),
            };
        case mailEvents_1.MailEvents.ORDER_DELIVERED:
            return {
                to,
                subject: 'Siparişin Teslim Edildi',
                html: (0, orderDelivered_1.orderDeliveredTemplate)(data),
            };
        case mailEvents_1.MailEvents.SELLER_APPLICATION:
            return {
                to,
                subject: 'Satıcı Başvurun Alındı',
                html: (0, sellerApplication_1.sellerApplicationTemplate)(data),
            };
        case mailEvents_1.MailEvents.SELLER_APPROVED:
            return {
                to,
                subject: 'Satıcı Başvurun Onaylandı',
                html: (0, sellerApproved_1.sellerApprovedTemplate)(data),
            };
        case mailEvents_1.MailEvents.NEW_ORDER:
            return {
                to,
                subject: 'Yeni Siparişin Var',
                html: (0, newOrder_1.newOrderTemplate)(data),
            };
        case mailEvents_1.MailEvents.PAYMENT_REQUESTED:
            return {
                to,
                subject: 'Ödeme Talebin Alındı',
                html: (0, paymentRequested_1.paymentRequestedTemplate)(data),
            };
        case mailEvents_1.MailEvents.PAYMENT_COMPLETED:
            return {
                to,
                subject: 'Ödemen Gönderildi',
                html: (0, paymentCompleted_1.paymentCompletedTemplate)(data),
            };
        default:
            throw new Error(`Unsupported mail event: ${event}`);
    }
};
const handleMailEvent = async (event, data) => {
    const payload = getDispatchPayload(event, data);
    try {
        const result = await (0, mailService_1.sendEmail)(payload);
        (0, mailLogger_1.logMail)({
            to: payload.to,
            subject: payload.subject,
            status: 'success',
        });
        return result;
    }
    catch (error) {
        (0, mailLogger_1.logMail)({
            to: payload.to,
            subject: payload.subject,
            status: 'fail',
            error,
        });
        throw error;
    }
};
exports.handleMailEvent = handleMailEvent;
// Controller usage example:
// await handleMailEvent(MailEvents.USER_REGISTERED, user);
