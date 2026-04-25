# Database Schema & Relationships

## Complete ER Diagram Guide

This document explains the database structure and relationships between models.

---

## Model Overview (13 Models)

### Core Models
1. **User** - Base user model for all roles
2. **VendorProfile** - Extended vendor information
3. **CustomerAddress** - Customer shipping addresses
4. **Notification** - User notifications

### Product Models
5. **Category** - Product categories
6. **Product** - Product listings
7. **ProductImage** - Multiple images per product

### Shopping Models
8. **Cart** - Shopping cart (1 per customer)
9. **CartItem** - Items in cart

### Order Models
10. **Order** - Customer orders
11. **OrderItem** - Individual items in order (split by vendor)

### Payment Models
12. **Payout** - Vendor payment periods
13. **PayoutItem** - Items in payout

---

## Detailed Model Definitions

### 1. User Model

```
User
├── id (Primary Key) - Auto-generated CUID
├── name - String
├── email - Unique String
├── passwordHash - String (encrypted)
├── role - Enum: CUSTOMER | VENDOR | ADMIN
├── phone - Optional String
├── createdAt - DateTime
├── updatedAt - DateTime
└── Relations:
    ├── vendorProfile (1-to-1) - VendorProfile
    ├── customerAddresses (1-to-many) - CustomerAddress[]
    ├── cart (1-to-1) - Cart
    ├── orders (1-to-many) - Order[]
    ├── notifications (1-to-many) - Notification[]
    └── payouts (1-to-many) - Payout[] (Vendor Payouts)
```

**Indexes:** email, role
**Constraints:** email is unique

---

### 2. VendorProfile Model

```
VendorProfile
├── id (Primary Key)
├── userId (Foreign Key) - User.id (unique)
├── shopName - String
├── iban - String (for bank transfers)
├── bankName - String
├── status - Enum: PENDING | APPROVED | REJECTED
├── rejectionReason - Optional String
├── address - Optional String
├── createdAt - DateTime
├── updatedAt - DateTime
└── Relations:
    ├── user (1-to-1) - User
    ├── products (1-to-many) - Product[]
    ├── orderItems (1-to-many) - OrderItem[]
    └── payouts (1-to-many) - Payout[]
```

**Indexes:** userId, status
**Purpose:** Only created when User.role = "VENDOR"

---

### 3. CustomerAddress Model

```
CustomerAddress
├── id (Primary Key)
├── userId (Foreign Key) - User.id
├── title - String (Home, Office, etc.)
├── fullName - String
├── phone - String
├── country - String
├── city - String
├── district - String
├── neighborhood - String
├── addressLine - String
├── isDefault - Boolean
├── createdAt - DateTime
├── updatedAt - DateTime
└── Relations:
    ├── user (Many-to-1) - User
    └── orders (1-to-many) - Order[]
```

**Indexes:** userId, isDefault
**Purpose:** Multiple addresses per customer; used for order shipping

---

### 4. Category Model

```
Category
├── id (Primary Key)
├── name - Unique String
├── slug - Unique String
├── description - Optional String
├── isActive - Boolean (default: true)
└── Relations:
    └── products (1-to-many) - Product[]
```

**Indexes:** isActive
**Purpose:** Organize products into categories

---

### 5. Product Model

```
Product
├── id (Primary Key)
├── vendorId (Foreign Key) - VendorProfile.id
├── categoryId (Foreign Key) - Category.id
├── name - String
├── slug - String (unique per vendor)
├── description - Optional String
├── price - Decimal(10,2)
├── stock - Integer
├── unit - String (kg, pieces, liters, etc.)
├── imageUrl - Optional String (main image)
├── isActive - Boolean (default: true)
├── createdAt - DateTime
├── updatedAt - DateTime
└── Relations:
    ├── vendor (Many-to-1) - VendorProfile
    ├── category (Many-to-1) - Category
    ├── images (1-to-many) - ProductImage[]
    ├── cartItems (1-to-many) - CartItem[]
    └── orderItems (1-to-many) - OrderItem[]
```

**Indexes:** vendorId, categoryId, isActive, slug
**Unique:** (vendorId, slug) - Slug is unique per vendor
**Purpose:** Product listings; multiple vendors can have products

---

### 6. ProductImage Model

```
ProductImage
├── id (Primary Key)
├── productId (Foreign Key) - Product.id
├── imageUrl - String
├── sortOrder - Integer (for sorting)
└── Relations:
    └── product (Many-to-1) - Product
```

**Indexes:** productId
**Purpose:** Multiple images per product with custom ordering

---

### 7. Cart Model

```
Cart
├── id (Primary Key)
├── userId (Foreign Key) - User.id (unique)
├── createdAt - DateTime
├── updatedAt - DateTime
└── Relations:
    ├── user (1-to-1) - User
    └── items (1-to-many) - CartItem[]
```

