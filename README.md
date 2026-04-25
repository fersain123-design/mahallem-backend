# Mahallem Backend API

Mahallem is a comprehensive multi-panel e-commerce platform backend built with Node.js, Express, TypeScript, and PostgreSQL. It supports three separate frontend applications (Admin, Vendor, and Customer) with role-based access control and complete order management.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- PostgreSQL 12+
- npm or yarn

### Installation & Setup

1. **Clone/Create the project**
   ```bash
   cd mahallem-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/mahallem_db
   JWT_SECRET=your-super-secure-secret-key-here
   PORT=4000
   NODE_ENV=development
   ```

4. **Create PostgreSQL database**
   ```bash
   createdb mahallem_db
   ```

5. **Run Prisma migrations**
   ```bash
   npx prisma migrate dev --name init
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

   Server will start on `http://localhost:4000`

## 📋 Available Scripts

```bash
# Development server with auto-reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run production build
npm run start

# Create new database migration
npx prisma migrate dev

# Open Prisma Studio (database GUI)
npm run prisma:studio

# Generate Prisma client
npm run prisma:generate
```

## 🏗️ Project Structure

```
src/
├── app.ts                  # Express app setup
├── server.ts               # Server entry point
├── config/
│   └── db.ts              # Prisma client configuration
├── middleware/
│   ├── authMiddleware.ts  # JWT verification
│   ├── requireRole.ts     # Role-based access control
│   └── errorHandler.ts    # Global error handling
├── routes/
│   ├── authRoutes.ts
│   ├── customerRoutes.ts
│   ├── vendorRoutes.ts
│   └── adminRoutes.ts
├── controllers/
│   ├── authController.ts
│   ├── customerController.ts
│   ├── vendorController.ts
│   └── adminController.ts
├── services/
│   ├── authService.ts
│   ├── customerService.ts
│   ├── vendorService.ts
│   ├── orderService.ts
│   └── adminService.ts
└── utils/
    ├── passwordUtils.ts        # Bcrypt hashing
    ├── jwtUtils.ts            # Token generation/verification
    └── validationSchemas.ts   # Zod schemas
```

## 🔐 Authentication & Authorization

### JWT Token Structure
```json
{
  "userId": "user-id",
  "role": "CUSTOMER|VENDOR|ADMIN"
}
```

### Authorization Header
```
Authorization: Bearer <token>
```

### User Roles
- **CUSTOMER**: Can browse products, manage cart, create orders
- **VENDOR**: Can manage products and orders (requires APPROVED status)
- **ADMIN**: Full platform management

## 📚 API Endpoints

### Authentication
```
POST   /api/auth/register       # Register new user
POST   /api/auth/login          # Login & get JWT token
GET    /api/auth/me             # Get current user info
```

### Customer Endpoints
```
# Profile
GET    /api/customer/profile
PUT    /api/customer/profile

# Addresses
GET    /api/customer/addresses
POST   /api/customer/addresses
PUT    /api/customer/addresses/:id
DELETE /api/customer/addresses/:id
POST   /api/customer/addresses/:id/set-default

# Products & Categories
GET    /api/customer/categories
GET    /api/products?categoryId=&search=&sort=&page=1&limit=20
GET    /api/products/:id

# Cart
GET    /api/customer/cart
POST   /api/customer/cart/add
POST   /api/customer/cart/update
POST   /api/customer/cart/remove
POST   /api/customer/cart/clear

# Orders
POST   /api/customer/orders
GET    /api/customer/orders
GET    /api/customer/orders/:id
```

### Vendor Endpoints
```
# Profile
GET    /api/vendor/profile
PUT    /api/vendor/profile
GET    /api/vendor/bank-account
PUT    /api/vendor/bank-account

# Products
GET    /api/vendor/products?page=1&limit=20
POST   /api/vendor/products
PUT    /api/vendor/products/:id
DELETE /api/vendor/products/:id

# Orders
GET    /api/vendor/orders?status=&page=1&limit=20
GET    /api/vendor/orders/:id

# Dashboard
GET    /api/vendor/dashboard
```

