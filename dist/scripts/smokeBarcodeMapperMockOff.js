"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const categoryMapper_1 = require("../utils/categoryMapper");
const barcode_1 = require("../utils/barcode");
const sendJson = (res, statusCode, body) => {
    const payload = JSON.stringify(body);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(payload);
};
const assert = (condition, message, details) => {
    if (!condition) {
        const error = new Error(message);
        error.details = details;
        throw error;
    }
};
const createMockOffServer = async () => {
    const server = (0, node_http_1.createServer)((req, res) => {
        const requestUrl = new URL(String(req.url || '/'), 'http://127.0.0.1');
        if (!requestUrl.pathname.startsWith('/api/v2/product/')) {
            sendJson(res, 404, { status: 0, status_verbose: 'not found' });
            return;
        }
        const barcode = decodeURIComponent(requestUrl.pathname.replace('/api/v2/product/', ''));
        if (barcode === '12345670') {
            sendJson(res, 200, {
                code: barcode,
                status: 1,
                product: {
                    code: barcode,
                    product_name: 'Cikolatali Gofret',
                    generic_name: 'Atistirmalik',
                    brands: 'Demo Marka',
                    quantity: '40 g',
                    image_url: 'https://example.com/gofret.png',
                    categories: 'Atistirmaliklar',
                    category_tags: ['tr:cikolata', 'tr:gofret'],
                    ingredients_text: 'kakao, sut tozu, seker',
                },
            });
            return;
        }
        if (barcode === '12345671') {
            sendJson(res, 200, {
                code: barcode,
                status: 1,
                product: {
                    code: barcode,
                    product_name: 'Alpha Item',
                    generic_name: 'Beta Goods',
                    brands: 'ZetaBrand',
                    quantity: '1 adet',
                    image_url: '',
                    categories: 'Misc',
                    category_tags: ['en:misc-item'],
                    ingredients_text: 'sample',
                },
            });
            return;
        }
        sendJson(res, 200, {
            code: barcode,
            status: 0,
            status_verbose: 'product not found',
        });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    return {
        server,
        baseUrl: `http://127.0.0.1:${address.port}/api/v2`,
    };
};
(async () => {
    const { server, baseUrl } = await createMockOffServer();
    try {
        process.env.OPEN_FOOD_FACTS_BASE_URL = baseUrl;
        const openFoodFactsModule = await Promise.resolve().then(() => __importStar(require('../services/openFoodFactsService')));
        const { lookupOpenFoodFactsByBarcode } = openFoodFactsModule;
        const highLookup = await lookupOpenFoodFactsByBarcode('12345670');
        assert(Boolean(highLookup), 'High-confidence mock barcode should be found');
        const highMapping = (0, categoryMapper_1.mapBarcodeProductToMahallemCategory)({
            product_name: highLookup?.name,
            generic_name: highLookup?.genericName,
            brands: highLookup?.brand,
            categories: highLookup?.categories,
            category_tags: highLookup?.categoryTags,
            ingredients_text: highLookup?.ingredientsText,
            quantity: highLookup?.quantity,
            barcode: highLookup?.barcode,
        });
        assert(highMapping.confidence >= 0.75, 'High mapping confidence should be >= 0.75', highMapping);
        assert(highMapping.matchedKeywords.length > 0, 'High mapping should include matched keywords', highMapping);
        const lowLookup = await lookupOpenFoodFactsByBarcode('12345671');
        assert(Boolean(lowLookup), 'Low-confidence mock barcode should still be found');
        const lowMapping = (0, categoryMapper_1.mapBarcodeProductToMahallemCategory)({
            product_name: lowLookup?.name,
            generic_name: lowLookup?.genericName,
            brands: lowLookup?.brand,
            categories: lowLookup?.categories,
            category_tags: lowLookup?.categoryTags,
            ingredients_text: lowLookup?.ingredientsText,
            quantity: lowLookup?.quantity,
            barcode: lowLookup?.barcode,
        });
        assert(lowMapping.confidence <= 0.45, 'Low mapping confidence should be <= 0.45', lowMapping);
        const missingLookup = await lookupOpenFoodFactsByBarcode('12345672');
        assert(missingLookup === null, 'Missing mock barcode should return null');
        const validBarcodeResult = (0, barcode_1.validateBarcode)('12345670');
        assert(validBarcodeResult.isValid === true, '8-digit numeric barcode should be valid', validBarcodeResult);
        const invalidBarcodeResult = (0, barcode_1.validateBarcode)('8690570542101');
        assert(invalidBarcodeResult.isValid === false, 'Invalid EAN-13 checksum barcode should be invalid', invalidBarcodeResult);
        console.log('PASS smoke_barcode_mapper_mock_off');
        console.log(JSON.stringify({
            mockBaseUrl: baseUrl,
            highLookupFound: Boolean(highLookup),
            highMapping,
            lowLookupFound: Boolean(lowLookup),
            lowMapping,
            missingLookupFound: Boolean(missingLookup),
            validBarcodeResult,
            invalidBarcodeResult,
        }, null, 2));
    }
    catch (error) {
        console.error('FAIL smoke_barcode_mapper_mock_off');
        console.error(String(error?.message || error));
        if (error?.details) {
            console.error(JSON.stringify(error.details, null, 2));
        }
        process.exitCode = 1;
    }
    finally {
        await new Promise((resolve, reject) => {
            server.close((closeError) => (closeError ? reject(closeError) : resolve()));
        });
    }
})();