**Indexes:** userId
**Purpose:** Shopping cart (1 per customer); created on user registration

---

### 8. CartItem Model

```
CartItem
├── id (Primary Key)
├── cartId (Foreign Key) - Cart.id
├── productId (Foreign Key) - Product.id
├── quantity - Integer
├── unitPrice - Decimal(10,2) (price at time of adding)
└── Relations:
    ├── cart (Many-to-1) - Cart
    └── product (Many-to-1) - Product
```

**Indexes:** cartId, productId
**Unique:** (cartId, productId) - One item per product per cart
**Purpose:** Items in shopping cart

---

### 9. Order Model

```
Order
├── id (Primary Key)
├── customerId (Foreign Key) - User.id
├── shippingAddressId (Foreign Key) - CustomerAddress.id
├── totalPrice - Decimal(10,2)
├── status - Enum: PENDING | PREPARING | ON_THE_WAY | DELIVERED | CANCELLED
├── paymentStatus - Enum: PENDING | PAID | FAILED | REFUNDED
├── createdAt - DateTime
├── updatedAt - DateTime
└── Relations:
    ├── customer (Many-to-1) - User
    ├── shippingAddress (Many-to-1) - CustomerAddress
    ├── items (1-to-many) - OrderItem[]
    └── payoutItems (1-to-many) - PayoutItem[]
```

**Indexes:** customerId, shippingAddressId, status, paymentStatus
**Purpose:** Customer orders; can contain items from multiple vendors

---

### 10. OrderItem Model

```
OrderItem
├── id (Primary Key)
├── orderId (Foreign Key) - Order.id
├── productId (Foreign Key) - Product.id
├── vendorId (Foreign Key) - VendorProfile.id
├── quantity - Integer
├── unitPrice - Decimal(10,2) (price at time of order)
├── subtotal - Decimal(10,2) (quantity × unitPrice)
└── Relations:
    ├── order (Many-to-1) - Order
    ├── product (Many-to-1) - Product
    ├── vendor (Many-to-1) - VendorProfile
    └── payoutItems (1-to-many) - PayoutItem[]
```

**Indexes:** orderId, productId, vendorId
**Purpose:** Individual items in order; allows orders from multiple vendors

---

### 11. Payout Model

```
Payout
├── id (Primary Key)
├── vendorId (Foreign Key) - User.id (vendor user)
├── periodStart - DateTime
├── periodEnd - DateTime
├── amount - Decimal(10,2)
├── status - Enum: PENDING | PROCESSING | PAID | CANCELLED
├── createdAt - DateTime
├── updatedAt - DateTime
└── Relations:
    ├── vendor (Many-to-1) - User
    └── items (1-to-many) - PayoutItem[]
```

**Indexes:** vendorId, status
**Purpose:** Track vendor payments by period

---

### 12. PayoutItem Model

```
PayoutItem
├── id (Primary Key)
├── payoutId (Foreign Key) - Payout.id
├── orderId (Foreign Key) - Order.id
├── orderItemId (Foreign Key) - OrderItem.id
├── amount - Decimal(10,2)
└── Relations:
    ├── payout (Many-to-1) - Payout
    ├── order (Many-to-1) - Order
    └── orderItem (Many-to-1) - OrderItem
```

**Indexes:** payoutId, orderId
**Purpose:** Track which orders/items are in a payout

---

### 13. Notification Model

```
Notification
├── id (Primary Key)
├── userId (Foreign Key) - User.id
├── title - String
├── message - String
├── type - Enum: ORDER_UPDATE | PAYOUT_UPDATE | ACCOUNT_UPDATE | SYSTEM_MESSAGE
├── isRead - Boolean (default: false)
├── createdAt - DateTime
└── Relations:
    └── user (Many-to-1) - User
```

**Indexes:** userId, isRead
**Purpose:** User notifications for various events

---

## Relationship Diagrams

### User Registration Flow

```
User (CUSTOMER role)
    └── Cart (auto-created)
    └── CustomerAddresses (0-many)
    └── Orders (0-many)
    └── Notifications (0-many)

User (VENDOR role)
    └── VendorProfile (auto-created, status=PENDING)
            └── Products (0-many)
            └── OrderItems (from orders)
            └── Payouts (0-many)
    └── Notifications (0-many)

User (ADMIN role)
    └── Notifications (0-many)
```

### Order Creation Flow

```
Cart
    └── CartItem[]
        └── Product
            └── Vendor

Order
    └── OrderItem[] (one per product, grouped by vendor)
        ├── Product
        ├── Vendor
        └── PayoutItem[] (when vendor is paid)
    └── ShippingAddress
```

