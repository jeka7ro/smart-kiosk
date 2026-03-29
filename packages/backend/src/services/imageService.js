const fs = require('fs');
const path = require('path');
const https = require('https');
const { pool } = require('../db');

// Ensure upload directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads/products');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Downloads a file from URL to local disk
 */
function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode >= 400) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => reject(err));
    });
  });
}

/**
 * Sync product overrides (images & tags) based on the latest Syrve menu
 * Runs asynchronously to prevent blocking the HTTP response.
 */
async function syncProductImages(menuProducts, brandId) {
  try {
    // 1. Fetch current overrides from DB
    const { rows } = await pool.query('SELECT * FROM product_overrides WHERE brand_id = $1', [brandId]);
    const overrideMap = {};
    rows.forEach(r => { overrideMap[r.id] = r; });

    let downloadedCount = 0;

    for (const product of menuProducts) {
      if (!product.image) continue;

      const syrveUrl = product.image;
      const existing = overrideMap[product.id];

      // If we already have this exact Syrve URL processed, and it has a local or custom image, skip it.
      if (existing && existing.syrve_image_url === syrveUrl && existing.local_image_url) {
        continue;
      }

      console.log(`[ImageService] New or changed image detected for ${product.name}. Downloading...`);
      
      try {
        // Generate a safe filename
        const ext = 'jpg'; // Syrve typically serves jpg or png, we default to jpg
        const filename = `${product.id}_${Date.now()}.${ext}`;
        const destPath = path.join(UPLOADS_DIR, filename);
        const localUrl = `/uploads/products/${filename}`;

        // Download the image
        await downloadImage(syrveUrl, destPath);
        downloadedCount++;

        // Upsert into product_overrides
        await pool.query(`
          INSERT INTO product_overrides (id, brand_id, syrve_image_url, local_image_url, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (id) DO UPDATE SET 
            syrve_image_url = EXCLUDED.syrve_image_url,
            local_image_url = EXCLUDED.local_image_url,
            updated_at = NOW()
        `, [product.id, brandId, syrveUrl, localUrl]);

      } catch (dlError) {
        console.error(`[ImageService] Failed to download image for ${product.name}:`, dlError.message);
      }
    }

    if (downloadedCount > 0) {
      console.log(`[ImageService] ✅ Downloaded ${downloadedCount} new images for brand ${brandId}`);
    } else {
      console.log(`[ImageService] All images up to date for brand ${brandId}`);
    }

  } catch (err) {
    console.error('[ImageService] Error syncing product images:', err.message);
  }
}

module.exports = { syncProductImages };
