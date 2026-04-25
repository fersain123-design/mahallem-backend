# 🎯 MAHALLEM BACKEND - BAŞLANGICI KÖKİ BAŞLAMA KILAVUZU

Merhaba! Tamamen hazır, üretime uygun bir **Mahallem E-Ticaret Backend** projesi yaratılmıştır. Aşağıdaki adımları takip ederek hemen başlayabilirsiniz.

## 📋 İçindekiler

1. [Dosya Yapısı](#dosya-yapısı)
2. [Hızlı Başlangıç (5 dakika)](#hızlı-başlangıç-5-dakika)
3. [Detaylı Kurulum (Windows)](#detaylı-kurulum-windows)
4. [Veritabanı Ayarı](#veritabanı-ayarı)
5. [Projeyi Çalıştırma](#projeyi-çalıştırma)
6. [API Testleri](#api-testleri)
7. [Sık Sorulan Sorunlar](#sık-sorulan-sorunlar)

---

## 📁 Dosya Yapısı

```
mahallem-backend/
├── src/
│   ├── app.ts                    ← Express uygulaması
│   ├── server.ts                 ← Sunucu başlatma
│   ├── config/
│   │   └── db.ts                ← Prisma veritabanı bağlantısı
│   ├── middleware/
│   │   ├── authMiddleware.ts    ← JWT doğrulaması
│   │   ├── requireRole.ts       ← Rol kontrolü
│   │   └── errorHandler.ts      ← Hata yönetimi
│   ├── routes/
│   │   ├── authRoutes.ts        ← Kimlik doğrulama yolları
│   │   ├── customerRoutes.ts    ← Müşteri yolları
│   │   ├── vendorRoutes.ts      ← Satıcı yolları
│   │   └── adminRoutes.ts       ← Admin yolları
│   ├── controllers/             ← İstek işleme
│   ├── services/                ← İş mantığı
│   └── utils/                   ← Yardımcı fonksiyonlar
├── prisma/
│   └── schema.prisma            ← Veritabanı şeması
├── package.json                 ← Bağımlılıklar
├── tsconfig.json                ← TypeScript ayarı
├── .env                         ← Ortam değişkenleri (gizli)
├── .env.example                 ← Şablon
├── README.md                    ← API dokümantasyonu
├── SETUP_GUIDE.md               ← Kurulum rehberi
└── PROJECT_SUMMARY.md           ← Proje özeti
```

---

## 🚀 Hızlı Başlangıç (5 dakika)

### Adım 1: Bağımlılıkları Yükle
```bash
cd "<PATH_TO_WORKSPACE>\\mahallem-backend"
npm install
```

### Adım 2: Veritabanını Ayarla
PostgreSQL'i çalıştığınızdan emin olun, sonra:
```bash
npx prisma migrate dev --name init
```

### Adım 3: Sunucuyu Başlat
```bash
npm run dev
```

**Sonuç:**
```
╔════════════════════════════════════════════╗
║      Mahallem Backend Server Started       ║
║         http://localhost:4000              ║
╚════════════════════════════════════════════╝
```

✅ **Tamamlandı! API hazır.**

---

## 🔧 Detaylı Kurulum (Windows)

### 1. PostgreSQL Kurulumu

#### Seçenek A: PostgreSQL İndir ve Kur
1. https://www.postgresql.org/download/windows/ ziyaret et
2. Windows Installer Download'ı tıkla (v15 önerilir)
3. Yükleyiciyi çalıştır
4. Kurulum sırasında:
   - Port: **5432** (varsayılan bırak)
   - Şifre: Güçlü bir şifre belirle (ör: `postgres123`)
   - Başlangıç menüsüne ekle: ✓

#### Seçenek B: WSL2 + PostgreSQL
```bash
# PowerShell (Yönetici)
wsl --install -d Ubuntu
# Sonra Ubuntu'da:
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo service postgresql start
```

### 2. Veritabanı Oluştur

```bash
# PowerShell veya Command Prompt'u aç
psql -U postgres

# PostgreSQL shell'inde:
CREATE DATABASE mahallem_db;
\l
\q
```

### 3. Node.js Kontrol Et
```bash
node --version    # v16+ olmalı
npm --version     # v8+ olmalı
```

---

## 🗄️ Veritabanı Ayarı

### .env Dosyasını Düzenle

`<PATH_TO_WORKSPACE>\\mahallem-backend\\.env` dosyasını aç ve düzenle:

```env
# PostgreSQL Bağlantısı
# Windows default: username=postgres
DATABASE_URL=postgresql://postgres:SENIN_SİFREN@localhost:5432/mahallem_db

# JWT Gizli Anahtarı (üretim için değiştir)
JWT_SECRET=gelistirme-gizli-anahtar-uretimde-degistir

# Sunucu Portu
PORT=4000

# Ortam
NODE_ENV=development
```

**Örnek (Windows varsayılan):**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mahallem_db
JWT_SECRET=dev-secret-key
PORT=4000
NODE_ENV=development
```

### Veritabanı Tablolarını Oluştur

```bash
# Migrations yap
npx prisma migrate dev --name init

# Veya test database'i için:
npx prisma migrate reset
```

### (Opsiyonel) Veritabanını Görsel Olarak Gör

```bash
npm run prisma:studio
```

Bu komut `http://localhost:5555` adresinde bir GUI açar.

---

## ▶️ Projeyi Çalıştırma

### Geliştirme Modu (Otomatik Yeniden Yükleme)
```bash
npm run dev
```

**Beklen:**
```
╔════════════════════════════════════════════╗
║      Mahallem Backend Server Started       ║
║         http://localhost:4000              ║
╚════════════════════════════════════════════╝
```

### Üretim Modu
```bash
npm run build
npm run start
```

### Başka bir Terminal'de İşlemi Kontrol Et
```bash
curl http://localhost:4000/health
# Yanıt: {"status":"OK"}
```

---

## 🧪 API Testleri

### 1. Müşteri Kaydı (cURL)

```bash
curl -X POST http://localhost:4000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d ^{
    ^"name^": ^"Ali Yılmaz^",
    ^"email^": ^"ali@example.com^",
    ^"password^": ^"sifre123^",
    ^"role^": ^"CUSTOMER^"
  ^}
```

**Yanıt:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "clabcd123",
      "name": "Ali Yılmaz",
      "email": "ali@example.com",
      "role": "CUSTOMER"
    }
  }
}
```

### 2. Satıcı Kaydı

```bash
curl -X POST http://localhost:4000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d ^{
    ^"name^": ^"Manav Dükkanı^",
    ^"email^": ^"magaza@example.com^",
    ^"password^": ^"sifre123^",
    ^"role^": ^"VENDOR^"
  ^}
```

### 3. Giriş Yap

```bash
curl -X POST http://localhost:4000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d ^{
    ^"email^": ^"ali@example.com^",
    ^"password^": ^"sifre123^"
  ^}
```

Yanıttaki `accessToken` değerini kopyala.

### 4. Mevcut Kullanıcıyı Getir

```bash
curl -X GET http://localhost:4000/api/auth/me ^
  -H "Authorization: Bearer TOKEN_BURAYA_YAPISTIR"
```

### Postman ile Test (Kolay)

1. `Mahallem-API.postman_collection.json` dosyasını indir
2. Postman'ı aç
3. **Import** → Dosyayı seç
4. Request'i seç → **Send** tıkla

---

## 🛠️ Kullanışlı Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme sunucusu (otomatik yeniden yükleme) |
| `npm run build` | TypeScript'i JavaScript'e derle |
| `npm run start` | Üretim sunucusu başlat |
| `npx prisma migrate dev --name init` | İlk migration oluştur |
| `npx prisma migrate status` | Migration durumunu kontrol et |
| `npm run prisma:studio` | Veritabanı GUI'sini aç |
| `npx prisma generate` | Prisma istemcisini yenile |

---

## 📊 Sık Kullanılan API Endpoints

### 🔐 Kimlik Doğrulama
```
POST   /api/auth/register      Kayıt yap
POST   /api/auth/login         Giriş yap
GET    /api/auth/me            Profili getir
```

### 🛍️ Müşteri Endpointleri
```
GET    /api/customer/categories                  Kategorileri getir
GET    /api/products                             Ürünleri getir
GET    /api/products/:id                        Ürün detayı
GET    /api/customer/cart                       Sepeti getir
POST   /api/customer/cart/add                   Sepete ekle
POST   /api/customer/orders                     Sipariş ver
GET    /api/customer/orders                     Siparişlerimi getir
```

### 🏪 Satıcı Endpointleri
```
GET    /api/vendor/profile                      Satıcı profili
GET    /api/vendor/products                     Ürünlerim
POST   /api/vendor/products                     Ürün ekle
GET    /api/vendor/orders                       Siparişlerim
GET    /api/vendor/dashboard                    Satış grafiği
```

### 👨‍💼 Admin Endpointleri
```
GET    /api/admin/dashboard                     Platform istatistikleri
GET    /api/admin/vendors                       Satıcılar
POST   /api/admin/vendors/:id/approve           Satıcı onayla
GET    /api/admin/users                         Kullanıcılar
GET    /api/admin/orders                        Tüm siparişler
```

---

## ❌ Sık Sorulan Sorunlar

### Problem: "connect ECONNREFUSED"
**Sebep:** PostgreSQL çalışmıyor

**Çözüm:**
```bash
# Windows Services uygulamasını aç
# PostgreSQL → Sağ tık → Başlat

# Veya pgAdmin kullan:
# pgAdmin 4 aç → Sunucuyu başlat
```

### Problem: "password authentication failed"
**Sebep:** .env dosyasında yanlış parola

**Çözüm:**
```
1. PostgreSQL'e kurulum sırasında verdiğin şifreyi kontrol et
2. .env'de bu şifreyi yaz:
   DATABASE_URL=postgresql://postgres:DOGRU_SIFRE@localhost:5432/mahallem_db
```

### Problem: "Cannot find module '@prisma/client'"
**Sebep:** Prisma client oluşturulmamış

**Çözüm:**
```bash
npx prisma generate
npm install
```

### Problem: Port 4000 zaten kullanılıyor
**Çözüm:** .env'de PORT değiştir
```env
PORT=5000
```

### Problem: TypeScript hataları
**Çözüm:**
```bash
npm run build
```

---

## ✅ Kurulum Kontrol Listesi

- [ ] Node.js v16+ yüklü: `node --version`
- [ ] PostgreSQL çalışıyor
- [ ] Veritabanı oluşturuldu: `mahallem_db`
- [ ] .env dosyası düzenlendi (DATABASE_URL doğru)
- [ ] `npm install` tamamlandı
- [ ] `npx prisma migrate dev --name init` çalıştırıldı
- [ ] `npm run dev` başlatıldı
- [ ] `http://localhost:4000/health` çalışıyor

**Hepsi tamamsa → ✅ Hazırsın!**

---

## 🎯 İlk Adımlar

1. **Veritabanı Seç:**
   - PostgreSQL varsayılan kurulum (Windows)
   - Veya Docker: `docker run -e POSTGRES_PASSWORD=password -p 5432:5432 postgres`

2. **Değişkenleri Ayarla:**
   - .env dosyasını veritabanı bilgileriyle doldurun

3. **Tabloları Oluştur:**
   - `npx prisma migrate dev --name init` çalıştırın

4. **Sunucuyu Başlat:**
   - `npm run dev` ile başlatın

5. **Test Et:**
   - Postman'da `POST /api/auth/register` deneyin
   - Token alın ve başka endpoint'leri test edin

---

## 📞 Yardım Alacak Dosyalar

| Dosya | Ne İçin? |
|-------|---------|
| `README.md` | Tam API dokümantasyonu |
| `SETUP_GUIDE.md` | İngilizce detaylı kurulum |
| `PROJECT_SUMMARY.md` | Proje özeti |
| `prisma/schema.prisma` | Veritabanı şeması |
| `src/utils/validationSchemas.ts` | Doğrulama kuralları |

---

## 🎉 Tamamlandı!

Backend hazır! Şimdi:

- ✅ **Müşteri panelini** bağla
- ✅ **Satıcı panelini** bağla  
- ✅ **Admin panelini** bağla
- ✅ Veya **Postman** ile test et

**Başarılar! 🚀**

---

**Sorularınız varsa, dokümantasyon dosyalarına bakın:**
- İngilizce: `README.md` ve `SETUP_GUIDE.md`
- Türkçe (temel): Bu dosya (`QUICK_START_TR.md`)

