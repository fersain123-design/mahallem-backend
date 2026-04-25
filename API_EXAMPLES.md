# API Examples - Complete Usage Guide

This file contains ready-to-use examples for all major API endpoints.

## Table of Contents
1. [Authentication](#authentication)
2. [Customer Endpoints](#customer-endpoints)
3. [Vendor Endpoints](#vendor-endpoints)
4. [Admin Endpoints](#admin-endpoints)

---

## Authentication

### Register Customer

**Request:**
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

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "clahdy2xk0000dj1h1b1e1f1g",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "CUSTOMER"
    }
  }
}
```

---

### Register Vendor

**Request:**
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Fresh Produce Shop",
    "email": "vendor@example.com",
    "password": "password123",
    "role": "VENDOR"
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "clahdy2xk0000dj1h1b2e2f2g",
      "name": "Fresh Produce Shop",
      "email": "vendor@example.com",
      "role": "VENDOR"
    }
  }
}
```

**Note:** Vendor account automatically gets VendorProfile with status: "PENDING"

---

### Login

**Request:**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "clahdy2xk0000dj1h1b1e1f1g",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "CUSTOMER"
    }
  }
}
```

---

### Get Current User

**Request:**
```bash
curl -X GET http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "clahdy2xk0000dj1h1b1e1f1g",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": null,
    "role": "CUSTOMER",
    "vendorProfile": null,
    "defaultAddress": null
  }
}
```

---

## Customer Endpoints

### Get Categories

**Request:**
```bash
curl -X GET http://localhost:4000/api/customer/categories
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "cat1",
      "name": "Vegetables",
      "slug": "vegetables",
      "description": "Fresh vegetables",
      "isActive": true
    },
    {
      "id": "cat2",
      "name": "Fruits",
      "slug": "fruits",
      "description": "Fresh fruits",
      "isActive": true
    }
  ]
}
```

---

### Get Products (with filters)

**Request:**
```bash
curl -X GET "http://localhost:4000/api/products?page=1&limit=10&search=apple&sort=price-asc"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "prod1",
        "name": "Apple",
        "slug": "apple",
        "description": "Fresh red apples",
        "price": "2.50",
        "stock": 100,
        "unit": "kg",
        "imageUrl": "https://...",
        "isActive": true,
        "vendor": {
          "id": "vendor1",
          "shopName": "Fresh Produce Shop",
          "status": "APPROVED"
        },
        "category": {
          "id": "cat2",
          "name": "Fruits"
        },
        "images": []
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "pages": 5
    }
  }
}
```

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `search` (optional)
- `categoryId` (optional)
- `sort` (optional: "newest", "price-asc", "price-desc")

---

### Get Product Details

**Request:**
```bash
curl -X GET http://localhost:4000/api/products/prod1
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "prod1",
    "name": "Apple",
    "slug": "apple",
    "description": "Fresh red apples",
    "price": "2.50",
    "stock": 100,
    "unit": "kg",
    "imageUrl": "https://...",
    "isActive": true,
    "vendor": {
      "id": "vendor1",
      "shopName": "Fresh Produce Shop",
      "address": "123 Market Street",
      "status": "APPROVED"
    },
    "category": {
      "id": "cat2",
      "name": "Fruits"
    },
    "images": [
      {
        "id": "img1",
        "imageUrl": "https://...",
        "sortOrder": 0
      }
    ]
  }
}
```

---

### Get Cart

**Request:**
```bash
curl -X GET http://localhost:4000/api/customer/cart \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "cart1",
    "userId": "user1",
    "items": [
      {
        "id": "cartitem1",
        "cartId": "cart1",
        "productId": "prod1",
        "quantity": 2,
        "unitPrice": "2.50",
        "product": {
          "id": "prod1",
          "name": "Apple",
          "price": "2.50",
          "vendor": {
            "id": "vendor1",
            "shopName": "Fresh Produce Shop",
            "status": "APPROVED"
          }
        }
      }
    ],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### Add to Cart

**Request:**
```bash
curl -X POST http://localhost:4000/api/customer/cart/add \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "prod1",
    "quantity": 2
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "cartitem1",
    "cartId": "cart1",
    "productId": "prod1",
    "quantity": 2,
    "unitPrice": "2.50",
    "product": {
      "id": "prod1",
      "name": "Apple",
      "price": "2.50"
    }
  }
}
```

