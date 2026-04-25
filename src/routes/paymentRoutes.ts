import { Router } from 'express';

const router = Router();

// Lightweight payment methods endpoint used by the customer app.
// This backend does not integrate with a real PSP yet; `test_card` is a safe
// simulation for local/dev environments.
router.get('/methods', async (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      methods: [
        { 
          id: 'test_card', 
          name: 'Test Kredi Kartı', 
          description: 'Deneme ödeme - Herhangi bir işlem yapılmaz',
          icon: 'card', 
          enabled: true,
          testCard: {
            number: '4242 4242 4242 4242',
            expiry: '12/25',
            cvc: '123'
          }
        },
        { id: 'cash_on_delivery', name: 'Kapıda Ödeme', icon: 'cash', enabled: true },
      ],
    },
  });
});

// Get test card details
router.get('/test-card', async (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      testCard: {
        number: '4242 4242 4242 4242',
        expiry: '12/25',
        cvc: '123'
      },
      message: 'Bu test kartı checkout sırasında kullanabilirsiniz. Siparişiniz başarıyla oluşturulacaktır.'
    }
  });
});

export default router;
