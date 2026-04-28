import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { mapBarcodeProductToMahallemCategory } from '../utils/categoryMapper';
import { validateBarcode } from '../utils/barcode';

type AnyObject = Record<string, any>;

const sendJson = (res: any, statusCode: number, body: AnyObject) => {
  const payload = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(payload);
};

const assert = (condition: unknown, message: string, details?: unknown) => {
  if (!condition) {
    const error = new Error(message);
    (error as any).details = details;
    throw error;
  }
};

const createMockOffServer = async () => {
  const server = createServer((req, res) => {
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

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}/api/v2`,
  };
};

(async () => {
  const { server, baseUrl } = await createMockOffServer();

  try {
    process.env.OPEN_FOOD_FACTS_BASE_URL = baseUrl;

    const openFoodFactsModule = await import('../services/openFoodFactsService');
    const { lookupOpenFoodFactsByBarcode } = openFoodFactsModule;

    const highLookup = await lookupOpenFoodFactsByBarcode('12345670');
    assert(Boolean(highLookup), 'High-confidence mock barcode should be found');

    const highMapping = mapBarcodeProductToMahallemCategory({
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

    const lowMapping = mapBarcodeProductToMahallemCategory({
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

    const validBarcodeResult = validateBarcode('12345670');
    assert(validBarcodeResult.isValid === true, '8-digit numeric barcode should be valid', validBarcodeResult);

    const invalidBarcodeResult = validateBarcode('8690570542101');
    assert(invalidBarcodeResult.isValid === false, 'Invalid EAN-13 checksum barcode should be invalid', invalidBarcodeResult);

    console.log('PASS smoke_barcode_mapper_mock_off');
    console.log(
      JSON.stringify(
        {
          mockBaseUrl: baseUrl,
          highLookupFound: Boolean(highLookup),
          highMapping,
          lowLookupFound: Boolean(lowLookup),
          lowMapping,
          missingLookupFound: Boolean(missingLookup),
          validBarcodeResult,
          invalidBarcodeResult,
        },
        null,
        2
      )
    );
  } catch (error: any) {
    console.error('FAIL smoke_barcode_mapper_mock_off');
    console.error(String(error?.message || error));
    if (error?.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
    process.exitCode = 1;
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((closeError) => (closeError ? reject(closeError) : resolve()));
    });
  }
})();