### Admin Endpoints
```
# Dashboard
GET    /api/admin/dashboard

# Vendors
GET    /api/admin/vendors?status=&search=&page=1&limit=20
GET    /api/admin/vendors/:id
POST   /api/admin/vendors/:id/approve
POST   /api/admin/vendors/:id/reject

# Users
GET    /api/admin/users?role=&search=&page=1&limit=20
GET    /api/admin/users/:id

# Products
GET    /api/admin/products?isActive=&page=1&limit=20
PUT    /api/admin/products/:id/toggle-active

# Orders
GET    /api/admin/orders?status=&vendorId=&customerId=&page=1&limit=20
GET    /api/admin/orders/:id

# Payouts
GET    /api/admin/payouts?status=&page=1&limit=20
GET    /api/admin/payouts/:id
POST   /api/admin/payouts/:id/mark-paid
```

## 🗄️ Database Schema

### User Model
- Core user data with role-based access
- Supports CUSTOMER, VENDOR, ADMIN roles

### VendorProfile Model
- Extended vendor information
- Status: PENDING, APPROVED, REJECTED
- Bank account details for payouts

### CustomerAddress Model
- Multiple addresses per customer
- Default address tracking
- Used for order shipping

### Product & Category Models
- Products linked to vendors and categories
- Stock management
- Multiple images support

### Cart & CartItem Models
- Shopping cart with items
- Real-time quantity updates

### Order & OrderItem Models
- Order management with status tracking
- Payment status tracking
- Split orders by vendor

### Payout Models
- Vendor payment tracking
- Period-based payouts
- Status management (PENDING, PROCESSING, PAID, CANCELLED)

### Notification Model
- User notifications
- Type categorization
- Read/unread tracking

## 🔄 Key Business Flows

### Customer Registration & Shopping
1. Customer registers with email and password
2. Empty cart is created automatically
3. Browse products by category or search
4. Add items to cart
5. Manage shipping addresses
6. Create order from cart items
7. Order automatically cleared from cart

### Vendor Management
1. Vendor registers with shop information
2. Status set to PENDING
3. Admin reviews and approves/rejects
4. Approved vendors can:
   - Update shop details and bank account
   - Create and manage products
   - View orders for their products
   - Access dashboard with sales metrics

### Admin Oversight
1. Monitor all users and vendors
2. Approve/reject vendor applications
3. Manage product visibility
4. Track orders and revenue
5. Process vendor payouts

## 🛡️ Security Features

- **Password Hashing**: BCrypt with salt rounds
- **JWT Authentication**: Secure token-based auth
- **Role-Based Access Control**: Middleware validation
- **Input Validation**: Zod schemas for all inputs
- **Error Handling**: Centralized error middleware
- **Environment Variables**: Sensitive data in .env

## 📊 Error Handling

All endpoints return structured responses:

**Success Response**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response**
```json
{
  "success": false,
  "message": "Error description",
  "errors": [ ... ] // Optional validation errors
}
```

## 🚢 Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Use strong JWT_SECRET
3. Configure DATABASE_URL for production database
4. Build project: `npm run build`
5. Start: `npm run start`
6. Use process manager (PM2, Docker, etc.)

## 📝 API Documentation

For detailed API documentation and examples, see:
- `prisma/schema.prisma` - Database schema
- `src/utils/validationSchemas.ts` - Request body schemas
- `src/controllers/` - Controller files with implementation details

## 🤝 Integration with Frontends

### Admin Panel
- Dashboard overview
- Vendor management
- User management
- Product visibility control
- Order monitoring
- Payout processing

### Vendor Panel
- Shop management
- Product catalog management
- Order fulfillment
- Revenue dashboard
- Bank account management

### Customer Panel
- Browse catalog
- Cart management
- Order placement
- Address management
- Order tracking

## 📦 Dependencies

- **express**: Web framework
- **@prisma/client**: ORM
- **jsonwebtoken**: JWT handling
- **bcrypt**: Password hashing
- **zod**: Input validation
- **cors**: CORS middleware
- **dotenv**: Environment configuration

## 🐛 Troubleshooting

**Database Connection Error**
```bash
# Check PostgreSQL is running
# Verify DATABASE_URL in .env
# Create database: createdb mahallem_db
```

**Migration Issues**
```bash
# Reset migrations (development only)
npx prisma migrate reset

# Apply migrations
npx prisma migrate deploy
```

**Port Already in Use**
```bash
# Change PORT in .env or kill process on port 4000
```

## 📄 License

ISC

## 👨‍💻 Support

For issues and questions, please check the code comments and Prisma schema documentation.

