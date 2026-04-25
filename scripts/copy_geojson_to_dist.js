const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
}

function main() {
  const projectRoot = path.join(__dirname, '..');
  const srcDataDir = path.join(projectRoot, 'src', 'data');
  const distDataDir = path.join(projectRoot, 'dist', 'data');

  const candidates = ['neighborhoods_tr.geojson', 'neighborhoods.geojson'];
  let copiedAny = false;

  for (const fileName of candidates) {
    const src = path.join(srcDataDir, fileName);
    const dest = path.join(distDataDir, fileName);
    const copied = copyIfExists(src, dest);
    if (copied) {
      copiedAny = true;
      // eslint-disable-next-line no-console
      console.log(`[copy_geojson_to_dist] Copied ${fileName} -> dist/data`);
    }
  }

  if (!copiedAny) {
    // eslint-disable-next-line no-console
    console.warn('[copy_geojson_to_dist] No GeoJSON files found under src/data (neighborhoods_tr.geojson or neighborhoods.geojson).');
  }
}

main();
