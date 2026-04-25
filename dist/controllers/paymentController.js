"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTestCard = exports.processPayment = exports.getPaymentMethods = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const getPaymentMethods = async (req, res, next) => {
    try {
        const methods = [
            {
                id: 'test_card',
                name: 'Test Kredi Kartı',
                description: 'Deneme ödeme',
                icon: 'card',
                enabled: true,
                testCard: {
                    number: '4242 4242 4242 4242',
                    expiry: '12/25',
                    cvc: '123'
                }
            },
            {
                id: 'cash_on_delivery',
                name: 'Kapıda Ödeme',
                description: 'Teslimat sırasında ödeme',
                icon: 'cash',
                enabled: true
            }
        ];
        res.status(200).json({
            success: true,
            data: { methods }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getPaymentMethods = getPaymentMethods;
const processPayment = async (req, res, next) => {
    try {
        const { amount, paymentMethod, cardDetails } = req.body;
        if (!amount || !paymentMethod) {
            throw new errorHandler_1.AppError(400, 'Amount and payment method required');
        }
        // Test card payment simulation
        if (paymentMethod === 'test_card') {
            if (!cardDetails || !cardDetails.number || !cardDetails.expiry || !cardDetails.cvc) {
                throw new errorHandler_1.AppError(400, 'Invalid card details');
            }
            // Validate test card format
            if (cardDetails.number !== '4242424242424242' && !cardDetails.number.includes('4242')) {
                throw new errorHandler_1.AppError(400, 'Invalid test card number. Use 4242424242424242');
            }
            // Simulate successful payment
            res.status(200).json({
                success: true,
                data: {
                    transactionId: `TST_${Date.now()}`,
                    amount,
                    status: 'PAID',
                    method: 'test_card',
                    timestamp: new Date().toISOString()
                }
            });
            return;
        }
        // Cash on delivery - no immediate payment
        if (paymentMethod === 'cash_on_delivery') {
            res.status(200).json({
                success: true,
                data: {
                    transactionId: `COD_${Date.now()}`,
                    amount,
                    status: 'PENDING',
                    method: 'cash_on_delivery',
                    timestamp: new Date().toISOString()
                }
            });
            return;
        }
        throw new errorHandler_1.AppError(400, 'Unsupported payment method');
    }
    catch (error) {
        next(error);
    }
};
exports.processPayment = processPayment;
const validateTestCard = async (req, res, next) => {
    try {
        const testCard = {
            number: '4242 4242 4242 4242',
            expiry: '12/25',
            cvc: '123'
        };
        res.status(200).json({
            success: true,
            data: {
                testCard,
                message: 'Bu test kartı checkout sırasında kullanabilirsiniz'
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.validateTestCard = validateTestCard;