### Data Isolation by Role

```
CUSTOMER can see:
    ├── Own profile & addresses
    ├── Own cart & items
    ├── Own orders
    ├── All active products from approved vendors
    └── Own notifications

VENDOR can see:
    ├── Own profile & bank account
    ├── Own products
    ├── Orders containing their products
    ├── Dashboard (own sales data)
    └── Own notifications

ADMIN can see:
    ├── All users
    ├── All vendors (pending/approved/rejected)
    ├── All products
    ├── All orders
    ├── All payouts
    └── Platform analytics
```

---

## Key Relationship Patterns

### 1-to-1 Relationships
```
User ←→ VendorProfile (only if role=VENDOR)
User ←→ Cart (only if role=CUSTOMER)
```

### 1-to-Many Relationships
```
User ← CustomerAddress
User ← Order
User ← Notification
VendorProfile ← Product
Category ← Product
Cart ← CartItem
Order ← OrderItem
Payout ← PayoutItem
Product ← ProductImage
```

### Many-to-1 Relationships
```
VendorProfile → User
Product → VendorProfile
Product → Category
CartItem → Cart
CartItem → Product
Order → User
Order → CustomerAddress
OrderItem → Order
OrderItem → Product
OrderItem → VendorProfile
Payout → User
PayoutItem → Payout
Notification → User
```

### Cross-References
```
OrderItem references:
    ├── Product (for product info)
    ├── Order (which order)
    └── VendorProfile (which vendor supplies)

PayoutItem references:
    ├── Order (which order)
    ├── OrderItem (which item)
    └── Payout (which payout period)
```

---

## Cascade Rules

**Cascade Delete** (DELETE child when parent deleted):
```
User → VendorProfile, CustomerAddress, Cart, Order, Notification
VendorProfile → Product, OrderItem, Payout
Cart → CartItem
Product → ProductImage, CartItem, OrderItem
Order → OrderItem, PayoutItem
Payout → PayoutItem
```

**No Cascade** (Prevent deletion if references exist):
```
Category → Products (soft prevent - mark as inactive)
```

---

## Indexes for Performance

```
Frequently Queried Fields:
├── User.email (fast login)
├── User.role (role checking)
├── VendorProfile.userId (profile lookup)
├── VendorProfile.status (vendor filtering)
├── Product.vendorId (vendor products)
├── Product.categoryId (category products)
├── Product.isActive (active products)
├── Product.slug (product lookup)
├── Cart.userId (cart access)
├── CartItem.cartId (cart items)
├── Order.customerId (customer orders)
├── Order.status (order filtering)
├── Notification.userId (user notifications)
└── Notification.isRead (unread filtering)
```

---

## Sample Data Model

### Complete Order Example

```
Customer User
├── id: "cust123"
├── role: CUSTOMER
├── email: "customer@example.com"
├── cart:
│   └── CartItem[]:
│       ├── Product: Apple (Vendor A)
│       │   └── quantity: 2
│       └── Product: Banana (Vendor B)
│           └── quantity: 3
│
└── Order:
    ├── customerId: "cust123"
    ├── shippingAddressId: "addr123"
    ├── status: PENDING
    ├── items:
    │   ├── OrderItem (Vendor A):
    │   │   ├── productId: Apple
    │   │   ├── vendorId: Vendor A
    │   │   ├── quantity: 2
    │   │   ├── subtotal: $5.00
    │   │   └── payoutItem (linked)
    │   │
    │   └── OrderItem (Vendor B):
    │       ├── productId: Banana
    │       ├── vendorId: Vendor B
    │       ├── quantity: 3
    │       ├── subtotal: $6.00
    │       └── payoutItem (linked)
    │
    └── totalPrice: $11.00
```

---

## Migration Order

When running migrations, models are created in this order:

1. User
2. VendorProfile
3. Category
4. Product
5. ProductImage
6. CustomerAddress
7. Cart
8. CartItem
9. Order
10. OrderItem
11. Payout
12. PayoutItem
13. Notification

Prisma handles dependencies automatically.

---

## Tips for Extension

If you want to add new models:

1. **Add to prisma/schema.prisma**
2. **Run** `npx prisma migrate dev --name add_new_model`
3. **Update** related services and controllers
4. **Add** new routes if needed
5. **Create** validation schemas in validationSchemas.ts

Example: To add a Review model:
```prisma
model Review {
  id            String      @id @default(cuid())
  productId     String
  customerId    String
  rating        Int         // 1-5
  comment       String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  product       Product     @relation(fields: [productId], references: [id])
  customer      User        @relation(fields: [customerId], references: [id])

  @@index([productId])
  @@index([customerId])
}
```

---

**Understanding this schema will help you extend and maintain the backend effectively!** 🗄️
