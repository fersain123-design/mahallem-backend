PRAGMA foreign_keys=OFF;

-- Target categories to purge end-to-end.
-- Slugs are canonical and unique across base categories.
UPDATE "VendorProfile"
SET "categoryId" = NULL
WHERE "categoryId" IN (
  SELECT "id"
  FROM "Category"
  WHERE "slug" IN ('giyim-aksesuar', 'tup-gaz-bayi')
);

DELETE FROM "PayoutItem"
WHERE "orderItemId" IN (
  SELECT "id"
  FROM "OrderItem"
  WHERE "productId" IN (
    SELECT "id"
    FROM "Product"
    WHERE "categoryId" IN (
      SELECT "id"
      FROM "Category"
      WHERE "slug" IN ('giyim-aksesuar', 'tup-gaz-bayi')
    )
  )
);

DELETE FROM "OrderItem"
WHERE "productId" IN (
  SELECT "id"
  FROM "Product"
  WHERE "categoryId" IN (
    SELECT "id"
    FROM "Category"
    WHERE "slug" IN ('giyim-aksesuar', 'tup-gaz-bayi')
  )
);

DELETE FROM "CartItem"
WHERE "productId" IN (
  SELECT "id"
  FROM "Product"
  WHERE "categoryId" IN (
    SELECT "id"
    FROM "Category"
    WHERE "slug" IN ('giyim-aksesuar', 'tup-gaz-bayi')
  )
);

DELETE FROM "ProductReview"
WHERE "productId" IN (
  SELECT "id"
  FROM "Product"
  WHERE "categoryId" IN (
    SELECT "id"
    FROM "Category"
    WHERE "slug" IN ('giyim-aksesuar', 'tup-gaz-bayi')
  )
);

DELETE FROM "ProductImage"
WHERE "productId" IN (
  SELECT "id"
  FROM "Product"
  WHERE "categoryId" IN (
    SELECT "id"
    FROM "Category"
    WHERE "slug" IN ('giyim-aksesuar', 'tup-gaz-bayi')
  )
);

DELETE FROM "SellerProduct"
WHERE "productId" IN (
  SELECT "id"
  FROM "Product"
  WHERE "categoryId" IN (
    SELECT "id"
    FROM "Category"
    WHERE "slug" IN ('giyim-aksesuar', 'tup-gaz-bayi')
  )
);

DELETE FROM "Product"
WHERE "categoryId" IN (
  SELECT "id"
  FROM "Category"
  WHERE "slug" IN ('giyim-aksesuar', 'tup-gaz-bayi')
);

DELETE FROM "SubCategory"
WHERE "categoryId" IN (
  SELECT "id"
  FROM "Category"
  WHERE "slug" IN ('giyim-aksesuar', 'tup-gaz-bayi')
);

DELETE FROM "Category"
WHERE "slug" IN ('giyim-aksesuar', 'tup-gaz-bayi');

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
