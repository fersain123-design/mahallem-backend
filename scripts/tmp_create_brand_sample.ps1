$ErrorActionPreference = 'Stop'

$base = 'http://127.0.0.1:4000/api'
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

$loginBody = @{ email = 'vendor@demo.com'; password = 'Vendor123!' } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body $loginBody
$token = $login.data.accessToken
if (-not $token) { throw 'Vendor token missing' }

$headers = @{ Authorization = "Bearer $token" }
$cats = Invoke-RestMethod -Method Get -Uri "$base/vendor/categories" -Headers $headers
$categoryList = @($cats.data.categories)
if ($categoryList.Count -eq 0) { throw 'No vendor categories found' }

$firstCat = $categoryList[0]
$catId = [string]$firstCat.id
$catName = [string]$firstCat.name

$metaObj = @{
  sku = "SMK-$stamp"
  barcode = ''
  brand = 'Ulker'
  origin = 'Turkiye'
  shelfLifeDays = 30
  netWeightValue = 1
  netWeightUnit = 'adet'
  vatRate = 10
  minOrderQty = 1
  maxOrderQty = $null
  prepTimeMin = 10
  tags = @('ornek','marka-test')
  highlights = @('Marka alani test urunu')
  seoTitle = ''
  seoDescription = ''
  specs = @(@{ key = 'Paket'; value = 'Ornek' })
}
$metaJson = $metaObj | ConvertTo-Json -Depth 8 -Compress
$description = "Marka gorunumu kontrol urunu`n`n[MAHALLEM_PRODUCT_META_V1]`n$metaJson`n[/MAHALLEM_PRODUCT_META_V1]"

$payloadObj = @{
  name = "Marka Test Urunu $stamp"
  category = $catName
  categoryId = $catId
  price = 39.9
  stock = 12
  unit = 'adet'
  status = 'active'
  description = $description
  imageUrl = "https://picsum.photos/seed/mahallem-brand-$stamp/900/900"
  submissionSource = 'ADVANCED'
}

$payload = $payloadObj | ConvertTo-Json -Depth 12
$created = Invoke-RestMethod -Method Post -Uri "$base/vendor/products" -Headers $headers -ContentType 'application/json' -Body $payload

$result = [ordered]@{
  ok = $true
  productId = $created.data.id
  productName = $created.data.name
  brand = 'Ulker'
  category = $catName
}

$result | ConvertTo-Json -Depth 6
