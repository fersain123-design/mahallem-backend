"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentService = void 0;
const errorHandler_1 = require("../../middleware/errorHandler");
const payment_state_machine_1 = require("./payment.state-machine");
const payment_config_1 = require("./payment.config");
const payment_repository_1 = require("./payment.repository");
const payment_provider_iyzico_1 = require("./payment.provider.iyzico");
const toMoney = (value) => Number(Number(value || 0).toFixed(2));
const providerResolver = () => {
    const cfg = (0, payment_config_1.getPaymentConfig)();
    if (!cfg.iyzico.enabled) {
        throw new errorHandler_1.AppError(503, 'Payment provider is currently disabled');
    }
    return new payment_provider_iyzico_1.IyzicoPaymentProvider();
};
const requireOrderAccess = (args) => {
    if (args.role === 'ADMIN')
        return;
    if (args.role === 'CUSTOMER' && args.userId === args.orderCustomerId)
        return;
    throw new errorHandler_1.AppError(403, 'Bu odeme kaydi icin yetkiniz yok');
};
const recomputeOrderTotal = (order) => {
    const itemTotal = (order.items || []).reduce((sum, item) => sum + Number(item?.subtotal || 0), 0);
    const deliveryFee = Number(order?.deliveryFee || 0);
    const campaignDiscount = Number(order?.campaignDiscount || 0);
    return toMoney(itemTotal - campaignDiscount + deliveryFee);
};
const resolveVendorPaymentReadinessReason = (vendor) => {
    if (!vendor)
        return 'vendor_not_found';
    if (String(vendor.status || '') !== 'APPROVED')
        return 'vendor_not_approved';
    if (!String(vendor.iban || '').trim())
        return 'missing_iban';
    if (String(vendor.ibanStatus || '') !== 'COMPLETED')
        return 'iban_not_approved';
    if (!String(vendor.addressLine || vendor.address || '').trim())
        return 'missing_address';
    if (!String(vendor.shopName || '').trim())
        return 'missing_shop_name';
    if (!String(vendor.tcKimlik || '').trim() && !String(vendor.taxNumber || '').trim()) {
        return 'missing_identity_or_tax_number';
    }
    return null;
};
const buildAddressText = (address) => {
    if (!address)
        return 'Adres bilgisi girilmedi';
    return [address.addressLine, address.neighborhood, address.district, address.city]
        .filter(Boolean)
        .join(' ')
        .trim();
};
exports.paymentService = {
    async initializePayment(userId, input, ip) {
        const order = await payment_repository_1.paymentRepository.getOrderForInitialize(input.orderId, userId);
        if (!order) {
            throw new errorHandler_1.AppError(404, 'Siparis bulunamadi');
        }
        if (!Array.isArray(order.items) || order.items.length === 0) {
            throw new errorHandler_1.AppError(409, 'Bos siparis icin odeme baslatilamaz');
        }
        const backendTotal = recomputeOrderTotal(order);
        if (Math.abs(backendTotal - Number(order.totalPrice || 0)) > 0.01) {
            throw new errorHandler_1.AppError(409, 'Siparis tutari dogrulama hatasi');
        }
        const vendorIds = [...new Set(order.items.map((item) => String(item.vendorId)))];
        const submerchants = await payment_repository_1.paymentRepository.getSubmerchantsByVendorIds(vendorIds);
        const submerchantByVendorId = new Map(submerchants.map((sm) => [sm.vendorId, sm]));
        const missingVendor = vendorIds.find((vendorId) => {
            const submerchant = submerchantByVendorId.get(vendorId);
            return !submerchant || !submerchant.subMerchantKey || submerchant.status !== 'ACTIVE';
        });
        if (missingVendor) {
            await this.syncVendorSubmerchantReadiness(missingVendor, 'checkout_initialize');
            const refreshed = await payment_repository_1.paymentRepository.findSubmerchantByVendorId(missingVendor);
            const reason = String(refreshed?.readinessReason || 'submerchant_not_ready');
            throw new errorHandler_1.AppError(409, `Submerchant kaydi eksik olan satici icin odeme baslatilamaz (reason: ${reason})`);
        }
        const cfg = (0, payment_config_1.getPaymentConfig)();
        const provider = providerResolver();
        const conversationId = `ord-${order.id}-${Date.now()}`;
        const basketItems = order.items.map((item) => {
            const submerchant = submerchantByVendorId.get(item.vendorId);
            if (!submerchant?.subMerchantKey) {
                throw new errorHandler_1.AppError(409, 'Submerchant key bulunamadi');
            }
            return {
                id: item.id,
                name: String(item?.product?.name || 'Urun'),
                category1: String(item?.product?.category?.name || 'Genel'),
                itemType: 'PHYSICAL',
                price: toMoney(item.subtotal).toFixed(2),
                subMerchantKey: submerchant.subMerchantKey,
                subMerchantPrice: toMoney(item.vendorNetAmount || item.subtotal).toFixed(2),
            };
        });
        const addressText = buildAddressText(order.shippingAddress);
        const buyerName = String(order.customer?.name || 'Musteri').trim();
        const [firstName, ...rest] = buyerName.split(' ');
        const initPayload = {
            conversationId,
            price: toMoney(order.totalPrice).toFixed(2),
            paidPrice: toMoney(order.totalPrice).toFixed(2),
            currency: cfg.currency,
            basketId: order.id,
            paymentGroup: 'PRODUCT',
            callbackUrl: cfg.iyzico.callbackUrl,
            locale: cfg.locale,
            buyer: {
                id: order.customerId,
                name: firstName || buyerName,
                surname: rest.join(' ') || 'Musteri',
                gsmNumber: order.customer?.phone || undefined,
                email: order.customer?.email || 'unknown@mahallem.local',
                registrationAddress: addressText,
                city: order.shippingAddress?.city || undefined,
                country: order.shippingAddress?.country || 'TR',
                ip: ip || '127.0.0.1',
            },
            shippingAddress: {
                contactName: buyerName,
                city: order.shippingAddress?.city || undefined,
                country: order.shippingAddress?.country || 'TR',
                address: addressText,
            },
            billingAddress: {
                contactName: buyerName,
                city: order.shippingAddress?.city || undefined,
                country: order.shippingAddress?.country || 'TR',
                address: addressText,
            },
            basketItems,
        };
        const initialized = await provider.initializeCheckout(initPayload);
        const payment = await payment_repository_1.paymentRepository.createPaymentSession({
            orderId: order.id,
            userId: order.customerId,
            vendorId: vendorIds.length === 1 ? vendorIds[0] : undefined,
            conversationId: initialized.conversationId,
            price: toMoney(order.totalPrice),
            paidPrice: toMoney(order.totalPrice),
            currency: cfg.currency,
            provider: 'IYZICO',
            paymentGroup: 'PRODUCT',
            token: initialized.token,
            rawInitResponse: initialized.raw,
            items: order.items.map((item) => {
                const submerchant = submerchantByVendorId.get(item.vendorId);
                return {
                    orderItemId: item.id,
                    vendorId: item.vendorId,
                    submerchantId: submerchant?.id,
                    subMerchantKey: submerchant?.subMerchantKey || undefined,
                    subMerchantPrice: toMoney(item.vendorNetAmount || item.subtotal),
                    itemPrice: toMoney(item.subtotal),
                    commissionAmount: toMoney(item.commissionAmount || 0),
                    payoutAmount: toMoney(item.vendorNetAmount || item.subtotal),
                };
            }),
        });
        await payment_repository_1.paymentRepository.markOrderPaymentPending(order.id);
        await payment_repository_1.paymentRepository.createAttempt({
            paymentId: payment.id,
            requestType: 'checkout_initialize',
            requestPayload: initPayload,
            responsePayload: initialized.raw,
            providerConversationId: initialized.conversationId,
            success: true,
        });
        return {
            paymentSessionId: payment.id,
            token: initialized.token,
            paymentPageUrl: initialized.paymentPageUrl,
            status: initialized.status,
        };
    },
    async handleCallback(input) {
        return this.retrieveAndFinalize(input.token, input.conversationId, 'callback');
    },
    async handleWebhook(input, signature) {
        const provider = providerResolver();
        const validation = await provider.validateCallback(input, signature);
        const paymentToken = String(input.token || input.payload?.token || '').trim();
        if (!paymentToken) {
            await payment_repository_1.paymentRepository.createWebhookLog({
                provider: 'IYZICO',
                eventType: input.eventType,
                signature,
                isValidSignature: validation.isValid,
                callbackToken: undefined,
                conversationId: input.conversationId,
                payload: input,
                processStatus: 'rejected',
                processError: 'token_missing',
            });
            throw new errorHandler_1.AppError(400, 'Webhook token bilgisi eksik');
        }
        if (!validation.isValid) {
            await payment_repository_1.paymentRepository.createWebhookLog({
                provider: 'IYZICO',
                eventType: input.eventType,
                signature,
                isValidSignature: false,
                callbackToken: paymentToken,
                conversationId: input.conversationId,
                payload: input,
                processStatus: 'rejected',
                processError: validation.reason,
            });
            throw new errorHandler_1.AppError(401, 'Webhook signature dogrulanamadi');
        }
        return this.retrieveAndFinalize(paymentToken, input.conversationId, 'webhook', input, signature);
    },
    async getPaymentById(auth, paymentId) {
        const payment = await payment_repository_1.paymentRepository.findPaymentById(paymentId);
        if (!payment) {
            throw new errorHandler_1.AppError(404, 'Odeme bulunamadi');
        }
        requireOrderAccess({
            role: auth.role,
            userId: auth.userId,
            orderCustomerId: payment.order.customerId,
        });
        return payment;
    },
    async refundPayment(auth, paymentId, input) {
        const payment = await payment_repository_1.paymentRepository.findPaymentById(paymentId);
        if (!payment) {
            throw new errorHandler_1.AppError(404, 'Odeme bulunamadi');
        }
        if (auth.role === 'CUSTOMER') {
            throw new errorHandler_1.AppError(403, 'Iade islemi icin yetkiniz bulunmuyor');
        }
        if (payment.status !== 'PAID' && payment.status !== 'REVIEW') {
            throw new errorHandler_1.AppError(409, 'Bu odeme durumunda iade baslatilamaz');
        }
        const provider = providerResolver();
        const amount = toMoney(input.amount ?? payment.paidPrice ?? payment.price);
        const isFull = amount >= toMoney(payment.paidPrice ?? payment.price);
        const transactionId = input.paymentItemId
            ? payment.items.find((item) => item.id === input.paymentItemId)?.paymentTransactionId
            : payment.items.find((item) => Boolean(item.paymentTransactionId))?.paymentTransactionId;
        const refundResult = await provider.refundPayment({
            paymentId: String(payment.providerPaymentId || payment.id),
            paymentTransactionId: transactionId || undefined,
            amount,
            currency: payment.currency,
            conversationId: `refund-${payment.id}-${Date.now()}`,
        });
        const refund = await payment_repository_1.paymentRepository.createRefund({
            paymentId: payment.id,
            paymentItemId: input.paymentItemId,
            orderId: payment.orderId,
            providerRefundId: refundResult.providerRefundId,
            amount,
            reason: input.reason,
            status: refundResult.status,
            rawProviderResponse: refundResult.raw,
            createdById: auth.userId,
        });
        if (refundResult.status === 'SUCCEEDED') {
            await payment_repository_1.paymentRepository.markPaymentRefunded(payment.id);
            await payment_repository_1.paymentRepository.updateOrderAfterRefund(payment.orderId, isFull);
        }
        return {
            refund,
            isFull,
            status: refundResult.status,
        };
    },
    async registerSubmerchant(auth, vendorId, input) {
        const vendor = await payment_repository_1.paymentRepository.findVendorById(vendorId);
        if (!vendor) {
            throw new errorHandler_1.AppError(404, 'Satici bulunamadi');
        }
        if (auth.role === 'VENDOR' && vendor.userId !== auth.userId) {
            throw new errorHandler_1.AppError(403, 'Bu satici icin islem yetkiniz yok');
        }
        if (!vendor.iban || vendor.ibanStatus !== 'COMPLETED') {
            throw new errorHandler_1.AppError(409, 'IBAN bilgisi onayli degil');
        }
        if (!vendor.tcKimlik && !vendor.taxNumber) {
            throw new errorHandler_1.AppError(409, 'Identity veya tax numarasi olmadan submerchant olusturulamaz');
        }
        const provider = providerResolver();
        const response = await provider.createSubmerchant({
            vendorId: vendor.id,
            merchantType: input.merchantType,
            contactName: input.contactName || vendor.shopName,
            iban: vendor.iban,
            identityNumber: vendor.tcKimlik || undefined,
            taxNumber: vendor.taxNumber || undefined,
            email: vendor.user?.email || undefined,
            gsmNumber: vendor.user?.phone || undefined,
            name: vendor.shopName,
            address: vendor.addressLine || vendor.address || 'Adres girilmedi',
        });
        return payment_repository_1.paymentRepository.upsertSubmerchant({
            vendorId: vendor.id,
            provider: 'IYZICO',
            subMerchantKey: response.key,
            merchantType: input.merchantType,
            iban: vendor.iban,
            identityNumber: vendor.tcKimlik || undefined,
            taxNumber: vendor.taxNumber || undefined,
            contactName: input.contactName || vendor.shopName,
            status: (0, payment_provider_iyzico_1.mapIyzicoSubmerchantStatus)(String(response.raw?.status || response.status)),
            readinessReason: undefined,
            readinessCheckedAt: new Date(),
            rawProviderResponse: response.raw,
        });
    },
    async updateSubmerchant(auth, vendorId, input) {
        const vendor = await payment_repository_1.paymentRepository.findVendorById(vendorId);
        if (!vendor) {
            throw new errorHandler_1.AppError(404, 'Satici bulunamadi');
        }
        if (auth.role === 'VENDOR' && vendor.userId !== auth.userId) {
            throw new errorHandler_1.AppError(403, 'Bu satici icin islem yetkiniz yok');
        }
        const submerchants = await payment_repository_1.paymentRepository.getSubmerchantsByVendorIds([vendorId]);
        const submerchant = submerchants[0];
        if (!submerchant?.subMerchantKey) {
            throw new errorHandler_1.AppError(404, 'Guncellenecek submerchant kaydi bulunamadi');
        }
        const provider = providerResolver();
        const response = await provider.updateSubmerchant(submerchant.subMerchantKey, {
            vendorId: vendor.id,
            merchantType: input.merchantType || submerchant.merchantType || undefined,
            contactName: input.contactName || submerchant.contactName || vendor.shopName,
            iban: input.iban || vendor.iban,
            identityNumber: vendor.tcKimlik || undefined,
            taxNumber: vendor.taxNumber || undefined,
            email: vendor.user?.email || undefined,
            gsmNumber: vendor.user?.phone || undefined,
            name: vendor.shopName,
            address: vendor.addressLine || vendor.address || 'Adres girilmedi',
        });
        return payment_repository_1.paymentRepository.upsertSubmerchant({
            vendorId: vendor.id,
            provider: 'IYZICO',
            subMerchantKey: response.key,
            merchantType: input.merchantType || submerchant.merchantType || undefined,
            iban: input.iban || vendor.iban,
            identityNumber: vendor.tcKimlik || undefined,
            taxNumber: vendor.taxNumber || undefined,
            contactName: input.contactName || vendor.shopName,
            status: (0, payment_provider_iyzico_1.mapIyzicoSubmerchantStatus)(String(response.raw?.status || response.status)),
            readinessReason: undefined,
            readinessCheckedAt: new Date(),
            rawProviderResponse: response.raw,
        });
    },
    async syncVendorSubmerchantReadiness(vendorId, trigger) {
        const vendor = await payment_repository_1.paymentRepository.findVendorById(vendorId);
        if (!vendor) {
            throw new errorHandler_1.AppError(404, 'Satici bulunamadi');
        }
        const readinessReason = resolveVendorPaymentReadinessReason(vendor);
        const existing = await payment_repository_1.paymentRepository.findSubmerchantByVendorId(vendorId);
        if (readinessReason) {
            const fallbackKey = existing?.subMerchantKey;
            return payment_repository_1.paymentRepository.upsertSubmerchant({
                vendorId,
                provider: 'IYZICO',
                subMerchantKey: fallbackKey || undefined,
                merchantType: existing?.merchantType || undefined,
                iban: String(vendor.iban || '').trim(),
                identityNumber: vendor.tcKimlik || undefined,
                taxNumber: vendor.taxNumber || undefined,
                contactName: existing?.contactName || vendor.shopName,
                status: 'FAILED',
                readinessReason: `${trigger}:${readinessReason}`,
                readinessCheckedAt: new Date(),
                rawProviderResponse: existing?.rawProviderResponse,
            });
        }
        const provider = providerResolver();
        if (!existing?.subMerchantKey) {
            const created = await provider.createSubmerchant({
                vendorId: vendor.id,
                merchantType: existing?.merchantType || undefined,
                contactName: existing?.contactName || vendor.shopName,
                iban: vendor.iban,
                identityNumber: vendor.tcKimlik || undefined,
                taxNumber: vendor.taxNumber || undefined,
                email: vendor.user?.email || undefined,
                gsmNumber: vendor.user?.phone || undefined,
                name: vendor.shopName,
                address: vendor.addressLine || vendor.address || 'Adres girilmedi',
            });
            return payment_repository_1.paymentRepository.upsertSubmerchant({
                vendorId,
                provider: 'IYZICO',
                subMerchantKey: created.key,
                merchantType: existing?.merchantType || undefined,
                iban: vendor.iban,
                identityNumber: vendor.tcKimlik || undefined,
                taxNumber: vendor.taxNumber || undefined,
                contactName: existing?.contactName || vendor.shopName,
                status: (0, payment_provider_iyzico_1.mapIyzicoSubmerchantStatus)(String(created.raw?.status || created.status)),
                readinessReason: undefined,
                readinessCheckedAt: new Date(),
                rawProviderResponse: created.raw,
            });
        }
        const updated = await provider.updateSubmerchant(existing.subMerchantKey, {
            vendorId: vendor.id,
            merchantType: existing.merchantType || undefined,
            contactName: existing.contactName || vendor.shopName,
            iban: vendor.iban,
            identityNumber: vendor.tcKimlik || undefined,
            taxNumber: vendor.taxNumber || undefined,
            email: vendor.user?.email || undefined,
            gsmNumber: vendor.user?.phone || undefined,
            name: vendor.shopName,
            address: vendor.addressLine || vendor.address || 'Adres girilmedi',
        });
        return payment_repository_1.paymentRepository.upsertSubmerchant({
            vendorId,
            provider: 'IYZICO',
            subMerchantKey: updated.key,
            merchantType: existing.merchantType || undefined,
            iban: vendor.iban,
            identityNumber: vendor.tcKimlik || undefined,
            taxNumber: vendor.taxNumber || undefined,
            contactName: existing.contactName || vendor.shopName,
            status: (0, payment_provider_iyzico_1.mapIyzicoSubmerchantStatus)(String(updated.raw?.status || updated.status)),
            readinessReason: undefined,
            readinessCheckedAt: new Date(),
            rawProviderResponse: updated.raw,
        });
    },
    async retrieveAndFinalize(token, conversationId, source, payload, signature) {
        const payment = await payment_repository_1.paymentRepository.findPaymentByToken(token);
        if (!payment) {
            await payment_repository_1.paymentRepository.createWebhookLog({
                provider: 'IYZICO',
                eventType: source,
                signature,
                isValidSignature: Boolean(signature) || source === 'callback',
                callbackToken: token,
                conversationId,
                payload: payload,
                processStatus: 'not_found',
            });
            throw new errorHandler_1.AppError(404, 'Token icin odeme kaydi bulunamadi');
        }
        const isDuplicate = await payment_repository_1.paymentRepository.hasProcessedCallbackToken(token);
        if (isDuplicate && (payment.status === 'PAID' || payment.status === 'FAILED' || payment.status === 'REFUNDED')) {
            await payment_repository_1.paymentRepository.createWebhookLog({
                paymentId: payment.id,
                provider: payment.provider,
                eventType: source,
                signature,
                isValidSignature: true,
                callbackToken: token,
                conversationId,
                payload: payload,
                processStatus: 'processed',
                isDuplicate: true,
            });
            return {
                paymentId: payment.id,
                status: payment.status,
                duplicate: true,
            };
        }
        const provider = providerResolver();
        const retrieve = await provider.retrieveCheckoutResult(token, conversationId);
        (0, payment_state_machine_1.assertTransition)(payment.status, retrieve.paymentStatus);
        const updated = await payment_repository_1.paymentRepository.updatePaymentFromRetrieve({
            paymentId: payment.id,
            status: retrieve.paymentStatus,
            providerPaymentId: retrieve.providerPaymentId,
            paidPrice: retrieve.paidPrice,
            fraudStatus: retrieve.fraudStatus,
            rawRetrieveResponse: retrieve.raw,
            transactions: retrieve.transactions.map((trx) => ({
                basketItemId: trx.basketItemId,
                paymentTransactionId: trx.paymentTransactionId,
            })),
        });
        await payment_repository_1.paymentRepository.createAttempt({
            paymentId: payment.id,
            requestType: `checkout_retrieve_${source}`,
            requestPayload: { token, conversationId },
            responsePayload: retrieve.raw,
            providerConversationId: retrieve.conversationId,
            success: retrieve.paymentStatus === 'PAID',
        });
        await payment_repository_1.paymentRepository.createWebhookLog({
            paymentId: payment.id,
            provider: payment.provider,
            eventType: source,
            signature,
            isValidSignature: source === 'callback' ? true : Boolean(signature),
            callbackToken: token,
            conversationId,
            payload: payload,
            providerResponse: retrieve.raw,
            processStatus: 'processed',
            isDuplicate: false,
        });
        return {
            paymentId: payment.id,
            status: updated?.status || retrieve.paymentStatus,
            duplicate: false,
        };
    },
};
