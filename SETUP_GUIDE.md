# 🚀 Mahallem Backend Setup Guide

## Complete Installation & First Run Steps

### Step 1: PostgreSQL Setup

#### Windows (PostgreSQL Installation)
1. Download PostgreSQL from https://www.postgresql.org/download/
2. Run installer and follow prompts
3. Remember the password you set for `postgres` user
4. Keep default port `5432`
5. After installation, PostgreSQL should be running

#### Verify PostgreSQL is Running
```bash
# Open Command Prompt or PowerShell
psql --version
```

### Step 2: Create Database

```bash
# Connect to PostgreSQL as admin
psql -U postgres

# In psql shell, run:
CREATE DATABASE mahallem_db;
\l  # List databases to verify

# Exit psql
\q
```

### Step 3: Clone/Setup Project

```bash
# Navigate to project folder
cd "<PATH_TO_WORKSPACE>\\mahallem-backend"

# List files to verify setup
dir
```

### Step 4: Install Dependencies

```bash
npm install
```

**Expected output**: Should install all packages successfully. If you get errors, try:
```bash
npm cache clean --force
npm install
```

### Step 5: Configure Environment

1. Edit `.env` file with your database credentials:

```env
# For Windows default PostgreSQL setup:
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/mahallem_db
JWT_SECRET=my-super-secret-key-change-in-production
PORT=4000
NODE_ENV=development
```

Replace `YOUR_PASSWORD` with the password you set during PostgreSQL installation.

### Step 6: Generate Prisma Client

```bash
npx prisma generate
```

### Step 7: Create Database Tables (Migration)

```bash
npx prisma migrate dev --name init
```

This will:
1. Create all tables based on schema.prisma
2. Generate Prisma client
3. Create migration file in prisma/migrations/

**Output should show:**
```
✓ Prisma Migrate CLI ready.
✓ Database file created at ./prisma/dev.db
Prisma Schema loaded...
```

### Step 8: Verify Database Setup

```bash
# Open Prisma Studio to view database
npm run prisma:studio
```

This opens a GUI at http://localhost:5555 where you can see all tables created.

### Step 9: Start Development Server

```bash
npm run dev
```

**Expected output:**
```
╔════════════════════════════════════════════╗
║      Mahallem Backend Server Started       ║
║         http://localhost:4000              ║
╚════════════════════════════════════════════╝
```

### Step 10: Test the API

Open another terminal and test:

```bash
# Health check
curl http://localhost:4000/health

# Should return:
# {"status":"OK"}
```

## ✅ Verification Checklist

- [ ] Node.js installed: `node --version` shows v16+
- [ ] PostgreSQL running: Can access `psql` command
- [ ] Database created: `mahallem_db` exists in PostgreSQL
- [ ] .env file configured with correct DATABASE_URL
- [ ] Dependencies installed: `node_modules` folder exists
- [ ] Prisma client generated: `node_modules/.prisma` exists
- [ ] Database tables created: Can see tables in Prisma Studio
- [ ] Server running on port 4000
- [ ] Health endpoint responds: `curl http://localhost:4000/health`

## 📝 First API Test: Register & Login

### 1. Register as Customer

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "CUSTOMER"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "user": {
      "id": "xxx",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "CUSTOMER"
    }
  }
}
```

### 2. Register as Vendor

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Shop Owner",
    "email": "vendor@example.com",
    "password": "password123",
    "role": "VENDOR"
  }'
```

### 3. Login

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### 4. Get Current User (Requires Token)

```bash
curl -X GET http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Replace `YOUR_TOKEN_HERE` with the token from registration.

## 🛠️ Common Issues & Solutions

### Issue: "connect ECONNREFUSED 127.0.0.1:5432"
**Solution**: PostgreSQL not running
```bash
# Windows: Start PostgreSQL service
# Services app -> PostgreSQL -> Start
# Or: pgAdmin should auto-start it
```

### Issue: "password authentication failed"
**Solution**: Wrong DATABASE_URL password
```bash
# Make sure .env matches your PostgreSQL password
# If forgotten, reset with pgAdmin
```

### Issue: "Cannot find module '@prisma/client'"
**Solution**: Prisma client not generated
```bash
npx prisma generate
```

### Issue: Port 4000 already in use
**Solution**: Change port in .env
```env
PORT=5000
```

### Issue: TypeScript compilation errors
**Solution**: Build project
```bash
npm run build
```

## 🔄 Development Workflow

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run Prisma Studio (optional, for debugging)
npm run prisma:studio

# Terminal 3: Make API calls/test
curl http://localhost:4000/...
```

## 📊 Database Reset (Development Only)

If you need to reset everything and start fresh:

```bash
# WARNING: This deletes all data!
npx prisma migrate reset

# Or manually:
# 1. Drop database: psql -U postgres -c "DROP DATABASE mahallem_db;"
# 2. Create new: psql -U postgres -c "CREATE DATABASE mahallem_db;"
# 3. Run migrations: npx prisma migrate dev --name init
```

## 🚀 Next Steps

1. **Create sample data**:
   - Register test users (customer, vendor, admin)
   - Create categories
   - Create products
   - Test cart and order flows

2. **Test all endpoints**:
   - Use Postman or Insomnia for API testing
   - Import API endpoints from README.md

3. **Connect frontend**:
   - Update frontend API_URL to http://localhost:4000
   - Test authentication flow
   - Test data retrieval

## 📞 Troubleshooting

If you encounter issues:

1. **Check console output** for error messages
2. **Check .env file** - is DATABASE_URL correct?
3. **Check database** - use Prisma Studio
4. **Clear node_modules** and reinstall:
   ```bash
   rm -r node_modules
   npm install
   ```

## ✨ You're All Set!

Your Mahallem backend is ready for development. Start the server with:

```bash
npm run dev
```

Happy coding! 🎉