---

### Add Customer Address

**Request:**
```bash
curl -X POST http://localhost:4000/api/customer/addresses \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Home",
    "fullName": "John Doe",
    "phone": "+90 555 123 4567",
    "country": "Turkey",
    "city": "Istanbul",
    "district": "Kadikoy",
    "neighborhood": "Acibadem",
    "addressLine": "123 Main Street, Apt 4"
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "addr1",
    "userId": "user1",
    "title": "Home",
    "fullName": "John Doe",
    "phone": "+90 555 123 4567",
    "country": "Turkey",
    "city": "Istanbul",
    "district": "Kadikoy",
    "neighborhood": "Acibadem",
    "addressLine": "123 Main Street, Apt 4",
    "isDefault": false,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### Create Order

**Request:**
```bash
curl -X POST http://localhost:4000/api/customer/orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shippingAddressId": "addr1"
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "order1",
    "customerId": "user1",
    "shippingAddressId": "addr1",
    "totalPrice": "5.00",
    "status": "PENDING",
    "paymentStatus": "PENDING",
    "items": [
      {
        "id": "orderitem1",
        "orderId": "order1",
        "productId": "prod1",
        "vendorId": "vendor1",
        "quantity": 2,
        "unitPrice": "2.50",
        "subtotal": "5.00"
      }
    ],
    "createdAt": "2024-01-15T10:35:00Z",
    "updatedAt": "2024-01-15T10:35:00Z"
  }
}
```

---

### Get Customer Orders

**Request:**
```bash
curl -X GET "http://localhost:4000/api/customer/orders?page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "order1",
      "customerId": "user1",
      "totalPrice": "5.00",
      "status": "PENDING",
      "paymentStatus": "PENDING",
      "items": [
        {
          "id": "orderitem1",
          "productId": "prod1",
          "quantity": 2,
          "unitPrice": "2.50",
          "subtotal": "5.00",
          "product": {
            "id": "prod1",
            "name": "Apple"
          },
          "vendor": {
            "id": "vendor1",
            "shopName": "Fresh Produce Shop"
          }
        }
      ],
      "createdAt": "2024-01-15T10:35:00Z"
    }
  ]
}
```

---

## Vendor Endpoints

### Get Vendor Profile

**Request:**
```bash
curl -X GET http://localhost:4000/api/vendor/profile \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "vendor1",
    "userId": "vendoruser1",
    "shopName": "Fresh Produce Shop",
    "iban": "TR89 0001 2345 6789 0123 4567 89",
    "bankName": "Bank Name",
    "status": "PENDING",
    "rejectionReason": null,
    "address": "123 Market Street",
    "user": {
      "id": "vendoruser1",
      "name": "Shop Owner",
      "email": "vendor@example.com",
      "phone": "+90 555 123 4567"
    },
    "createdAt": "2024-01-15T09:00:00Z",
    "updatedAt": "2024-01-15T09:00:00Z"
  }
}
```

---

### Create Product

**Request:**
```bash
curl -X POST http://localhost:4000/api/vendor/products \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryId": "cat2",
    "name": "Apple",
    "slug": "apple",
    "description": "Fresh red apples from our farm",
    "price": 2.50,
    "stock": 100,
    "unit": "kg",
    "imageUrl": "https://example.com/apple.jpg"
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "prod1",
    "vendorId": "vendor1",
    "categoryId": "cat2",
    "name": "Apple",
    "slug": "apple",
    "description": "Fresh red apples from our farm",
    "price": "2.50",
    "stock": 100,
    "unit": "kg",
    "imageUrl": "https://example.com/apple.jpg",
    "isActive": true,
    "category": {
      "id": "cat2",
      "name": "Fruits"
    },
    "images": [],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### Get Vendor Dashboard

**Request:**
```bash
curl -X GET http://localhost:4000/api/vendor/dashboard \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "vendor": {
      "id": "vendor1",
      "shopName": "Fresh Produce Shop",
      "status": "APPROVED"
    },
    "totalRevenue": "250.00",
    "totalOrders": 50,
    "ordersByStatus": {
      "PENDING": 5,
      "PREPARING": 10,
      "ON_THE_WAY": 20,
      "DELIVERED": 15,
      "CANCELLED": 0
    },
    "topProducts": [
      {
        "product": {
          "id": "prod1",
          "name": "Apple",
          "price": "2.50"
        },
        "totalQuantitySold": 100
      }
    ]
  }
}
```

