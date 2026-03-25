/**
 * QR Code Generator Service
 * Generates per-table QR codes that link to the QR web app
 * URL format: https://[domain]/order?brand=[brandId]&table=[num]&loc=[locationId]
 */
const QRCode = require('qrcode');
const path = require('path');
const fs   = require('fs');

const BASE_URL = process.env.QR_BASE_URL || 'https://qr-restaurants.netlify.app';

/**
 * Generate a QR code as a data URL (base64 PNG).
 * Use this for displaying in admin panel.
 */
async function generateQrDataUrl({ brandId, tableNumber, locationId }) {
  const url = `${BASE_URL}/?brand=${brandId}&table=${tableNumber}&loc=${locationId}`;
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    margin: 2,
    color: { dark: '#1A1A1A', light: '#FFFFFF' },
    width: 512,
  });
}

/**
 * Generate a QR code as a buffer (for saving as PNG file or PDF).
 */
async function generateQrBuffer({ brandId, tableNumber, locationId }) {
  const url = `${BASE_URL}/?brand=${brandId}&table=${tableNumber}&loc=${locationId}`;
  return QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 800,
  });
}

/**
 * Generate all QR codes for a location (1 per table) and save as PNGs.
 * Returns array of { tableNumber, filePath, url } objects.
 */
async function generateAllForLocation({ brandId, locationId, tableCount, outputDir }) {
  const results = [];
  fs.mkdirSync(outputDir, { recursive: true });

  for (let table = 1; table <= tableCount; table++) {
    const url = `${BASE_URL}/?brand=${brandId}&table=${table}&loc=${locationId}`;
    const filePath = path.join(outputDir, `qr_${locationId}_table${table}.png`);
    await QRCode.toFile(filePath, url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 800,
    });
    results.push({ tableNumber: table, filePath, url });
  }
  return results;
}

module.exports = { generateQrDataUrl, generateQrBuffer, generateAllForLocation };