---

## Admin Endpoints

### Get Admin Dashboard

**Request:**
```bash
curl -X GET http://localhost:4000/api/admin/dashboard \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalCustomers": 150,
    "totalVendors": 25,
    "vendorsByStatus": {
      "PENDING": 5,
      "APPROVED": 18,
      "REJECTED": 2
    },
    "totalOrders": 500,
    "totalRevenue": "10000.00",
    "topProducts": [
      {
        "product": {
          "id": "prod1",
          "name": "Apple",
          "vendor": {
            "shopName": "Fresh Produce Shop"
          }
        },
        "totalQuantitySold": 1000
      }
    ]
  }
}
```

---

### Get All Vendors (with filters)

**Request:**
```bash
curl -X GET "http://localhost:4000/api/admin/vendors?status=PENDING&page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "vendors": [
      {
        "id": "vendor1",
        "shopName": "Fresh Produce Shop",
        "status": "PENDING",
        "rejectionReason": null,
        "user": {
          "id": "vendoruser1",
          "name": "Shop Owner",
          "email": "vendor@example.com",
          "phone": "+90 555 123 4567"
        },
        "createdAt": "2024-01-15T09:00:00Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "pages": 1
    }
  }
}
```

---

### Approve Vendor

**Request:**
```bash
curl -X POST http://localhost:4000/api/admin/vendors/vendor1/approve \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "vendor1",
    "shopName": "Fresh Produce Shop",
    "status": "APPROVED",
    "rejectionReason": null,
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

---

### Reject Vendor

**Request:**
```bash
curl -X POST http://localhost:4000/api/admin/vendors/vendor1/reject \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "rejectionReason": "Does not meet our business requirements"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "vendor1",
    "shopName": "Fresh Produce Shop",
    "status": "REJECTED",
    "rejectionReason": "Does not meet our business requirements",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

---

### Get All Orders (with filters)

**Request:**
```bash
curl -X GET "http://localhost:4000/api/admin/orders?status=PENDING&page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "order1",
        "customerId": "user1",
        "totalPrice": "5.00",
        "status": "PENDING",
        "paymentStatus": "PENDING",
        "customer": {
          "id": "user1",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "items": [
          {
            "id": "orderitem1",
            "productId": "prod1",
            "quantity": 2,
            "unitPrice": "2.50",
            "subtotal": "5.00",
            "product": {
              "id": "prod1",
              "name": "Apple"
            },
            "vendor": {
              "id": "vendor1",
              "shopName": "Fresh Produce Shop"
            }
          }
        ],
        "createdAt": "2024-01-15T10:35:00Z"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "pages": 10
    }
  }
}
```

---

## Error Responses

### Validation Error (400 Bad Request)

**Request:**
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "J",
    "email": "invalid-email",
    "password": "short",
    "role": "CUSTOMER"
  }'
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "path": "name",
      "message": "Name must be at least 2 characters"
    },
    {
      "path": "email",
      "message": "Invalid email address"
    },
    {
      "path": "password",
      "message": "Password must be at least 6 characters"
    }
  ]
}
```

---

### Authentication Error (401 Unauthorized)

**Request:**
```bash
curl -X GET http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer invalid-token"
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

---

### Authorization Error (403 Forbidden)

**Request:**
```bash
# Customer trying to access admin endpoint
curl -X GET http://localhost:4000/api/admin/dashboard \
  -H "Authorization: Bearer customer-token"
```

**Response (403 Forbidden):**
```json
{
  "success": false,
  "message": "Forbidden: Insufficient permissions"
}
```

---

### Not Found Error (404 Not Found)

**Request:**
```bash
curl -X GET http://localhost:4000/api/products/nonexistent-id
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "message": "Product not found"
}
```

---

## Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET/PUT/DELETE |
| 201 | Created | Successful POST |
| 400 | Bad Request | Validation error |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 500 | Server Error | Unexpected error |

---

**Ready to integrate? Copy these examples and adapt them to your frontend!** 🚀
